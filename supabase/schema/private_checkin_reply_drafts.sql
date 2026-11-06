-- Keep editable coach replies outside client-readable check-in records.
create table if not exists public.coach_checkin_reply_drafts (
 checkin_id uuid not null references public.checkins(id) on delete cascade deferrable initially deferred,
 client_id uuid not null references public.clients(id) on delete cascade,
 coach_id uuid not null references public.profiles(id) on delete cascade,
 response_text text,video_url text,action_points text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(checkin_id,coach_id),
 check(length(coalesce(response_text,''))<=20000),check(length(coalesce(video_url,''))<=2048),check(length(coalesce(action_points,''))<=10000)
);
create index if not exists coach_checkin_reply_drafts_client_date on public.coach_checkin_reply_drafts(client_id,coach_id,updated_at desc);
alter table public.coach_checkin_reply_drafts enable row level security;
revoke all on public.coach_checkin_reply_drafts from public,anon,authenticated;
grant select,insert,update,delete on public.coach_checkin_reply_drafts to authenticated;
grant all on public.coach_checkin_reply_drafts to service_role;
create policy coach_checkin_reply_draft_owner on public.coach_checkin_reply_drafts for all to authenticated
 using(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.clients c where c.id=coach_checkin_reply_drafts.client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null) and exists(select 1 from public.checkins k where k.id=coach_checkin_reply_drafts.checkin_id and k.client_id=coach_checkin_reply_drafts.client_id))
 with check(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.clients c where c.id=coach_checkin_reply_drafts.client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null) and exists(select 1 from public.checkins k where k.id=coach_checkin_reply_drafts.checkin_id and k.client_id=coach_checkin_reply_drafts.client_id));
create or replace function private.stamp_checkin_reply_draft() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.checkin_id is distinct from old.checkin_id or new.client_id is distinct from old.client_id or new.coach_id is distinct from old.coach_id or new.created_at is distinct from old.created_at then raise exception 'A private reply draft cannot move to another owner or check-in'; end if;
 new.updated_at=now();return new;
end $$;
revoke all on function private.stamp_checkin_reply_draft() from public,anon,authenticated;
create trigger stamp_checkin_reply_draft before update on public.coach_checkin_reply_drafts for each row execute function private.stamp_checkin_reply_draft();

-- Preserve any legacy unapproved content before clearing the public projection.
-- Existing approved app/legacy replies and review timestamps are untouched.
do $$ begin
 if exists(select 1 from public.checkins k join public.clients c on c.id=k.client_id where c.coach_id is null and (k.reviewed_at is null or k.review_channel='whatsapp') and (k.coach_response is not null or k.voice_note_url is not null or k.focus_next_week is not null)) then raise exception 'Unpublished replies need an assigned coach before private migration';end if;
end $$;
insert into public.coach_checkin_reply_drafts(checkin_id,client_id,coach_id,response_text,video_url,action_points)
select k.id,k.client_id,c.coach_id,k.coach_response,k.voice_note_url,k.focus_next_week
from public.checkins k join public.clients c on c.id=k.client_id
where c.coach_id is not null and (k.reviewed_at is null or k.review_channel='whatsapp')
 and (k.coach_response is not null or k.voice_note_url is not null or k.focus_next_week is not null)
on conflict(checkin_id,coach_id) do nothing;
update public.checkins set coach_response=null,voice_note_url=null,focus_next_week=null
where (reviewed_at is null or review_channel='whatsapp')
 and (coach_response is not null or voice_note_url is not null or focus_next_week is not null);
alter table public.checkins add constraint checkins_published_reply_only
 check((reviewed_at is not null and review_channel is distinct from 'whatsapp') or (coach_response is null and voice_note_url is null and focus_next_week is null));
-- Client inserts cannot manufacture any coach reply/publication field.
alter policy checkins_authorized_insert on public.checkins with check (
 (client_id=public.my_client_id() and coach_response is null and voice_note_url is null and focus_next_week is null and reviewed_at is null and review_channel is null)
 or (private.is_coach() and private.can_access_client(client_id))
);

-- This private trigger sanitizes the tuple BEFORE it enters the table or Realtime/WAL.
-- The local publication marker is routing, not authorization: owning-coach RLS and
-- explicit profile/client checks are still required. Clients cannot update check-ins.
create or replace function private.route_checkin_reply() returns trigger language plpgsql security definer set search_path='' as $$
declare assigned_coach uuid;has_reply boolean;reply_changed boolean;publishing boolean;trusted_server boolean;
begin
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.client_id is distinct from old.client_id) then raise exception 'A check-in cannot move to another client or identifier'; end if;
 select c.coach_id into assigned_coach from public.clients c where c.id=new.client_id;
 has_reply:=new.coach_response is not null or new.voice_note_url is not null or new.focus_next_week is not null;
 reply_changed:=tg_op='INSERT';
 if tg_op='UPDATE' then reply_changed:=new.coach_response is distinct from old.coach_response or new.voice_note_url is distinct from old.voice_note_url or new.focus_next_week is distinct from old.focus_next_week;end if;
 trusted_server:=coalesce(current_setting('role',true),'none') in ('none','postgres','service_role','supabase_admin');
 publishing:=coalesce(current_setting('app.checkin_reply_publish',true)=new.id::text,false);
 if publishing then
  if auth.uid() is null or assigned_coach is null or not coalesce(private.is_coach(),false) or auth.uid() is distinct from assigned_coach or not coalesce(private.can_access_client(new.client_id),false) then raise exception 'Assigned coach access required to publish a reply'; end if;
  if new.reviewed_at is null or new.review_channel is distinct from 'app' then raise exception 'Publishing requires an approved app review'; end if;
  return new;
 end if;
 if has_reply and (reply_changed or new.reviewed_at is null or new.review_channel='whatsapp') then
  if assigned_coach is null or not (trusted_server or (auth.uid() is not null and coalesce(private.is_coach(),false) and auth.uid()=assigned_coach and coalesce(private.can_access_client(new.client_id),false))) then raise exception 'Clients cannot create or modify coach reply fields';end if;
  if reply_changed then
   insert into public.coach_checkin_reply_drafts(checkin_id,client_id,coach_id,response_text,video_url,action_points)
   values(new.id,new.client_id,assigned_coach,new.coach_response,new.voice_note_url,new.focus_next_week)
   on conflict(checkin_id,coach_id) do update set response_text=excluded.response_text,video_url=excluded.video_url,action_points=excluded.action_points;
  else
   -- A status-only move must not replace newer private edits with old published text.
   insert into public.coach_checkin_reply_drafts(checkin_id,client_id,coach_id,response_text,video_url,action_points)
   values(new.id,new.client_id,assigned_coach,new.coach_response,new.voice_note_url,new.focus_next_week)
   on conflict(checkin_id,coach_id) do nothing;
  end if;
 end if;
 if new.reviewed_at is null or new.review_channel='whatsapp' or tg_op='INSERT' then
  new.coach_response:=null;new.voice_note_url:=null;new.focus_next_week:=null;
 elsif reply_changed then
  -- Legacy change handlers now save privately and retain the last approved reply.
  new.coach_response:=old.coach_response;new.voice_note_url:=old.voice_note_url;new.focus_next_week:=old.focus_next_week;
 end if;
 return new;
end $$;
revoke all on function private.route_checkin_reply() from public,anon,authenticated;
create trigger route_checkin_reply before insert or update on public.checkins for each row execute function private.route_checkin_reply();

create or replace function public.save_checkin_review(target_checkin_id uuid,response_text text,video_url text,action_points text,mark_reviewed boolean default false)
returns public.checkins language plpgsql security invoker set search_path='' as $$
declare result public.checkins;previous_marker text;
begin
 if auth.uid() is null or not coalesce(private.is_coach(),false) then raise exception 'Only the assigned coach can review a check-in';end if;
 if mark_reviewed is null then raise exception 'Choose draft or published review';end if;
 if length(coalesce(response_text,''))>20000 or length(coalesce(action_points,''))>10000 or length(coalesce(video_url,''))>2048 then raise exception 'Review is too long';end if;
 if mark_reviewed and nullif(trim(video_url),'') is not null and video_url !~ '^https://[^[:space:]]+$' then raise exception 'Use a secure HTTPS video link before publishing';end if;
 if mark_reviewed and nullif(trim(response_text),'') is null and nullif(trim(video_url),'') is null then raise exception 'Add a coach response or video before publishing the review';end if;
 select * into result from public.checkins where id=target_checkin_id and private.can_access_client(client_id) for update;
 if result.id is null then raise exception 'Check-in is unavailable for this coach';end if;
 if not mark_reviewed then
  insert into public.coach_checkin_reply_drafts(checkin_id,client_id,coach_id,response_text,video_url,action_points)
  values(result.id,result.client_id,auth.uid(),nullif(trim(response_text),''),nullif(trim(video_url),''),nullif(trim(action_points),''))
  on conflict(checkin_id,coach_id) do update set response_text=excluded.response_text,video_url=excluded.video_url,action_points=excluded.action_points;
  return result;
 end if;
 previous_marker:=current_setting('app.checkin_reply_publish',true);
 perform set_config('app.checkin_reply_publish',result.id::text,true);
 begin
  update public.checkins set coach_response=nullif(trim(response_text),''),voice_note_url=nullif(trim(video_url),''),focus_next_week=nullif(trim(action_points),''),reviewed_at=now(),review_channel='app'
  where id=result.id returning * into result;
 exception when others then perform set_config('app.checkin_reply_publish',coalesce(previous_marker,''),true);raise;end;
 perform set_config('app.checkin_reply_publish',coalesce(previous_marker,''),true);
 delete from public.coach_checkin_reply_drafts where checkin_id=result.id and coach_id=auth.uid();
 return result;
end $$;
revoke all on function public.save_checkin_review(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.save_checkin_review(uuid,text,text,text,boolean) to authenticated;

create or replace function public.reopen_checkin_review(p_checkin uuid)
returns public.checkins language plpgsql security invoker set search_path='' as $$
declare result public.checkins;
begin
 if auth.uid() is null or not coalesce(private.is_coach(),false) then raise exception 'Only the assigned coach can reopen a review';end if;
 select * into result from public.checkins where id=p_checkin and private.can_access_client(client_id) for update;
 if result.id is null then raise exception 'Check-in is unavailable for this coach';end if;
 if result.coach_response is not null or result.voice_note_url is not null or result.focus_next_week is not null then
  insert into public.coach_checkin_reply_drafts(checkin_id,client_id,coach_id,response_text,video_url,action_points)
  values(result.id,result.client_id,auth.uid(),result.coach_response,result.voice_note_url,result.focus_next_week) on conflict(checkin_id,coach_id) do nothing;
 end if;
 update public.checkins set coach_response=null,voice_note_url=null,focus_next_week=null,reviewed_at=null,review_channel=null where id=result.id returning * into result;
 return result;
end $$;
revoke all on function public.reopen_checkin_review(uuid) from public,anon;
grant execute on function public.reopen_checkin_review(uuid) to authenticated;

create or replace function public.set_checkin_whatsapp_review(p_checkin uuid,p_reviewed boolean default true)
returns public.checkins language plpgsql security invoker set search_path='' as $$
declare result public.checkins;
begin
 if auth.uid() is null or not coalesce(private.is_coach(),false) then raise exception 'Only the assigned coach can review a check-in';end if;
 if p_reviewed is null then raise exception 'Choose whether the WhatsApp review is complete';end if;
 select * into result from public.checkins where id=p_checkin and private.can_access_client(client_id) for update;
 if result.id is null then raise exception 'Check-in is unavailable for this coach';end if;
 if not p_reviewed and result.review_channel is distinct from 'whatsapp' then return result;end if;
 if p_reviewed and (result.coach_response is not null or result.voice_note_url is not null or result.focus_next_week is not null) then
  insert into public.coach_checkin_reply_drafts(checkin_id,client_id,coach_id,response_text,video_url,action_points)
  values(result.id,result.client_id,auth.uid(),result.coach_response,result.voice_note_url,result.focus_next_week) on conflict(checkin_id,coach_id) do nothing;
 end if;
 update public.checkins set coach_response=null,voice_note_url=null,focus_next_week=null,reviewed_at=case when p_reviewed then coalesce(reviewed_at,now()) else null end,review_channel=case when p_reviewed then 'whatsapp' else null end where id=result.id returning * into result;
 return result;
end $$;
revoke all on function public.set_checkin_whatsapp_review(uuid,boolean) from public,anon;
grant execute on function public.set_checkin_whatsapp_review(uuid,boolean) to authenticated;
-- Automatic snapshots and coach exports include private drafts, scoped to their own coach.
create or replace function private.coaching_recovery_bundle(p_coach uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[];tables jsonb:='{}';rows jsonb;t record;begin
 if auth.uid() is not null and (auth.uid()<>p_coach or not coalesce(private.is_coach(),false)) then raise exception 'Assigned coach access required';end if;
 select coalesce(array_agg(id),array[]::uuid[]) into ids from public.clients where coach_id=p_coach and source_system is distinct from 'coach_health_test';
 tables:=jsonb_build_object('clients',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.clients c where id=any(ids)),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.profiles p where id=p_coach or id in(select profile_id from public.clients where id=any(ids))));
 for t in select distinct c.table_name from information_schema.columns c join information_schema.tables it on it.table_schema=c.table_schema and it.table_name=c.table_name
 where c.table_schema='public' and c.column_name='client_id' and it.table_type='BASE TABLE' and c.table_name not in('client_health_ingest_keys','hevy_connections') loop
  if t.table_name in('coach_checkin_reply_drafts','coach_review_briefs') then
   execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where client_id=any($1) and coach_id=$2 and exists(select 1 from public.clients c where c.id=r.client_id and c.coach_id=$2 and c.deleted_at is null)',t.table_name) into rows using ids,p_coach;
  else
   execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where client_id=any($1)',t.table_name) into rows using ids;
  end if;
  tables:=tables||jsonb_build_object(t.table_name,rows);
 end loop;
 for t in select * from (values
 ('daily_plans','select r.* from public.daily_plans r join public.program_weeks w on w.id=r.week_id where w.client_id=any($1)'),
 ('habit_logs','select r.* from public.habit_logs r join public.habits h on h.id=r.habit_id where h.client_id=any($1)'),
 ('meals','select r.* from public.meals r join public.nutrition_days d on d.id=r.nutrition_day_id join public.program_weeks w on w.id=d.week_id where w.client_id=any($1)'),
 ('meal_plan_items','select r.* from public.meal_plan_items r join public.meal_plan_meals m on m.id=r.meal_id join public.nutrition_plans p on p.id=m.nutrition_plan_id where p.client_id=any($1)'),
 ('training_sessions','select r.* from public.training_sessions r join public.program_weeks w on w.id=r.week_id where w.client_id=any($1)'),
 ('exercises','select r.* from public.exercises r join public.training_sessions s on s.id=r.session_id join public.program_weeks w on w.id=s.week_id where w.client_id=any($1)'),
 ('nutrition_days','select r.* from public.nutrition_days r join public.program_weeks w on w.id=r.week_id where w.client_id=any($1)'),
 ('training_program_days','select r.* from public.training_program_days r join public.training_programs p on p.id=r.program_id where p.client_id=any($1)'),
 ('program_exercises','select r.* from public.program_exercises r join public.training_program_days d on d.id=r.program_day_id join public.training_programs p on p.id=d.program_id where p.client_id=any($1)'),
 ('meal_plan_meals','select r.* from public.meal_plan_meals r join public.nutrition_plans p on p.id=r.nutrition_plan_id where p.client_id=any($1)'),
 ('meal_bank','select r.* from public.meal_bank r where r.id in(select meal_id from public.meal_assignments where client_id=any($1))'),
 ('coaching_start_resources','select r.* from public.coaching_start_resources r where coach_id=$2')
 ) as v(name,q) loop
  execute 'select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from ('||t.q||') r' into rows using ids,p_coach;
  tables:=tables||jsonb_build_object(t.name,rows);
 end loop;
 tables:=tables||jsonb_build_object('checkin_revisions',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from app_private.checkin_revisions r where client_id=any(ids)));
 return jsonb_build_object('format','legal-edge-coaching-backup','version',1,'created_at',now(),'coach_id',p_coach,'tables',tables,'exclusions',jsonb_build_array('Authentication passwords and sessions','Provider and device credentials','Uploaded file bytes','Full-project schema and platform settings'));
end $$;

notify pgrst,'reload schema';

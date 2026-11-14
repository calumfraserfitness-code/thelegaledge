-- Private preparation and approved client projection stay in separate collections.
create table public.coach_weekly_recap_drafts (
 client_id uuid not null references public.clients(id) on delete cascade,
 coach_id uuid not null references public.profiles(id) on delete cascade,
 week_start date not null check(extract(isodow from week_start)=1),
 revision integer not null check(revision between 1 and 2147483646),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=60000),
 body text not null check(length(body)<=12000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(client_id,coach_id,week_start)
);
create index coach_weekly_recap_drafts_coach_week on public.coach_weekly_recap_drafts(coach_id,week_start desc);
create table public.client_weekly_recaps (
 client_id uuid not null references public.clients(id) on delete cascade,
 week_start date not null check(extract(isodow from week_start)=1),
 coach_id uuid not null references public.profiles(id) on delete cascade,
 revision integer not null check(revision between 1 and 2147483646),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=60000),
 body text not null check(length(body) between 1 and 12000),
 published_at timestamptz not null default now(),
 primary key(client_id,week_start)
);
create index client_weekly_recaps_coach_week on public.client_weekly_recaps(coach_id,week_start desc);
alter table public.coach_weekly_recap_drafts enable row level security;
alter table public.client_weekly_recaps enable row level security;
revoke all on public.coach_weekly_recap_drafts,public.client_weekly_recaps from public,anon,authenticated;
grant select,insert,update,delete on public.coach_weekly_recap_drafts,public.client_weekly_recaps to authenticated;
grant all on public.coach_weekly_recap_drafts,public.client_weekly_recaps to service_role;
create policy weekly_recap_draft_owner on public.coach_weekly_recap_drafts for all to authenticated
 using(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.clients c where c.id=coach_weekly_recap_drafts.client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null))
 with check(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.clients c where c.id=coach_weekly_recap_drafts.client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null));
create policy weekly_recap_published_read on public.client_weekly_recaps for select to authenticated
 using(private.can_access_client(client_id));
create policy weekly_recap_published_coach_write on public.client_weekly_recaps for all to authenticated
 using(private.is_coach() and exists(select 1 from public.clients c where c.id=client_weekly_recaps.client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null))
 with check(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.clients c where c.id=client_weekly_recaps.client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null));

-- This validator also constructs the public allowlist. Source references, gaps and
-- recorded-session evidence remain private, including through direct table writes.
create or replace function private.weekly_recap_public_payload(p_snapshot jsonb,p_week date,p_timezone text,p_today date,p_publish boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s jsonb;w jsonb;bucket jsonb;item jsonb;field text;part text;count_value numeric;mean_value numeric;day_value date;current_count integer;previous_count integer;status text;
begin
 if jsonb_typeof(p_snapshot) is distinct from 'object' or octet_length(p_snapshot::text)>60000 or p_snapshot->'version' is distinct from '1'::jsonb then raise exception 'Use a valid version 1 weekly recap';end if;
 if p_week is null or extract(isodow from p_week)<>1 or p_week>date_trunc('week',p_today::timestamp)::date then raise exception 'Choose a current or past Monday';end if;
 if p_snapshot->>'period_start' is distinct from to_char(p_week,'YYYY-MM-DD') or p_snapshot->>'period_end' is distinct from to_char(p_week+6,'YYYY-MM-DD') or p_snapshot->>'next_week_start' is distinct from to_char(p_week+7,'YYYY-MM-DD') or p_snapshot->>'next_week_end' is distinct from to_char(p_week+13,'YYYY-MM-DD') then raise exception 'The recap dates do not match the selected week';end if;
 if p_snapshot->>'timezone' is distinct from p_timezone then raise exception 'The client timezone changed. Prepare this recap again';end if;
 if jsonb_typeof(p_snapshot->'in_progress') is distinct from 'boolean' or (p_snapshot->>'in_progress')::boolean is distinct from (p_week=date_trunc('week',p_today::timestamp)::date) then raise exception 'Label the current week as in progress';end if;
 if jsonb_typeof(p_snapshot->'prepared_at') is distinct from 'string' or length(p_snapshot->>'prepared_at')>80 or (p_snapshot->>'prepared_at')!~'^\d{4}-\d{2}-\d{2}T' or (p_snapshot->>'prepared_at')::timestamptz>clock_timestamp()+interval '5 minutes' then raise exception 'Use a valid preparation timestamp';end if;
 foreach field in array array['biggest_win','focus','coach_note'] loop
  if jsonb_typeof(p_snapshot->field) is distinct from 'string' or length(p_snapshot->>field)>(case field when 'biggest_win' then 1500 when 'focus' then 1000 else 2500 end) then raise exception 'Keep the recap win, focus and coach note concise';end if;
 end loop;
 if p_publish and nullif(trim(p_snapshot->>'focus'),'') is null then raise exception 'Add one agreed focus before publishing';end if;
 s:=p_snapshot->'recorded_sessions';
 if jsonb_typeof(s) is distinct from 'object' then raise exception 'Recorded session counts are required';end if;
 foreach field in array array['completed','strength','cardio','other','practice_days','practice_completed_days','practice_exercise_ticks','logged_strength'] loop
  if jsonb_typeof(s->field) is distinct from 'number' then raise exception 'Recorded session counts must be numbers';end if;
  count_value:=(s->>field)::numeric;
  if count_value<0 or count_value>10000 or count_value<>trunc(count_value) or (field in('practice_days','practice_completed_days') and count_value>7) then raise exception 'Recorded session counts are outside the valid range';end if;
 end loop;
 if (s->>'completed')::integer<>(s->>'strength')::integer+(s->>'cardio')::integer+(s->>'other')::integer or (s->>'practice_completed_days')::integer>(s->>'practice_days')::integer then raise exception 'Recorded session counts do not agree';end if;
 if jsonb_typeof(s->'cardio_minutes') is distinct from 'number' or (s->>'cardio_minutes')::numeric<0 or (s->>'cardio_minutes')::numeric>10080 then raise exception 'Recorded cardio minutes are outside the valid range';end if;
 w:=p_snapshot->'weight';
 if jsonb_typeof(w) is distinct from 'object' or jsonb_typeof(w->'enabled') is distinct from 'boolean' or w->'minimum_readings' is distinct from '3'::jsonb or jsonb_typeof(w->'note') is distinct from 'string' or length(w->>'note')>1500 then raise exception 'Use a valid recorded weight summary';end if;
 status:=w->>'status';if status is null or status not in('disabled','insufficient','baseline','trend') then raise exception 'Use a valid weight summary status';end if;
 foreach part in array array['current','previous'] loop
  bucket:=w->part;
  if jsonb_typeof(bucket) is distinct from 'object' or jsonb_typeof(bucket->'count') is distinct from 'number' or jsonb_typeof(bucket->'days') is distinct from 'array' then raise exception 'Use distinct recorded weight days';end if;
  count_value:=(bucket->>'count')::numeric;
  if count_value<0 or count_value>7 or count_value<>trunc(count_value) or count_value<>jsonb_array_length(bucket->'days') or count_value<>(select count(distinct value) from jsonb_array_elements(bucket->'days')) then raise exception 'Use distinct recorded weight days';end if;
  for item in select value from jsonb_array_elements(bucket->'days') loop
   if jsonb_typeof(item) is distinct from 'string' or (item#>>'{}')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Use valid recorded weight dates';end if;
   day_value:=(item#>>'{}')::date;
   if to_char(day_value,'YYYY-MM-DD')<>(item#>>'{}') or day_value>p_today or (part='current' and (day_value<p_week or day_value>p_week+6)) or (part='previous' and (day_value<p_week-7 or day_value>p_week-1)) then raise exception 'Weight dates must match their covered week';end if;
  end loop;
  if count_value=0 then
   if bucket->'average_kg' is distinct from 'null'::jsonb then raise exception 'Missing weight averages must stay unknown';end if;
  else
   if jsonb_typeof(bucket->'average_kg') is distinct from 'number' then raise exception 'Recorded weight averages must be numbers';end if;
   mean_value:=(bucket->>'average_kg')::numeric;if mean_value<0.001 or mean_value>1000 then raise exception 'Recorded weight is outside the valid range';end if;
  end if;
 end loop;
 current_count:=(w->'current'->>'count')::integer;previous_count:=(w->'previous'->>'count')::integer;
 if status='disabled' then
  if (w->>'enabled')::boolean or current_count<>0 or previous_count<>0 then raise exception 'Disabled weight tracking must not publish weight readings';end if;
 elsif not (w->>'enabled')::boolean then raise exception 'Weight tracking status does not agree';
 elsif status='trend' and (current_count<3 or previous_count<3) then raise exception 'A weight trend requires three recorded days in each week';
 elsif status='baseline' and (current_count<3 or previous_count>=3) then raise exception 'Use a baseline until both weeks have enough readings';
 elsif status='insufficient' and current_count>=3 then raise exception 'Weight summary status does not agree';end if;
 if status='trend' then
  if jsonb_typeof(w->'change_kg') is distinct from 'number' or abs((w->>'change_kg')::numeric-((w->'current'->>'average_kg')::numeric-(w->'previous'->>'average_kg')::numeric))>0.05 then raise exception 'The weight change must match the two weekly averages';end if;
 elsif w->'change_kg' is distinct from 'null'::jsonb then raise exception 'Do not infer a weight trend without enough readings';end if;
 if jsonb_typeof(w->'conflict_dates') is distinct from 'array' or jsonb_array_length(w->'conflict_dates')>14 then raise exception 'Use valid recorded weight conflict dates';end if;
 for item in select value from jsonb_array_elements(w->'conflict_dates') loop
  if jsonb_typeof(item) is distinct from 'string' or (item#>>'{}')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Use valid recorded weight conflict dates';end if;
  day_value:=(item#>>'{}')::date;if day_value<p_week-7 or day_value>p_week+6 or day_value>p_today then raise exception 'Weight conflict dates must match the covered weeks';end if;
 end loop;
 return jsonb_build_object('version',1,'period_start',p_snapshot->'period_start','period_end',p_snapshot->'period_end','next_week_start',p_snapshot->'next_week_start','next_week_end',p_snapshot->'next_week_end','timezone',p_snapshot->'timezone','prepared_at',p_snapshot->'prepared_at','in_progress',p_snapshot->'in_progress',
 'recorded_sessions',jsonb_build_object('completed',s->'completed','strength',s->'strength','cardio',s->'cardio','other',s->'other','cardio_minutes',s->'cardio_minutes','practice_days',s->'practice_days','practice_completed_days',s->'practice_completed_days','practice_exercise_ticks',s->'practice_exercise_ticks','logged_strength',s->'logged_strength'),
 'weight',jsonb_build_object('enabled',w->'enabled','status',w->'status','minimum_readings',3,'current',jsonb_build_object('count',w->'current'->'count','days',w->'current'->'days','average_kg',w->'current'->'average_kg'),'previous',jsonb_build_object('count',w->'previous'->'count','days',w->'previous'->'days','average_kg',w->'previous'->'average_kg'),'change_kg',w->'change_kg','conflict_dates',w->'conflict_dates','note',w->'note'),
 'biggest_win',trim(p_snapshot->>'biggest_win'),'focus',trim(p_snapshot->>'focus'),'coach_note',trim(p_snapshot->>'coach_note'));
end $$;
revoke all on function private.weekly_recap_public_payload(jsonb,date,text,date,boolean) from public,anon;
grant execute on function private.weekly_recap_public_payload(jsonb,date,text,date,boolean) to authenticated;

create or replace function private.stamp_weekly_recap() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.clients;zone text;today date;
begin
 if tg_op='UPDATE' and (new.client_id is distinct from old.client_id or new.week_start is distinct from old.week_start) then raise exception 'A recap cannot move to another client or week';end if;
 if tg_table_name='coach_weekly_recap_drafts' then
  if tg_op='UPDATE' and (new.coach_id is distinct from old.coach_id or new.created_at is distinct from old.created_at) then raise exception 'A private recap cannot change owner';end if;
  new.updated_at:=clock_timestamp();
 else
  select * into c from public.clients where id=new.client_id;
  zone:=coalesce(c.timezone,'Europe/Dublin');today:=(now() at time zone zone)::date;
  new.payload:=private.weekly_recap_public_payload(new.payload,new.week_start,zone,today,true);
  if c.track_weight is false and (new.payload->'weight'->>'enabled')::boolean then raise exception 'Weight tracking is disabled. Prepare this recap again';end if;
  new.published_at:=clock_timestamp();
 end if;
 return new;
end $$;
revoke all on function private.stamp_weekly_recap() from public,anon,authenticated;
create trigger stamp_weekly_recap_draft before update on public.coach_weekly_recap_drafts for each row execute function private.stamp_weekly_recap();
create trigger stamp_weekly_recap_publication before insert or update on public.client_weekly_recaps for each row execute function private.stamp_weekly_recap();

create or replace function public.save_weekly_recap(p_client uuid,p_week_start date,p_snapshot jsonb,p_body text,p_expected_version integer,p_publish boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.clients;d public.coach_weekly_recap_drafts;publication public.client_weekly_recaps;current_version integer;next_version integer;approved jsonb;zone text;today date;
begin
 if auth.uid() is null or not coalesce(private.is_coach(),false) then raise exception 'Only the assigned coach can prepare a weekly recap';end if;
 select * into c from public.clients where id=p_client and coach_id=auth.uid() and deleted_at is null;
 if c.id is null then raise exception 'Assigned client access required';end if;
 if p_publish is null or p_expected_version is null or p_expected_version<0 then raise exception 'Choose draft or publish with the current recap version';end if;
 if p_body is null or length(p_body)>12000 or (p_publish and nullif(trim(p_body),'') is null) then raise exception 'Keep the recap concise';end if;
 zone:=coalesce(c.timezone,'Europe/Dublin');today:=(now() at time zone zone)::date;
 approved:=private.weekly_recap_public_payload(p_snapshot,p_week_start,zone,today,p_publish);
 if c.track_weight is false and (approved->'weight'->>'enabled')::boolean then raise exception 'Weight tracking is disabled. Prepare this recap again';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client::text||':weekly-recap:'||p_week_start::text,0));
 select * into d from public.coach_weekly_recap_drafts where client_id=p_client and coach_id=auth.uid() and week_start=p_week_start for update;
 select * into publication from public.client_weekly_recaps where client_id=p_client and week_start=p_week_start for update;
 current_version:=greatest(coalesce(d.revision,0),coalesce(publication.revision,0));
 if p_expected_version<>current_version then raise exception 'This recap changed elsewhere. Your edits are kept; reload before replacing the saved version';end if;
 if current_version>=2147483646 then raise exception 'This recap version cannot be updated';end if;next_version:=current_version+1;
 if p_publish then
  insert into public.client_weekly_recaps(client_id,week_start,coach_id,revision,payload,body)
  values(p_client,p_week_start,auth.uid(),next_version,approved,trim(p_body))
  on conflict(client_id,week_start) do update set coach_id=excluded.coach_id,revision=excluded.revision,payload=excluded.payload,body=excluded.body returning * into publication;
  delete from public.coach_weekly_recap_drafts where client_id=p_client and coach_id=auth.uid() and week_start=p_week_start;
  return jsonb_build_object('draft',null,'publication',to_jsonb(publication));
 end if;
 insert into public.coach_weekly_recap_drafts(client_id,coach_id,week_start,revision,payload,body)
 values(p_client,auth.uid(),p_week_start,next_version,p_snapshot,p_body)
 on conflict(client_id,coach_id,week_start) do update set revision=excluded.revision,payload=excluded.payload,body=excluded.body returning * into d;
 return jsonb_build_object('draft',to_jsonb(d),'publication',case when publication.client_id is null then null else to_jsonb(publication) end);
end $$;
revoke all on function public.save_weekly_recap(uuid,date,jsonb,text,integer,boolean) from public,anon;
grant execute on function public.save_weekly_recap(uuid,date,jsonb,text,integer,boolean) to authenticated;

-- Include only this coach’s private recap preparation in recovery exports.
create or replace function private.coaching_recovery_bundle(p_coach uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[];tables jsonb:='{}';rows jsonb;t record;begin
 if auth.uid() is not null and (auth.uid()<>p_coach or not coalesce(private.is_coach(),false)) then raise exception 'Assigned coach access required';end if;
 select coalesce(array_agg(id),array[]::uuid[]) into ids from public.clients where coach_id=p_coach and source_system is distinct from 'coach_health_test';
 tables:=jsonb_build_object('clients',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.clients c where id=any(ids)),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.profiles p where id=p_coach or id in(select profile_id from public.clients where id=any(ids))));
 for t in select distinct c.table_name from information_schema.columns c join information_schema.tables it on it.table_schema=c.table_schema and it.table_name=c.table_name
 where c.table_schema='public' and c.column_name='client_id' and it.table_type='BASE TABLE' and c.table_name not in('client_health_ingest_keys','hevy_connections') loop
  if t.table_name in('coach_checkin_reply_drafts','coach_review_briefs','coach_weekly_recap_drafts') then
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

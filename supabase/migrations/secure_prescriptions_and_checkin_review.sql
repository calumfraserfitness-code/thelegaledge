
-- Preserve all records. Scope private coaching data to the assigned coach.
alter policy checkins_select on public.checkins using (private.can_access_client(client_id));
alter policy checkins_coach_update on public.checkins
 using (private.is_coach() and private.can_access_client(client_id))
 with check (private.is_coach() and private.can_access_client(client_id));
alter policy checkins_authorized_insert on public.checkins with check (
 (client_id=public.my_client_id() and coach_response is null and voice_note_url is null and reviewed_at is null)
 or (private.is_coach() and private.can_access_client(client_id))
);
-- A self-service profile update must never change authorization or login identity.
revoke update on public.profiles from authenticated, anon;
revoke update(id,role,email,created_at,updated_at) on public.profiles from authenticated, anon;
grant update(full_name,avatar_url) on public.profiles to authenticated;
-- Read prescribed plans; only a coach can mutate them.
do $$
declare r record; predicate text;
begin
 for r in select tablename,policyname,qual from pg_policies
 where schemaname='public' and cmd='ALL'
 and tablename in ('training_programs','training_program_days','program_exercises','nutrition_plans','meal_plan_meals','meal_plan_items')
 loop
  execute format('drop policy %I on public.%I',r.policyname,r.tablename);
  execute format('create policy %I on public.%I for select to authenticated using (%s)',r.policyname,r.tablename,r.qual);
  predicate := '('||r.qual||') and private.is_coach()';
  if r.tablename='training_programs' then
   predicate:=predicate||' and (client_id is not null or created_by=(select auth.uid()))';
  elsif r.tablename='training_program_days' then
   predicate:=predicate||' and exists(select 1 from public.training_programs p where p.id=program_id and (p.client_id is not null or p.created_by=(select auth.uid())))';
  elsif r.tablename='program_exercises' then
   predicate:=predicate||' and exists(select 1 from public.training_program_days d join public.training_programs p on p.id=d.program_id where d.id=program_day_id and (p.client_id is not null or p.created_by=(select auth.uid())))';
  end if;
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)',r.tablename||'_coach_insert',r.tablename,predicate);
  execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',r.tablename||'_coach_update',r.tablename,predicate,predicate);
  execute format('create policy %I on public.%I for delete to authenticated using (%s)',r.tablename||'_coach_delete',r.tablename,predicate);
 end loop;
end $$;
create index if not exists checkins_pending_review_client_date on public.checkins(client_id,submitted_at desc) where reviewed_at is null;
create or replace function public.save_checkin_review(target_checkin_id uuid,response_text text,video_url text,action_points text,mark_reviewed boolean default false)
returns public.checkins language plpgsql security invoker set search_path='' as $$
declare result public.checkins;
begin
 if not private.is_coach() then raise exception 'Only the assigned coach can review a check-in'; end if;
 if length(coalesce(response_text,''))>20000 or length(coalesce(action_points,''))>10000 then raise exception 'Review is too long'; end if;
 if nullif(trim(video_url),'') is not null and video_url !~ '^https://' then raise exception 'Use a secure HTTPS video link'; end if;
 if mark_reviewed and nullif(trim(response_text),'') is null and nullif(trim(video_url),'') is null then raise exception 'Add a coach response or video before completing the review'; end if;
 update public.checkins set coach_response=nullif(trim(response_text),''),voice_note_url=nullif(trim(video_url),''),focus_next_week=nullif(trim(action_points),''),
 reviewed_at=case when mark_reviewed then now() else null end
 where id=target_checkin_id and private.can_access_client(client_id) returning * into result;
 if result.id is null then raise exception 'Check-in is unavailable for this coach'; end if;
 return result;
end $$;
revoke all on function public.save_checkin_review(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.save_checkin_review(uuid,text,text,text,boolean) to authenticated;

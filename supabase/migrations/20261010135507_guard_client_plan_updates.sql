-- Clients log completion and schedule within their week; prescriptions stay coach-owned.
alter policy exercises_update on public.exercises
 using ((select private.is_coach()) and exists (
  select 1 from public.training_sessions s join public.program_weeks w on w.id=s.week_id
  where s.id=exercises.session_id and (select private.can_access_client(w.client_id))))
 with check ((select private.is_coach()) and exists (
  select 1 from public.training_sessions s join public.program_weeks w on w.id=s.week_id
  where s.id=exercises.session_id and (select private.can_access_client(w.client_id))));
create function private.guard_client_plan_update() returns trigger
language plpgsql set search_path='' as $$
declare allowed text[];
begin
 if auth.uid() is null or private.is_coach() then return new;end if;
 allowed:=case when tg_table_name='training_sessions' then
  array['status','completed_at','session_date','scheduled_time','schedule_timezone','moved_from_date','updated_at']
  else array['adhered','updated_at'] end;
 if (to_jsonb(new)-allowed) is distinct from (to_jsonb(old)-allowed) then
  raise exception 'Only your coach can edit prescribed plan details' using errcode='42501';
 end if;
 if tg_table_name='training_sessions' and new.session_date is distinct from old.session_date then
  if old.status='completed' or not exists(select 1 from public.program_weeks w
   where w.id=new.week_id and new.session_date between w.week_start and w.week_start+6) then
   raise exception 'Choose a date in your published week' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_client_plan_update() from public,anon,authenticated;
create trigger guard_client_session_update before update on public.training_sessions
 for each row execute function private.guard_client_plan_update();
create trigger guard_client_nutrition_day_update before update on public.nutrition_days
 for each row execute function private.guard_client_plan_update();

alter table public.clients add column if not exists weekly_weigh_in_minimum smallint check (weekly_weigh_in_minimum between 2 and 3);

CREATE OR REPLACE FUNCTION private.guard_client_plan_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare allowed text[];
begin
 if auth.uid() is null or private.is_coach() then return new;end if;
 allowed:=case when tg_table_name='training_sessions' then array['status','completed_at','session_date','scheduled_time','schedule_timezone','moved_from_date','updated_at'] else array['adhered','updated_at'] end;
 if tg_table_name='training_sessions' then
  if (new.programme_day_id is distinct from old.programme_day_id or new.title is distinct from old.title)
   and old.status='planned' and new.status=old.status
   and not exists(select 1 from public.exercise_set_logs l where l.training_session_id=old.id)
   and exists(select 1 from public.program_weeks w where w.id=old.week_id and w.published and private.can_access_client(w.client_id)
    and not exists(select 1 from public.client_busy_weeks b where b.client_id=w.client_id and b.week_start=w.week_start and b.health<>'none')
    and (
     exists(select 1 from public.client_busy_week_settings cfg join public.training_program_days d on d.id=new.programme_day_id join public.training_programs p on p.id=d.program_id
       where cfg.client_id=w.client_id and cfg.published and new.programme_day_id in (cfg.home_day_id,cfg.hotel_day_id,cfg.heavy_day_a,cfg.heavy_day_b) and p.client_id=w.client_id and d.title=new.title and d.training_type in ('weights','resistance') and new.training_type in ('weights','resistance'))
     or exists(select 1 from public.training_program_days d join public.training_programs p on p.id=d.program_id
       where d.id=new.programme_day_id and d.title=new.title and d.training_type in ('weights','resistance') and new.training_type in ('weights','resistance')
       and p.client_id=w.client_id and p.status='active'
       and d.id::text in (old.source_metadata #>> '{gym_days,planet}',old.source_metadata #>> '{gym_days,edge}'))
     or exists(select 1 from public.busy_week_session_swaps swap where swap.session_id=old.id and swap.client_id=w.client_id and swap.original_day_id is not distinct from new.programme_day_id and swap.original_title=new.title)
    )) then allowed:=allowed||array['programme_day_id','title'];
  end if;
 end if;
 if tg_table_name='training_sessions' and current_setting('legal_edge.completion_write',true)=old.id::text||':'||auth.uid()::text then
  if (coalesce(new.source_metadata,'{}'::jsonb)-array['completion_receipt','practice_days','practice_baseline','cardio_log']) is distinct from (coalesce(old.source_metadata,'{}'::jsonb)-array['completion_receipt','practice_days','practice_baseline','cardio_log']) then raise exception 'Prescription metadata cannot be changed';end if;
  if new.source_metadata#>>'{completion_receipt,actor_id}' is distinct from auth.uid()::text or new.source_metadata#>>'{completion_receipt,actor_role}' is distinct from 'client' then raise exception 'Completion actor mismatch';end if;
  allowed:=allowed||array['source_metadata'];
 end if;
 if (to_jsonb(new)-allowed) is distinct from (to_jsonb(old)-allowed) then raise exception 'Only your coach can edit prescribed plan details' using errcode='42501';end if;
 if tg_table_name='training_sessions' and new.session_date is distinct from old.session_date then
  if old.status='completed' or not exists(select 1 from public.program_weeks w where w.id=new.week_id and new.session_date between w.week_start and w.week_start+6) then raise exception 'Choose a date in your published week' using errcode='42501';end if;
 end if;
 return new;
end $function$
;

create or replace function public.select_workout_gym(p_week uuid,p_gym text,p_session uuid default null)
returns setof public.training_sessions
language plpgsql security invoker set search_path='' as $$
declare s public.training_sessions%rowtype; d public.training_program_days%rowtype; chosen int:=0;
begin
 if p_gym is null or p_gym not in ('planet','edge') then raise exception 'Choose one of the assigned gyms'; end if;
 if not exists(select 1 from public.program_weeks w join public.clients c on c.id=w.client_id where w.id=p_week and w.published and c.profile_id=auth.uid() and c.portal_enabled and c.deleted_at is null) then raise exception 'Your published week is required' using errcode='42501'; end if;
 for s in select * from public.training_sessions where week_id=p_week and (p_session is null or id=p_session) and training_type in ('weights','resistance') and source_metadata->'gym_days' ? p_gym order by id for update loop
  select day.* into d from public.training_program_days day join public.training_programs p on p.id=day.program_id join public.program_weeks w on w.client_id=p.client_id where w.id=p_week and p.status='active' and day.id::text=s.source_metadata->'gym_days'->>p_gym and day.training_type in ('weights','resistance');
  if not found then raise exception 'The workout for that gym is unavailable'; end if;
  if s.programme_day_id is distinct from d.id then
   if s.status<>'planned' or exists(select 1 from public.exercise_set_logs l where l.training_session_id=s.id) then raise exception 'A workout with saved activity cannot change gyms. Choose the gym for your remaining workout instead.'; end if;
   update public.training_sessions set programme_day_id=d.id,title=d.title,updated_at=now() where id=s.id returning * into s;
  end if;
  chosen:=chosen+1;return next s;
 end loop;
 if chosen=0 then raise exception 'No gym choices are assigned to this workout'; end if;
end $$;
revoke all on function public.select_workout_gym(uuid,text,uuid) from public,anon;
grant execute on function public.select_workout_gym(uuid,text,uuid) to authenticated;

-- Preserve prescribed-plan protection; allow only the assigned coach's published alternatives.
create or replace function private.guard_client_plan_update() returns trigger language plpgsql security invoker set search_path='' as $$
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
       where cfg.client_id=w.client_id and cfg.published and new.programme_day_id in (cfg.home_day_id,cfg.hotel_day_id) and p.client_id=w.client_id and d.title=new.title and d.training_type=new.training_type)
     or exists(select 1 from public.busy_week_session_swaps swap where swap.session_id=old.id and swap.client_id=w.client_id and swap.original_day_id is not distinct from new.programme_day_id and swap.original_title=new.title)
    )) then allowed:=allowed||array['programme_day_id','title'];
  end if;
 end if;
 if (to_jsonb(new)-allowed) is distinct from (to_jsonb(old)-allowed) then raise exception 'Only your coach can edit prescribed plan details' using errcode='42501';end if;
 if tg_table_name='training_sessions' and new.session_date is distinct from old.session_date then
  if old.status='completed' or not exists(select 1 from public.program_weeks w where w.id=new.week_id and new.session_date between w.week_start and w.week_start+6) then raise exception 'Choose a date in your published week' using errcode='42501';end if;
 end if;
 return new;
end $$;

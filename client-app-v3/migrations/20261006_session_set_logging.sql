alter table public.exercise_set_logs add column if not exists training_session_id uuid references public.training_sessions(id);
create unique index if not exists exercise_set_logs_session_set_key on public.exercise_set_logs(client_id,training_session_id,program_exercise_id,set_number);
create or replace function private.validate_exercise_session() returns trigger language plpgsql set search_path='' as $$
begin
 if new.program_exercise_id is not null and not exists(select 1 from public.program_exercises e join public.training_program_days d on d.id=e.program_day_id join public.training_programs p on p.id=d.program_id where e.id=new.program_exercise_id and p.client_id=new.client_id) then raise exception 'Exercise must belong to this client' using errcode='42501';end if;
 if new.training_session_id is not null and not exists(
  select 1 from public.training_sessions s join public.program_weeks w on w.id=s.week_id
  join public.program_exercises e on e.program_day_id=s.programme_day_id
  where s.id=new.training_session_id and w.client_id=new.client_id and e.id=new.program_exercise_id
 ) then raise exception 'Exercise must belong to this client workout' using errcode='42501';end if;
 return new;
end $$;
create trigger validate_exercise_session before insert or update on public.exercise_set_logs for each row execute function private.validate_exercise_session();

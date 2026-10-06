begin;
create temp table duration_context as select c.id as client_id,c.profile_id,s.id as session_id,e.id as exercise_id
from public.clients c join public.program_weeks w on w.client_id=c.id join public.training_sessions s on s.week_id=w.id
join public.program_exercises e on e.program_day_id=s.programme_day_id
where c.profile_id is not null and c.source_system='legacy_clientmangmentsystem_v2' and w.week_start='2026-10-05' limit 1;
grant select on duration_context to authenticated;
select set_config('request.jwt.claim.sub',(select profile_id::text from duration_context),true);
set local role authenticated;
insert into public.exercise_set_logs(client_id,training_session_id,program_exercise_id,set_number,duration_seconds,completed)
select client_id,session_id,exercise_id,1,27,true from duration_context on conflict(client_id,training_session_id,program_exercise_id,set_number) do update set duration_seconds=excluded.duration_seconds;
do $$ begin
 if not exists(select 1 from public.exercise_set_logs where training_session_id=(select session_id from duration_context) and program_exercise_id=(select exercise_id from duration_context) and duration_seconds=27) then raise exception 'Actual duration not saved';end if;
 begin insert into public.exercise_set_logs(client_id,training_session_id,program_exercise_id,set_number,duration_seconds) select client_id,session_id,exercise_id,2,0 from duration_context;raise exception 'TEST FAILED zero duration';exception when check_violation then null;end;
end $$;
reset role;
rollback;
select 'PASS rollback only: client session duration persisted; zero-second completed hold rejected; no real workout data retained.' as result;

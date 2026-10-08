-- Production QA uses real prescriptions inside a rolled-back transaction.
-- Choose an unlogged current published exercise with approved equipment alternatives.
begin;
create temporary table swap_qa as select c.id as client_id,c.profile_id,s.id as session_id,e.id as exercise_id,trim(split_part(e.alternatives,'|',2)) as alternative,e.name
 from public.clients c join public.program_weeks w on w.client_id=c.id join public.training_sessions s on s.week_id=w.id join public.program_exercises e on e.program_day_id=s.programme_day_id
 where c.status in ('active','ending') and w.published and w.week_start=date_trunc('week',current_date)::date and e.alternatives like '%|%' and not exists(select 1 from public.exercise_set_logs l where l.training_session_id=s.id and l.program_exercise_id=e.id) limit 1;
grant select on swap_qa to authenticated;
select set_config('request.jwt.claim.sub',(select profile_id::text from swap_qa),true);
set local role authenticated;
insert into public.session_exercise_choices(client_id,training_session_id,program_exercise_id,exercise_name) select client_id,session_id,exercise_id,alternative from swap_qa;
do $$ begin
 begin update public.session_exercise_choices set exercise_name='Unapproved exercise';raise exception 'Unapproved switch accepted';exception when insufficient_privilege then null;end;
end $$;
insert into public.exercise_set_logs(client_id,training_session_id,program_exercise_id,set_number,reps,load,load_unit,completed,exercise_name) select client_id,session_id,exercise_id,1,8,20,'lb',true,'Spoofed name' from swap_qa;
do $$ begin
 if (select l.exercise_name from public.exercise_set_logs l join swap_qa q on q.session_id=l.training_session_id and q.exercise_id=l.program_exercise_id limit 1)<>(select alternative from swap_qa) then raise exception 'Actual movement snapshot failed';end if;
 begin update public.session_exercise_choices set exercise_name=(select name from swap_qa);raise exception 'Logged exercise switch accepted';exception when raise_exception then if sqlerrm='Logged exercise switch accepted' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
do $$ begin if exists(select 1 from public.session_exercise_choices) then raise exception 'Foreign choices visible';end if;end $$;
rollback;

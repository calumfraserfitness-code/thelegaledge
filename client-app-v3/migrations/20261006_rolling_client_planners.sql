create or replace function public.ensure_client_week(p_client_id uuid,p_start date)
returns uuid language plpgsql set search_path='' as $$
declare c public.clients%rowtype; w public.program_weeks%rowtype; src public.program_weeks%rowtype; d date;
begin
select * into c from public.clients where id=p_client_id and status in ('active','ending') and profile_id is not null;
if not found then raise exception 'Current linked client required';end if;
if current_user<>'postgres' and (not private.is_coach() or c.coach_id<>auth.uid()) then raise exception 'Assigned coach required' using errcode='42501';end if;
if extract(isodow from p_start)<>1 then raise exception 'Week must start on Monday';end if;
perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_id::text||p_start::text,0));
select * into w from public.program_weeks where client_id=p_client_id and week_start=p_start;
if w.id is null then
 select * into src from public.program_weeks where client_id=p_client_id and published and week_start<p_start order by week_start desc limit 1;
 insert into public.program_weeks(client_id,week_start,week_number,title,published,published_at,copied_from_week_id,goal_weight_kg)
 values(p_client_id,p_start,coalesce(src.week_number,0)+case when src.id is null then 1 else (p_start-src.week_start)/7 end,'Weekly coaching plan',true,now(),src.id,c.goal_weight_kg) returning * into w;
 if src.id is not null then
  insert into public.training_sessions(week_id,session_date,training_type,title,notes,target_value,target_unit,sort_order,status,programme_day_id,duration_minutes,distance_km,pace,heart_rate_target,zone,scheduled_time)
  select w.id,p_start+mod((coalesce(s.moved_from_date,s.session_date)-src.week_start+700),7),s.training_type,s.title,s.notes,s.target_value,s.target_unit,s.sort_order,'planned',s.programme_day_id,s.duration_minutes,s.distance_km,s.pace,s.heart_rate_target,s.zone,s.scheduled_time
  from public.training_sessions s where s.week_id=src.id and s.title !~* '^\s*(home backup sessions|4.day\s+home routine)$';
 else
  insert into public.training_sessions(week_id,session_date,training_type,title,sort_order,status,programme_day_id)
  select w.id,p_start+mod(d.day_index,7),d.training_type,d.title,d.day_index,'planned',d.id
  from public.training_program_days d join public.training_programs p on p.id=d.program_id
  where p.client_id=p_client_id and p.status='active' and (exists(select 1 from public.program_exercises e where e.program_day_id=d.id) or d.training_type in ('cardio','mobility','recovery'));
 end if;
end if;
perform public.assign_client_week_nutrition(p_client_id,w.id);
for d in select generate_series(p_start,p_start+6,'1 day')::date loop
 insert into public.daily_plans(week_id,plan_date,published) values(w.id,d,true) on conflict(week_id,plan_date) do nothing;
 insert into public.step_entries(client_id,entry_date,target_steps,actual_steps,source)
 values(p_client_id,d,coalesce(nullif(c.daily_steps_goal,0),8000),null,'weekly_plan') on conflict(client_id,entry_date) do nothing;
end loop;
return w.id;
end $$;
revoke all on function public.ensure_client_week(uuid,date) from public,anon;
grant execute on function public.ensure_client_week(uuid,date) to authenticated,service_role;
select cron.unschedule(jobid) from cron.job where jobname='legal-edge-weekly-drafts';
select cron.schedule('legal-edge-rolling-planners','10 * * * *',$job$
select public.ensure_client_week(c.id,((now() at time zone c.timezone)::date-extract(isodow from (now() at time zone c.timezone))::int+1)+offsets.n*7)
from public.clients c cross join (values(0),(1)) as offsets(n)
where c.status in ('active','ending') and c.profile_id is not null and c.portal_enabled and c.plan_status='published' and c.source_system<>'coach_health_test'
$job$);

create or replace function public.save_busy_week_plan(p_client uuid,p_week date,p_values jsonb,p_expected timestamptz default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.client_busy_weeks;cfg public.client_busy_week_settings;s record;changed jsonb:='[]';item public.training_sessions;remaining integer;slot integer:=0;
begin
 r:=public.save_busy_week(p_client,p_week,p_values,p_expected);
 select * into cfg from public.client_busy_week_settings where client_id=p_client;
 if r.mode='heavy' and cfg.published and cfg.heavy_day_a is not null and cfg.heavy_day_b is not null then
  select greatest(0,least(2,r.training_windows,cfg.heavy_sessions)-count(*))::int into remaining from public.training_sessions ts join public.program_weeks w on w.id=ts.week_id where w.client_id=p_client and w.week_start=p_week and ts.status='completed' and ts.training_type in ('weights','resistance');
  for s in select ts.id from public.training_sessions ts join public.program_weeks w on w.id=ts.week_id where w.client_id=p_client and w.week_start=p_week and w.published and ts.status='planned' and ts.training_type in ('weights','resistance') and not exists(select 1 from public.exercise_set_logs l where l.training_session_id=ts.id) order by ts.session_date,ts.id limit remaining loop
   item:=public.use_busy_week_workout(s.id,case when slot=0 then 'heavy_a' else 'heavy_b' end);changed:=changed||jsonb_build_array(to_jsonb(item));slot:=slot+1;
  end loop;
 end if;
 if r.mode='normal' and r.location='gym' and not r.travel then
  for s in select ts.id from public.training_sessions ts join public.program_weeks w on w.id=ts.week_id join public.busy_week_session_swaps sw on sw.session_id=ts.id where w.client_id=p_client and w.week_start=p_week and w.published and ts.status='planned' and ts.programme_day_id in (cfg.heavy_day_a,cfg.heavy_day_b) and not exists(select 1 from public.exercise_set_logs l where l.training_session_id=ts.id) loop
   item:=public.use_busy_week_workout(s.id,'original');changed:=changed||jsonb_build_array(to_jsonb(item));
  end loop;
 end if;
 return to_jsonb(r)||jsonb_build_object('adapted_sessions',changed,'workout_swaps',coalesce((select jsonb_agg(to_jsonb(sw)) from public.busy_week_session_swaps sw join public.training_sessions ts on ts.id=sw.session_id join public.program_weeks w on w.id=ts.week_id where sw.client_id=p_client and w.week_start=p_week),'[]'::jsonb));
end $$;
revoke all on function public.save_busy_week_plan(uuid,date,jsonb,timestamptz) from public,anon;
grant execute on function public.save_busy_week_plan(uuid,date,jsonb,timestamptz) to authenticated;

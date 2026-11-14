create or replace function private.coaching_recovery_bundle(p_coach uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[];tables jsonb:='{}';rows jsonb;t record;begin
 if auth.uid() is not null and (auth.uid()<>p_coach or not private.is_coach()) then raise exception 'Assigned coach access required';end if;
 select coalesce(array_agg(id),array[]::uuid[]) into ids from public.clients where coach_id=p_coach and source_system is distinct from 'coach_health_test';
 tables:=jsonb_build_object('clients',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.clients c where id=any(ids)),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.profiles p where id=p_coach or id in(select profile_id from public.clients where id=any(ids))));
 for t in select distinct c.table_name from information_schema.columns c join information_schema.tables it on it.table_schema=c.table_schema and it.table_name=c.table_name
 where c.table_schema='public' and c.column_name='client_id' and it.table_type='BASE TABLE' and c.table_name not in('client_health_ingest_keys','hevy_connections') loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where client_id=any($1)',t.table_name) into rows using ids;
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

select private.snapshot_coaching_backups();

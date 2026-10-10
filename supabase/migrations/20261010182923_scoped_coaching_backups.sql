create table app_private.coaching_backup_snapshots(coach_id uuid not null,backup_date date not null,payload jsonb not null,sha256 text not null,created_at timestamptz not null default now(),primary key(coach_id,backup_date));
alter table app_private.coaching_backup_snapshots enable row level security;
revoke all on app_private.coaching_backup_snapshots from public,anon,authenticated;
create function private.coaching_recovery_bundle(p_coach uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
revoke all on function private.coaching_recovery_bundle(uuid) from public,anon;grant execute on function private.coaching_recovery_bundle(uuid) to authenticated,service_role;
create function public.export_coaching_backup() returns jsonb language plpgsql security invoker set search_path='' as $$begin if auth.uid() is null or not private.is_coach() then raise exception 'Coach access required';end if;return private.coaching_recovery_bundle(auth.uid());end$$;
revoke all on function public.export_coaching_backup() from public,anon;grant execute on function public.export_coaching_backup() to authenticated;
create function private.snapshot_coaching_backups() returns void language plpgsql security definer set search_path='' as $$
declare c record;bundle jsonb;begin
 for c in select distinct coach_id from public.clients where coach_id is not null loop
  bundle:=private.coaching_recovery_bundle(c.coach_id);
  insert into app_private.coaching_backup_snapshots(coach_id,backup_date,payload,sha256) values(c.coach_id,current_date,bundle,encode(extensions.digest(bundle::text,'sha256'),'hex'))
  on conflict(coach_id,backup_date) do update set payload=excluded.payload,sha256=excluded.sha256,created_at=now();
 end loop;
end $$;
revoke all on function private.snapshot_coaching_backups() from public,anon,authenticated;
select private.snapshot_coaching_backups();
select cron.schedule('legal-edge-daily-coaching-backup','15 3 * * *','select private.snapshot_coaching_backups()');

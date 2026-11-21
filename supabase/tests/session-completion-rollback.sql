begin;
create temporary table completion_fixture as
 select c.id client_id,c.profile_id,c.coach_id,w.id week_id,gen_random_uuid() practice_id,gen_random_uuid() workout_id,gen_random_uuid() cardio_id,
 (select c2.profile_id from public.clients c2 where c2.profile_id is not null and c2.profile_id<>c.profile_id and c2.coach_id=c.coach_id limit 1) peer_id,
 (now() at time zone c.timezone)::date local_day
 from public.clients c join public.program_weeks w on w.client_id=c.id
 where c.coach_id='56bd942e-7baa-42d3-a9c3-5eedcb33f1db' and c.profile_id is not null and c.portal_enabled and c.deleted_at is null
 and w.published and (now() at time zone c.timezone)::date between w.week_start and w.week_start+6
 order by c.display_name limit 1;
do $$begin if not exists(select 1 from completion_fixture) then raise exception 'No eligible test fixture'; end if;end$$;
grant select on completion_fixture to authenticated;
insert into public.training_sessions(id,week_id,session_date,training_type,title,status,source_metadata)
 select practice_id,week_id,local_day,'mobility'::public.training_type,'Temporary completion verification','planned'::public.item_status,jsonb_build_object('practice_days',jsonb_build_object((local_day-1)::text,jsonb_build_object('completed',true,'saved_at',now()-interval '1 day','local_date',local_day-1,'actor_role','client'))) from completion_fixture
 union all select workout_id,week_id,local_day,'weights'::public.training_type,'Temporary session verification','planned'::public.item_status,'{}'::jsonb from completion_fixture
 union all select cardio_id,week_id,local_day,'cardio'::public.training_type,'Temporary cardio verification','planned'::public.item_status,'{}'::jsonb from completion_fixture;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',profile_id,'role','authenticated')::text,true) from completion_fixture;
do $$declare f record; r jsonb;begin
 select * into f from completion_fixture;
 r:=public.save_session_completion(f.practice_id,true);
 if r#>>array['source_metadata','practice_days',f.local_day::text,'completed']<>'true' or r#>>array['source_metadata','practice_days',(f.local_day-1)::text,'completed']<>'true' then raise exception 'Daily history not preserved';end if;
 if r#>>'{receipt,actor_role}'<>'client' then raise exception 'Actor wrong';end if;
 r:=public.save_session_completion(f.practice_id,false);
 if r#>>array['source_metadata','practice_days',f.local_day::text,'completed']<>'false' or r#>>array['source_metadata','practice_days',(f.local_day-1)::text,'completed']<>'true' then raise exception 'Undo altered earlier date';end if;
 r:=public.save_session_completion(f.workout_id,true);if r->>'status'<>'completed' then raise exception 'Workout save failed';end if;
 r:=public.save_session_completion(f.workout_id,false);if r->>'status'<>'planned' then raise exception 'Workout undo failed';end if;
 r:=public.save_session_completion(f.cardio_id,true,'{"duration_minutes":24,"activity":"Cycling"}'::jsonb);if r#>>'{source_metadata,cardio_log,duration_minutes}'<>'24' then raise exception 'Cardio actual save failed';end if;
 begin update public.training_sessions set title='Forbidden prescription change' where id=f.workout_id;raise exception 'Prescription guard missing';exception when insufficient_privilege then null;end;
 begin update public.training_sessions set source_metadata=source_metadata||'{"forbidden":true}'::jsonb where id=f.workout_id;raise exception 'Metadata guard missing';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',peer_id,'role','authenticated')::text,true) from completion_fixture;
do $$declare f record; denied boolean:=false;begin select * into f from completion_fixture;
 begin perform public.save_session_completion(f.practice_id,true);exception when others then denied:=true;end;
 if not denied then raise exception 'Peer write allowed';end if;
 if exists(select 1 from public.training_sessions where id=f.practice_id) then raise exception 'Peer read allowed';end if;
end$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',coach_id,'role','authenticated')::text,true) from completion_fixture;
do $$declare f record; r jsonb;begin select * into f from completion_fixture;
 if not exists(select 1 from public.training_sessions where id=f.practice_id and source_metadata#>>array['practice_days',(f.local_day-1)::text,'completed']='true') then raise exception 'Coach cannot see saved date';end if;
 r:=public.save_session_completion(f.workout_id,true);if r#>>'{receipt,actor_role}'<>'coach' then raise exception 'Coach actor wrong';end if;
end$$;
select 'PASS daily date isolation, undo, workout persistence, client/coach attribution, coach visibility and peer denial; all fixtures rolled back' as verification;
rollback;

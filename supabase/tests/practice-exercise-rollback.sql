begin;
create temporary table practice_fixture as
 select s.id session_id,c.id client_id,c.profile_id,c.coach_id,array_agg(e.id order by e.sort_order,e.id) exercise_ids,
 (now() at time zone c.timezone)::date local_day
 from public.training_sessions s join public.program_weeks w on w.id=s.week_id join public.clients c on c.id=w.client_id
 join public.program_exercises e on e.program_day_id=s.programme_day_id
 where c.id='cddf42c2-61e2-40d1-b8df-cc9a7fe04b61' and c.portal_enabled and w.published
 and (now() at time zone c.timezone)::date between w.week_start and w.week_start+6 and s.training_type::text='mobility'
 group by s.id,c.id having count(*)=3 limit 1;
do $$begin if not exists(select 1 from practice_fixture) then raise exception 'Required test fixture missing';end if;end$$;
grant select on practice_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',profile_id,'role','authenticated')::text,true) from practice_fixture;
do $$declare f record;r jsonb;eid uuid;denied boolean:=false;begin
 select * into f from practice_fixture;
 foreach eid in array f.exercise_ids loop r:=public.save_practice_exercise(f.session_id,eid,true);end loop;
 if r#>>array['source_metadata','practice_days',f.local_day::text,'completed']<>'true' then raise exception 'All-exercise completion failed';end if;
 if (select count(*) from jsonb_object_keys(r#>array['source_metadata','practice_days',f.local_day::text,'exercises']))<>3 then raise exception 'Exercise records missing';end if;
 r:=public.save_practice_exercise(f.session_id,f.exercise_ids[1],false);
 if r#>>array['source_metadata','practice_days',f.local_day::text,'completed']<>'false' or r#>>array['source_metadata','practice_days',f.local_day::text,'exercises',f.exercise_ids[2]::text,'completed']<>'true' then raise exception 'Undo changed peer exercise';end if;
 r:=public.save_session_completion(f.session_id,false);
 if r#>>array['source_metadata','practice_days',f.local_day::text,'exercises',f.exercise_ids[2]::text,'completed']<>'true' then raise exception 'Whole-session save erased individual records';end if;
 begin perform public.save_practice_exercise(f.session_id,gen_random_uuid(),true);exception when others then denied:=true;end;
 if not denied then raise exception 'Unassigned exercise accepted';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}',true);
do $$declare f record;denied boolean:=false;begin select * into f from practice_fixture;
 begin perform public.save_practice_exercise(f.session_id,f.exercise_ids[1],true);exception when others then denied:=true;end;
 if not denied then raise exception 'Peer session accepted';end if;
end$$;
select 'PASS individual save, all-three completion, independent undo, preserved exercise receipts, unassigned exercise and peer denial; all changes rolled back' as verification;
rollback;

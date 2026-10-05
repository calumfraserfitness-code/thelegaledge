begin;
create temporary table scheduled_test(client_id uuid,coach_id uuid);
insert into scheduled_test select gen_random_uuid(),id from public.profiles where role='coach' limit 1;
insert into public.clients(id,profile_id,coach_id,display_name,source_system) select client_id,coach_id,coach_id,'Scheduled rollback fixture','coach_health_test' from scheduled_test;
insert into public.hevy_connections(client_id,status,key_ciphertext,key_iv,next_sync_at) select client_id,'connected','fixture-not-a-real-key','fixture-iv',now()-interval '1 day' from scheduled_test;
grant select on scheduled_test to authenticated,service_role;
select set_config('request.jwt.claim.sub',(select coach_id::text from scheduled_test),true);
set local role authenticated;
do $$ begin
 if not exists(select client_id,status from public.hevy_connections where client_id=(select client_id from scheduled_test)) then raise exception 'TEST FAILED coach metadata';end if;
 begin perform key_ciphertext from public.hevy_connections;raise exception 'TEST FAILED credential exposure';exception when insufficient_privilege then null;end;
 begin perform public.claim_hevy_sync_batch();raise exception 'TEST FAILED client claims jobs';exception when insufficient_privilege then null;end;
 begin perform public.health_worker_authorized('fake');raise exception 'TEST FAILED client worker authorization';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ begin if exists(select client_id from public.hevy_connections) then raise exception 'TEST FAILED unrelated metadata';end if;end $$;
reset role;
set local role service_role;
do $$ declare first_count int;second_count int;begin
 if public.health_worker_authorized('fake') then raise exception 'TEST FAILED fake worker key';end if;
 select count(*) into first_count from public.claim_hevy_sync_batch() where client_id=(select client_id from scheduled_test);
 select count(*) into second_count from public.claim_hevy_sync_batch() where client_id=(select client_id from scheduled_test);
 if first_count<>1 or second_count<>0 then raise exception 'TEST FAILED duplicate claims';end if;
 update public.hevy_connections set status='disconnected',next_sync_at=now()-interval '1 day' where client_id=(select client_id from scheduled_test);
 if exists(select 1 from public.claim_hevy_sync_batch() where client_id=(select client_id from scheduled_test)) then raise exception 'TEST FAILED disconnected claim';end if;
end $$;
reset role;
select 'PASS: private credential denial, coach metadata, worker-only claims, invalid worker token, lease isolation and disconnect exclusion' as result;
rollback;

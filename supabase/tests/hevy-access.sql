begin;
insert into auth.users(id,email,raw_user_meta_data) values
('91910000-0000-4000-8000-000000000001','hevy-owner-qa@example.invalid','{}'),
('91910000-0000-4000-8000-000000000002','hevy-peer-qa@example.invalid','{}'),
('91910000-0000-4000-8000-000000000003','hevy-coach-qa@example.invalid','{}');
update public.profiles set role='coach' where id='91910000-0000-4000-8000-000000000003';
insert into public.clients(id,profile_id,coach_id,display_name) values
('91920000-0000-4000-8000-000000000001','91910000-0000-4000-8000-000000000001','91910000-0000-4000-8000-000000000003','Hevy QA owner'),
('91920000-0000-4000-8000-000000000002','91910000-0000-4000-8000-000000000002','91910000-0000-4000-8000-000000000003','Hevy QA peer');
insert into public.hevy_connections(client_id,key_ciphertext,key_iv,status) values ('91920000-0000-4000-8000-000000000001','fictional-encrypted-fixture','fictional-iv','connected');
insert into public.hevy_workouts(client_id,hevy_id,title,start_time,exercises) values ('91920000-0000-4000-8000-000000000001','qa-only','Fixture','2026-10-03T12:00:00Z','[]');
set local role authenticated;
select set_config('request.jwt.claim.sub','91910000-0000-4000-8000-000000000001',true);
do $$begin
 if (select count(*) from public.hevy_workouts)<>1 then raise exception 'Owner cannot read own workouts';end if;
 if (select count(client_id) from public.hevy_connections)<>1 then raise exception 'Owner cannot read own status';end if;
 begin perform key_ciphertext from public.hevy_connections;raise exception 'Credential column exposed';exception when insufficient_privilege then null;end;
 begin insert into public.hevy_workouts(client_id,hevy_id,title,start_time,exercises) values ('91920000-0000-4000-8000-000000000001','client-write','Fixture',now(),'[]');raise exception 'Client import write exposed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','91910000-0000-4000-8000-000000000002',true);
do $$begin
 if (select count(*) from public.hevy_workouts)<>0 then raise exception 'Peer read private workouts';end if;
 if (select count(client_id) from public.hevy_connections)<>0 then raise exception 'Peer read connection';end if;
end$$;
select set_config('request.jwt.claim.sub','91910000-0000-4000-8000-000000000003',true);
do $$begin
 if (select count(*) from public.hevy_workouts)<>1 then raise exception 'Assigned coach cannot read training history';end if;
 if (select count(client_id) from public.hevy_connections)<>1 then raise exception 'Assigned coach cannot read connection status';end if;
 begin perform key_ciphertext from public.hevy_connections;raise exception 'Coach read encrypted credential';exception when insufficient_privilege then null;end;
end$$;
rollback;
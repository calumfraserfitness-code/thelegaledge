begin;
-- Entirely synthetic records, rolled back at the end.
insert into auth.users(id,email,raw_user_meta_data) select ('99510000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'playbook-qa-'||i||'@example.invalid','{}'::jsonb from generate_series(1,14)i;
update public.profiles set role='coach' where id='99510000-0000-4000-8000-000000000013';
insert into public.clients(id,profile_id,coach_id,display_name,onboarding_status,plan_status) select ('99520000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('99510000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'99510000-0000-4000-8000-000000000013','Playbook synthetic client','complete','published' from generate_series(1,12)i;
insert into public.coaching_start_resources(id,coach_id,title,body,quick_answer,review_status,published) values('99530000-0000-4000-8000-000000000001','99510000-0000-4000-8000-000000000013','Fixture guide','Detailed fixture','Quick fixture','reviewed',true),('99530000-0000-4000-8000-000000000002','99510000-0000-4000-8000-000000000013','Private draft','Draft body','Draft answer','draft',false);
insert into public.program_weeks(id,client_id,week_start,published) values('99540000-0000-4000-8000-000000000001','99520000-0000-4000-8000-000000000001',current_date,true);
insert into public.training_sessions(id,week_id,session_date,training_type,title,status) values('99550000-0000-4000-8000-000000000001','99540000-0000-4000-8000-000000000001',current_date,'weights','Fixture session','planned');
insert into public.exercises(id,session_id,name,sets,reps,load) values('99560000-0000-4000-8000-000000000001','99550000-0000-4000-8000-000000000001','Fixture squat',3,'6','20');
insert into public.firm_organizations(id,coach_id,name) values('99570000-0000-4000-8000-000000000001','99510000-0000-4000-8000-000000000013','Fixture organization');
insert into public.firm_pilots(id,organization_id,coach_id,name,minimum_report_count,capacity) values('99580000-0000-4000-8000-000000000001','99570000-0000-4000-8000-000000000001','99510000-0000-4000-8000-000000000013','Fixture cohort',5,20);
insert into public.firm_participants(pilot_id,client_id,status,joined_at) select '99580000-0000-4000-8000-000000000001',id,'active',now()-interval '2 days' from public.clients where id::text like '99520000-%';
insert into public.firm_employer_access(organization_id,user_id,coach_id,display_name) values('99570000-0000-4000-8000-000000000001','99510000-0000-4000-8000-000000000014','99510000-0000-4000-8000-000000000013','Fixture sponsor');
set local role authenticated;
select set_config('request.jwt.claim.sub','99510000-0000-4000-8000-000000000013',true);
insert into public.playbook_workout_options(id,client_id,coach_id,session_id,minutes,location,energy,exercises,note) values('99590000-0000-4000-8000-000000000001','99520000-0000-4000-8000-000000000001','99510000-0000-4000-8000-000000000013','99550000-0000-4000-8000-000000000001',20,'gym','good','[{"id":"99560000-0000-4000-8000-000000000001","sets":1}]','Fixture approved note');
do $$begin
 begin update public.playbook_workout_options set exercises='[{"id":"99560000-0000-4000-8000-000000000001","sets":9}]' where id='99590000-0000-4000-8000-000000000001';raise exception 'Extra sets accepted';exception when raise_exception then if SQLERRM='Extra sets accepted' then raise;end if;end;
 if exists(select 1 from public.playbook_coach_engagement() where title='Fixture guide' and opens<>0) then raise exception 'Fabricated engagement';end if;
end$$;
select set_config('request.jwt.claim.sub','99510000-0000-4000-8000-000000000001',true);
do $$declare h uuid;begin
 if (select count(*) from public.coaching_start_resources where id::text like '99530000-%')<>1 then raise exception 'Client draft visibility failure';end if;
 insert into public.playbook_feedback(client_id,resource_id,helpful,comment) values('99520000-0000-4000-8000-000000000001','99530000-0000-4000-8000-000000000001',true,'Fixture feedback');
 begin update public.playbook_feedback set client_id='99520000-0000-4000-8000-000000000002';raise exception 'Feedback reassignment accepted';exception when insufficient_privilege then null;end;
 begin insert into public.playbook_bookmarks(client_id,resource_id) values('99520000-0000-4000-8000-000000000002','99530000-0000-4000-8000-000000000001');raise exception 'Peer bookmark accepted';exception when insufficient_privilege then null;end;
 begin insert into public.playbook_workout_history(client_id,session_id,original,adjusted) values('99520000-0000-4000-8000-000000000001','99550000-0000-4000-8000-000000000001','[]','[]');raise exception 'Client invented prescription';exception when insufficient_privilege then null;end;
 h=public.accept_playbook_workout('99590000-0000-4000-8000-000000000001');
 if (select sets from public.exercises where id='99560000-0000-4000-8000-000000000001')<>3 then raise exception 'Original changed';end if;
 if (select adjusted->0->>'sets' from public.playbook_workout_history where id=h)<>'1' then raise exception 'Approved option not copied';end if;
 if not public.restore_playbook_workout(h) then raise exception 'Restore failed';end if;
end$$;
select set_config('request.jwt.claim.sub','99510000-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from public.playbook_feedback where client_id='99520000-0000-4000-8000-000000000001') or exists(select 1 from public.playbook_workout_history where client_id='99520000-0000-4000-8000-000000000001') then raise exception 'Peer private data visible';end if;
 begin perform public.accept_playbook_workout('99590000-0000-4000-8000-000000000001');raise exception 'Peer accepted workout';exception when raise_exception then if SQLERRM='Peer accepted workout' then raise;end if;end;
 begin perform public.playbook_firm_report('99580000-0000-4000-8000-000000000001');raise exception 'Employee accessed sponsor report';exception when raise_exception then if SQLERRM='Employee accessed sponsor report' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','99510000-0000-4000-8000-000000000013',true);
do $$begin
 if not exists(select 1 from public.playbook_feedback where client_id='99520000-0000-4000-8000-000000000001') then raise exception 'Assigned coach cannot see feedback';end if;
 if not (public.playbook_firm_report('99580000-0000-4000-8000-000000000001')->>'suppressed')::boolean then raise exception 'Unconsented group was reported';end if;
end$$;
reset role;
insert into public.playbook_cohort_consents(client_id,accepted_at) select id,now()-interval '1 day' from public.clients where id::text like '99520000-%';
insert into public.playbook_events(client_id,resource_id,kind,created_at) select id,'99530000-0000-4000-8000-000000000001','open',now() from public.clients where id::text like '99520000-%' and right(id::text,12)::int<=5;
set local role authenticated;
select set_config('request.jwt.claim.sub','99510000-0000-4000-8000-000000000014',true);
do $$declare r jsonb;begin
 r=public.playbook_firm_report('99580000-0000-4000-8000-000000000001');
 if (r->>'suppressed')::boolean or (r->>'participation_band')::int<>5 then raise exception 'Safe aggregate failed';end if;
 if r::text like '%client_id%' or r::text like '%Fixture feedback%' then raise exception 'Private identity leaked';end if;
 if exists(select 1 from public.playbook_events) or exists(select 1 from public.playbook_feedback) or exists(select 1 from public.playbook_workout_history) then raise exception 'Employer read individual Playbook records';end if;
end$$;
set local role anon;
do $$begin
 begin perform * from public.playbook_events;raise exception 'Anonymous events access';exception when insufficient_privilege then null;end;
 begin perform public.accept_playbook_workout('99590000-0000-4000-8000-000000000001');raise exception 'Anonymous acceptance';exception when insufficient_privilege then null;end;
end$$;
reset role;
select 'PASS: draft/published separation, peer isolation, feedback ownership, explicit coach option validation, acceptance/restoration/original preservation, sponsor authorization/consent/suppression/aggregate-only access and anonymous denial. All fixtures rolled back.' as result;
rollback;

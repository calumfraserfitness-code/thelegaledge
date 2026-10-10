
begin;
create temp table lec_security_fixture(kind text primary key,id uuid default gen_random_uuid());
insert into lec_security_fixture(kind) values ('coach_a'),('coach_b'),('client_a'),('client_b');
insert into auth.users(id,email) select id,'lec-rollback-'||kind||'@example.invalid' from lec_security_fixture;
insert into public.profiles(id,role,full_name)
 select id,case when kind like 'coach%' then 'coach'::public.user_role else 'client'::public.user_role end,'Rollback fixture' from lec_security_fixture
 on conflict(id) do update set role=excluded.role;
create temp table lec_client_fixture(kind text primary key,id uuid default gen_random_uuid());
insert into lec_client_fixture(kind) values('a'),('b');
insert into public.clients(id,profile_id,coach_id,display_name)
 select f.id,u.id,c.id,'Rollback client' from lec_client_fixture f join lec_security_fixture u on u.kind='client_'||f.kind join lec_security_fixture c on c.kind='coach_'||f.kind;
insert into public.checkins(client_id,wins) select id,'Rollback only' from lec_client_fixture;
insert into public.training_programs(client_id,name,status) select id,'Rollback training','active' from lec_client_fixture;
insert into public.nutrition_plans(client_id,name) select id,'Rollback nutrition' from lec_client_fixture;
insert into public.training_programs(client_id,name,status) select id,'Unpublished test','draft' from lec_client_fixture;
insert into public.diagnostic_reports(client_id,title,report_type) select id,'Rollback report','bloodwork' from lec_client_fixture;
insert into public.program_weeks(client_id,week_start,published) select id,'2026-10-05',true from lec_client_fixture;
insert into public.training_sessions(week_id,session_date,training_type,title) select w.id,'2026-10-10','weights','Rollback assigned session' from public.program_weeks w join lec_client_fixture f on f.id=w.client_id;
grant select on lec_security_fixture,lec_client_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from lec_security_fixture where kind='coach_a'),'role','authenticated')::text,true);
do $$ declare n int; x uuid; r public.checkins; begin
 select count(*) into n from public.checkins where client_id in(select id from lec_client_fixture);if n<>1 then raise exception 'Coach isolation failed';end if;
 select id into x from public.checkins where client_id=(select id from lec_client_fixture where kind='a');
 r:=public.save_checkin_review(x,'Agreed coaching action','https://example.com/review','Two agreed training windows',true);
 if r.reviewed_at is null or r.coach_response<>'Agreed coaching action' then raise exception 'Review persistence failed';end if;
 update public.clients set coach_notes='Rollback PRIVATE coach instruction' where id=(select id from lec_client_fixture where kind='a');
 if not exists(select 1 from public.client_private_details where client_id=(select id from lec_client_fixture where kind='a') and coach_notes='Rollback PRIVATE coach instruction') then raise exception 'Private note save lost';end if;
 if exists(select 1 from public.clients where coach_notes is not null) then raise exception 'Private note remained on client-readable row';end if;
 update public.diagnostic_reports set summary='Assigned coach edit' where client_id=(select id from lec_client_fixture where kind='a');get diagnostics n=row_count;if n<>1 then raise exception 'Coach lost report editing';end if;
 update public.nutrition_plans set coach_notes='Assigned coach edit' where client_id=(select id from lec_client_fixture where kind='a');get diagnostics n=row_count;if n<>1 then raise exception 'Coach cannot edit own nutrition';end if;
 update public.nutrition_plans set coach_notes='Unauthorized' where client_id=(select id from lec_client_fixture where kind='b');get diagnostics n=row_count;if n<>0 then raise exception 'Coach changed other client nutrition';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from lec_security_fixture where kind='client_a'),'role','authenticated')::text,true);
do $$ declare n int; begin
 begin update public.profiles set role='coach' where id=(select id from lec_security_fixture where kind='client_a');raise exception 'Client promoted own role';exception when insufficient_privilege then null;end;
 update public.training_programs set name='Unauthorized' where client_id=(select id from lec_client_fixture where kind='a');get diagnostics n=row_count;if n<>0 then raise exception 'Client edited prescription';end if;
 update public.nutrition_plans set calories=1 where client_id=(select id from lec_client_fixture where kind='a');get diagnostics n=row_count;if n<>0 then raise exception 'Client edited nutrition';end if;
 select count(*) into n from public.training_programs where client_id=(select id from lec_client_fixture where kind='a');if n<>1 then raise exception 'Client lost own read';end if;
 if exists(select 1 from public.client_private_details) then raise exception 'Client read private profile notes';end if;
 update public.training_sessions set status='completed',completed_at=now() where title='Rollback assigned session';get diagnostics n=row_count;if n<>1 then raise exception 'Client lost session completion';end if;
 begin update public.training_sessions set title='Client overwrote prescription' where title='Rollback assigned session';raise exception 'Client changed prescription title';exception when insufficient_privilege then null;end;
 delete from public.diagnostic_reports where client_id=(select id from lec_client_fixture where kind='a');get diagnostics n=row_count;if n<>0 then raise exception 'Client deleted own diagnostic report';end if;
 select count(*) into n from public.diagnostic_reports where client_id=(select id from lec_client_fixture where kind='a');if n<>1 then raise exception 'Client lost own report read';end if;
 begin perform public.save_checkin_review((select id from public.checkins limit 1),'Unauthorized',null,null,true);raise exception 'Client reviewed own check-in';exception when raise_exception then if sqlerrm='Client reviewed own check-in' then raise;end if;end;
end $$;
reset role;
select 'PASS: own-coach review saved; other-coach isolation; profile role escalation blocked; client prescription writes blocked; own prescribed plans readable; fixture transaction rolled back.' result;
rollback;

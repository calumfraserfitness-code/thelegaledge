-- Synthetic roadmap text only. All fixture writes roll back. No Auth changes.
begin;
set local statement_timeout='25s';
create temp table roadmap_scope as select c.id client_id,c.coach_id,c.profile_id client_user,
 (select p.id from public.profiles p where p.role='coach' and p.id<>c.coach_id order by p.id limit 1) peer_coach
 from public.clients c join public.profiles p on p.id=c.profile_id and p.role='client'
 where c.deleted_at is null and c.status='active' and c.profile_id<>c.coach_id
 and c.source_system is distinct from 'coach_health_test' and c.display_name !~* '(demo|test data)'
 order by c.id limit 1;
do $$ begin if not exists(select 1 from roadmap_scope where client_user is not null and peer_coach is not null) then raise exception 'Need two coaches and a linked real client';end if;end $$;
create temp table roadmap_baseline as select count(*) jobs from public.coaching_notification_jobs;
grant select on roadmap_scope,roadmap_baseline to authenticated,anon;
create function pg_temp.roadmap_fixture() returns jsonb language sql as $$
 select jsonb_build_object('version',1,'phase','SYNTHETIC PRIVATE PHASE','destination','Original direction','evidence','Synthetic evidence',
 'goals',jsonb_build_array(jsonb_build_object('title','Synthetic goal','status','proposed','detail','Needs agreement')),
 'trajectory',jsonb_build_array(jsonb_build_object('label','Next review','detail','Discuss first')),'sources','[]'::jsonb,
 'scorecard','Synthetic measures','coach','Private task','next_call','Question','review','Not booked');
$$;
grant execute on function pg_temp.roadmap_fixture() to authenticated;
-- Temporarily clear this feature's own drafts only; rollback restores originals.
delete from public.coach_client_roadmaps where client_id=(select client_id from roadmap_scope);
insert into public.coach_client_roadmaps(client_id,coach_id,revision,payload)
 select client_id,peer_coach,1,jsonb_set(pg_temp.roadmap_fixture(),'{phase}','"FORMER COACH PRIVATE"') from roadmap_scope;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',coach_id,'role','authenticated')::text from roadmap_scope),true);
set local role authenticated;
do $$ declare s record;r public.coach_client_roadmaps;blocked boolean;bundle jsonb;begin
 select * into s from roadmap_scope;
 if exists(select 1 from public.coach_client_roadmaps where client_id=s.client_id) then raise exception 'Former coach draft leaked';end if;
 r:=public.save_coach_client_roadmap(s.client_id,0,pg_temp.roadmap_fixture());
 if r.revision<>1 or r.coach_id<>s.coach_id then raise exception 'First private save failed';end if;
 if not exists(select 1 from public.coach_client_roadmaps where client_id=s.client_id and revision=1) then raise exception 'Save/reload failed';end if;
 blocked:=false;begin perform public.save_coach_client_roadmap(s.client_id,0,pg_temp.roadmap_fixture());exception when serialization_failure then blocked:=true;end;
 if not blocked then raise exception 'Duplicate create overwrote the roadmap';end if;
 r:=public.save_coach_client_roadmap(s.client_id,1,jsonb_set(pg_temp.roadmap_fixture(),'{phase}','"UPDATED SYNTHETIC PHASE"'));
 if r.revision<>2 then raise exception 'Update revision failed';end if;
 blocked:=false;begin perform public.save_coach_client_roadmap(s.client_id,1,pg_temp.roadmap_fixture());exception when serialization_failure then blocked:=true;end;
 if not blocked then raise exception 'Stale save overwrote newer work';end if;
 blocked:=false;begin perform public.save_coach_client_roadmap(s.client_id,2,jsonb_set(pg_temp.roadmap_fixture(),'{goals,0,status}','"invented"'));exception when others then blocked:=true;end;
 if not blocked then raise exception 'Invalid agreement status accepted';end if;
 bundle:=public.export_coaching_backup();
 if not exists(select 1 from jsonb_array_elements(bundle->'tables'->'coach_client_roadmaps') d where d->>'phase'='UPDATED SYNTHETIC PHASE' or d->'payload'->>'phase'='UPDATED SYNTHETIC PHASE') then raise exception 'Own roadmap missing from recovery export';end if;
 if exists(select 1 from jsonb_array_elements(bundle->'tables'->'coach_client_roadmaps') d where d->>'coach_id'<>s.coach_id::text) then raise exception 'Former coach private roadmap leaked through backup';end if;
end $$;
reset role;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',client_user,'role','authenticated')::text from roadmap_scope),true);
set local role authenticated;
do $$ declare blocked boolean:=false;begin
 if exists(select 1 from public.coach_client_roadmaps) then raise exception 'Client can read private roadmaps';end if;
 begin perform public.save_coach_client_roadmap((select client_id from roadmap_scope),2,pg_temp.roadmap_fixture());exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Client can save a private roadmap';end if;
end $$;
reset role;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',peer_coach,'role','authenticated')::text from roadmap_scope),true);
set local role authenticated;
do $$ declare blocked boolean:=false;begin
 if exists(select 1 from public.coach_client_roadmaps where client_id=(select client_id from roadmap_scope)) then raise exception 'Peer coach can read current or former roadmap';end if;
 begin perform public.save_coach_client_roadmap((select client_id from roadmap_scope),2,pg_temp.roadmap_fixture());exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Peer coach can save private roadmap';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare blocked boolean:=false;begin
 begin perform 1 from public.coach_client_roadmaps limit 1;exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Anonymous can read private roadmap table';end if;
 blocked:=false;begin perform public.save_coach_client_roadmap((select client_id from roadmap_scope),0,'{}');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Anonymous can invoke roadmap save';end if;
end $$;
reset role;
do $$ begin if (select count(*) from public.coaching_notification_jobs)<>(select jobs from roadmap_baseline) then raise exception 'Private preparation queued notifications';end if;end $$;
select 'PASS: private save/reload, optimistic conflicts, invalid status, client/peer/anon denial, scoped recovery and no notifications; all rolled back' result;
rollback;

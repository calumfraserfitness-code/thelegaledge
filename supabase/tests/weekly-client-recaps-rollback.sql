-- All recap data below is synthetic and rolled back. Existing identities only
-- exercise normal RLS; no Auth user, session, password or client profile is changed.
begin;
set local statement_timeout='25s';
create temp table recap_scope as
select c.id client_id,c.coach_id,c.profile_id client_user,c.track_weight,coalesce(c.timezone,'Europe/Dublin') timezone,
 (select p.id from public.profiles p where p.role='coach' and p.id<>c.coach_id order by p.id limit 1) peer_coach,
 (select q.id from public.clients q where q.coach_id<>c.coach_id and q.coach_id in(select id from public.profiles where role='coach') and q.deleted_at is null order by q.id limit 1) peer_client
from public.clients c join public.profiles p on p.id=c.profile_id and p.role='client'
join public.profiles coach on coach.id=c.coach_id and coach.role='coach'
where c.deleted_at is null and c.track_weight is distinct from false and c.source_system is distinct from 'coach_health_test' order by c.id limit 1;
do $$ begin if not exists(select 1 from recap_scope where client_user is not null and peer_coach is not null and peer_client is not null) then raise exception 'Need an existing linked client and two coach identities for verification';end if;end $$;
create temp table recap_baseline as select count(*) notifications from public.coaching_notification_jobs;
grant select on recap_scope,recap_baseline to authenticated,anon;
create function pg_temp.recap_fixture(week date,zone text,focus_text text default 'One agreed focus') returns jsonb language sql as $$
 select jsonb_build_object('version',1,'period_start',week::text,'period_end',(week+6)::text,'next_week_start',(week+7)::text,'next_week_end',(week+13)::text,'timezone',zone,'prepared_at',now(),'in_progress',false,
 'recorded_sessions',jsonb_build_object('completed',2,'strength',1,'cardio',1,'other',0,'cardio_minutes',35,'practice_days',2,'practice_completed_days',1,'practice_exercise_ticks',4,'logged_strength',1,'evidence',jsonb_build_array('PRIVATE SESSION SOURCE')),
 'weight',jsonb_build_object('enabled',true,'status','trend','minimum_readings',3,'current',jsonb_build_object('count',3,'days',jsonb_build_array(week::text,(week+2)::text,(week+5)::text),'average_kg',79),'previous',jsonb_build_object('count',3,'days',jsonb_build_array((week-7)::text,(week-5)::text,(week-2)::text),'average_kg',80),'change_kg',-1,'conflict_dates','[]'::jsonb,'note','Three distinct recorded days in each week.'),
 'biggest_win','A recorded win','focus',focus_text,'coach_note','Short coach note','source_refs',jsonb_build_array('PRIVATE ROOT SOURCE'),'gaps',jsonb_build_array('PRIVATE GAP'),'unapproved_extra','PRIVATE EXTRA');
$$;
grant execute on function pg_temp.recap_fixture(date,text,text) to authenticated;
create function pg_temp.recap_jobs() returns integer language sql security definer set search_path='' as $$ select count(*)::integer from public.coaching_notification_jobs $$;
grant execute on function pg_temp.recap_jobs() to authenticated;

-- Simulates private preparation retained from a former coach after reassignment.
insert into public.coach_weekly_recap_drafts(client_id,coach_id,week_start,revision,payload,body)
select client_id,peer_coach,'2000-01-31',1,pg_temp.recap_fixture('2000-01-31',timezone),'FORMER COACH PRIVATE' from recap_scope;

select set_config('request.jwt.claims',(select jsonb_build_object('sub',coach_id,'role','authenticated')::text from recap_scope),true);
set local role authenticated;
do $$ declare scope record;result jsonb;payload jsonb;blocked boolean;bundle jsonb;week date:='2000-01-03';begin
 select * into scope from recap_scope;payload:=pg_temp.recap_fixture(week,scope.timezone);
 result:=public.save_weekly_recap(scope.client_id,week,payload,'Draft body',0,false);
 if (result->'draft'->>'revision')::integer<>1 or result->'publication' is distinct from 'null'::jsonb then raise exception 'Initial private save failed';end if;
 if exists(select 1 from public.client_weekly_recaps where client_id=scope.client_id and week_start=week) then raise exception 'Private save published a recap';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,week,payload,'STALE',0,false);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Concurrent first-create overwrote a private draft';end if;
 result:=public.save_weekly_recap(scope.client_id,week,payload,'Approved body 1',1,true);
 if result->'draft' is distinct from 'null'::jsonb or (result->'publication'->>'revision')::integer<>2 or result->'publication'->>'body'<>'Approved body 1' then raise exception 'Explicit publication failed';end if;
 if exists(select 1 from public.coach_weekly_recap_drafts where client_id=scope.client_id and coach_id=scope.coach_id and week_start=week) then raise exception 'Published draft was not consumed';end if;
 if position('PRIVATE' in (result->'publication'->'payload')::text)>0 or result->'publication'->'payload'?'source_refs' or result->'publication'->'payload'?'gaps' or result->'publication'->'payload'->'recorded_sessions'?'evidence' then raise exception 'Internal preparation escaped into the client projection';end if;
 result:=public.save_weekly_recap(scope.client_id,week,jsonb_set(payload,'{coach_note}','"New private note"'),'New private body',2,false);
 if (result->'draft'->>'revision')::integer<>3 or result->'publication'->>'body'<>'Approved body 1' then raise exception 'Private editing changed the approved recap';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,week,payload,'STALE PUBLISH',2,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'A stale tab overwrote newer private work';end if;
 result:=public.save_weekly_recap(scope.client_id,week,payload,'Approved body 2',3,true);
 if (result->'publication'->>'revision')::integer<>4 then raise exception 'Shared revision did not advance on publication';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,week,payload,'STALE NO DRAFT',0,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Consuming a draft allowed stale publication overwrite';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,week,payload,'STALE PRIOR PUBLICATION',2,false);exception when others then blocked:=true;end;
 if not blocked then raise exception 'A stale published version created replacement draft work';end if;
 -- Body/identity/projection are also safe through direct assigned-coach writes.
 insert into public.client_weekly_recaps(client_id,week_start,coach_id,revision,payload,body)
 values(scope.client_id,'2000-01-10',scope.coach_id,1,pg_temp.recap_fixture('2000-01-10',scope.timezone),'Approved direct body');
 if exists(select 1 from public.client_weekly_recaps r where r.client_id=scope.client_id and r.week_start='2000-01-10' and position('PRIVATE' in r.payload::text)>0) then raise exception 'Direct public write bypassed the safe projection';end if;
 perform public.save_weekly_recap(scope.client_id,'2000-01-17',pg_temp.recap_fixture('2000-01-17',scope.timezone,''),'Incomplete private focus',0,false);
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,'2000-01-17',pg_temp.recap_fixture('2000-01-17',scope.timezone,''),'No focus',1,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'An unapproved empty focus was published';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,'2000-01-03',jsonb_set(payload,'{recorded_sessions,completed}','true'),'Invalid count',4,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Boolean session count was accepted';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,'2000-01-03',jsonb_set(payload,'{weight,current}','null'),'Malformed nested weight',4,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'A null nested weight object bypassed validation';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,'2000-01-03',jsonb_set(payload,'{weight,current,count}','2'),'Invalid trend',4,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Insufficient weight readings became a trend';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,'2000-01-04',payload,'Wrong weekday',0,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'A non-Monday week was accepted';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,date_trunc('week',now() at time zone scope.timezone)::date+7,payload,'Future week',0,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'A future recap was accepted';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,week,jsonb_set(payload,'{timezone}','"Pacific/Honolulu"'),'Wrong timezone',4,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'A stale client timezone was accepted';end if;
 -- Current-week publication is allowed only when explicitly labelled in progress.
 week:=date_trunc('week',now() at time zone scope.timezone)::date;
 payload:=pg_temp.recap_fixture(week,scope.timezone);
 payload:=jsonb_set(payload,'{weight}',jsonb_build_object('enabled',false,'status','disabled','minimum_readings',3,'current',jsonb_build_object('count',0,'days','[]'::jsonb,'average_kg',null),'previous',jsonb_build_object('count',0,'days','[]'::jsonb,'average_kg',null),'change_kg',null,'conflict_dates','[]'::jsonb,'note','Weight tracking is disabled.'));
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,week,payload,'Wrong current label',0,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'An in-progress week was presented as complete';end if;
 result:=public.save_weekly_recap(scope.client_id,week,jsonb_set(payload,'{in_progress}','true'),'Current week in progress',0,true);
 if result->'publication'->'payload'->'in_progress' is distinct from 'true'::jsonb then raise exception 'Current week label was lost';end if;
 -- Coach backups include own private work and exclude a former coach's draft.
 perform public.save_weekly_recap(scope.client_id,'2000-01-24',pg_temp.recap_fixture('2000-01-24',scope.timezone),'OWN PRIVATE BACKUP',0,false);
 bundle:=public.export_coaching_backup();
 if not exists(select 1 from jsonb_array_elements(bundle->'tables'->'coach_weekly_recap_drafts') d where d->>'body'='OWN PRIVATE BACKUP') then raise exception 'Own private recap missing from backup';end if;
 if exists(select 1 from jsonb_array_elements(bundle->'tables'->'coach_weekly_recap_drafts') d where d->>'body'='FORMER COACH PRIVATE') then raise exception 'A recovery export exposed another coach private recap';end if;
 blocked:=false;begin update public.coach_weekly_recap_drafts set week_start='2000-02-07' where client_id=scope.client_id and coach_id=scope.coach_id and week_start='2000-01-24';exception when others then blocked:=true;end;
 if not blocked then raise exception 'A private recap moved between weeks';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.peer_client,'2000-01-03',pg_temp.recap_fixture('2000-01-03',scope.timezone),'Peer client',0,false);exception when others then blocked:=true;end;
 if not blocked then raise exception 'A coach could save a peer client recap';end if;
 if pg_temp.recap_jobs()<>(select notifications from recap_baseline) then raise exception 'Recap preparation/publication queued a notification';end if;
end $$;
reset role;

-- This temporary preference change is restored before the fixture transaction
-- rolls back. It proves stale weighted snapshots cannot bypass a later opt-out.
update public.clients set track_weight=false where id=(select client_id from recap_scope);
set local role authenticated;
do $$ declare scope record;payload jsonb;blocked boolean;result jsonb;week date:='2000-02-07';begin
 select * into scope from recap_scope;payload:=pg_temp.recap_fixture(week,scope.timezone);
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,week,payload,'Stale enabled weight',0,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'A stale enabled-weight snapshot was published after opt-out';end if;
 blocked:=false;begin insert into public.client_weekly_recaps(client_id,week_start,coach_id,revision,payload,body) values(scope.client_id,week,scope.coach_id,1,payload,'Direct stale enabled weight');exception when others then blocked:=true;end;
 if not blocked then raise exception 'A direct publication bypassed weight opt-out';end if;
 payload:=jsonb_set(payload,'{weight}',jsonb_build_object('enabled',false,'status','disabled','minimum_readings',3,'current',jsonb_build_object('count',0,'days','[]'::jsonb,'average_kg',null),'previous',jsonb_build_object('count',0,'days','[]'::jsonb,'average_kg',null),'change_kg',null,'conflict_dates','[]'::jsonb,'note','Weight tracking is disabled.'));
 result:=public.save_weekly_recap(scope.client_id,week,payload,'No weight included',0,true);
 if result->'publication'->'payload'->'weight'->'enabled' is distinct from 'false'::jsonb then raise exception 'Disabled weight publication failed';end if;
end $$;
reset role;
update public.clients set track_weight=(select track_weight from recap_scope) where id=(select client_id from recap_scope);

select set_config('request.jwt.claims',(select jsonb_build_object('sub',client_user,'role','authenticated')::text from recap_scope),true);
set local role authenticated;
do $$ declare scope record;blocked boolean;affected integer;begin
 select * into scope from recap_scope;
 if exists(select 1 from public.coach_weekly_recap_drafts) then raise exception 'Client could read private recap preparation';end if;
 if not exists(select 1 from public.client_weekly_recaps where client_id=scope.client_id and week_start='2000-01-03' and body='Approved body 2') then raise exception 'Client could not read approved own recap';end if;
 if exists(select 1 from public.client_weekly_recaps r where position('PRIVATE' in r.payload::text)>0 or r.payload?'source_refs' or r.payload?'gaps' or r.payload->'recorded_sessions'?'evidence') then raise exception 'A client could read private evidence fields';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,'2000-01-03',pg_temp.recap_fixture('2000-01-03',scope.timezone),'Client spoof',4,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Client could invoke the coach recap RPC';end if;
 blocked:=false;begin insert into public.coach_weekly_recap_drafts(client_id,coach_id,week_start,revision,payload,body) values(scope.client_id,scope.coach_id,'2000-02-07',1,pg_temp.recap_fixture('2000-02-07',scope.timezone),'Client draft spoof');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Client could insert a coach draft';end if;
 update public.client_weekly_recaps set body='Client overwrite' where client_id=scope.client_id;get diagnostics affected=row_count;if affected<>0 then raise exception 'Client could overwrite approved feedback';end if;
 delete from public.client_weekly_recaps where client_id=scope.client_id;get diagnostics affected=row_count;if affected<>0 then raise exception 'Client could delete approved feedback';end if;
 blocked:=false;begin perform public.export_coaching_backup();exception when others then blocked:=true;end;
 if not blocked then raise exception 'Client could export a coach recovery bundle';end if;
end $$;
reset role;

select set_config('request.jwt.claims',(select jsonb_build_object('sub',peer_coach,'role','authenticated')::text from recap_scope),true);
set local role authenticated;
do $$ declare scope record;blocked boolean;begin
 select * into scope from recap_scope;
 if exists(select 1 from public.coach_weekly_recap_drafts where client_id=scope.client_id) or exists(select 1 from public.client_weekly_recaps where client_id=scope.client_id) then raise exception 'Peer coach could read another assigned client recap';end if;
 blocked:=false;begin perform public.save_weekly_recap(scope.client_id,'2000-01-03',pg_temp.recap_fixture('2000-01-03',scope.timezone),'Peer overwrite',4,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Peer coach could overwrite another client recap';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ declare blocked boolean;begin
 blocked:=false;begin perform count(*) from public.coach_weekly_recap_drafts;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Anonymous private recap grant remains';end if;
 blocked:=false;begin perform count(*) from public.client_weekly_recaps;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Anonymous published recap grant remains';end if;
 blocked:=false;begin perform public.save_weekly_recap(null,null,null,null,0,false);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Anonymous coach recap RPC grant remains';end if;
end $$;
reset role;
select 'PASS private draft isolation, explicit publication, approved preservation, shared optimistic versions, safe public projection, recorded-data bounds, in-progress labels, own-coach backup isolation, client/peer/anon denial and no notifications' as verification;
rollback;

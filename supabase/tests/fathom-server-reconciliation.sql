-- Synthetic ingestion and permission tests; not webhook-delivery evidence.
begin;
do $$
declare coach uuid;email text;cid uuid;client_email text;payload jsonb;n integer;rid text;
begin
 select c.coach_id,p.email into coach,email from app_private.coaching_fathom_connections c
 join public.profiles p on p.id=c.coach_id where c.enabled limit 1;
 if coach is null then raise exception 'No authorised Fathom connection';end if;
 select id,c.email into cid,client_email from public.clients c where coach_id=coach and status='active' and profile_id is not null and c.email is not null limit 1;
 rid:='9999000000000001';
 if exists(select 1 from public.coaching_recording_events where source_event_id='recording:'||rid) then raise exception 'Test ID collision';end if;
 payload:=jsonb_build_object('recording_id',rid,'recorded_by',jsonb_build_object('email',email),
 'recording_start_time','2026-10-10T12:00:00Z','title','AUTOMATION TEST Fathom',
 'url','https://fathom.video/share/automation-test','calendar_invitees',jsonb_build_array(jsonb_build_object('email',client_email)));
 n:=app_private.ingest_fathom_poll(coach,payload);
 if n<>1 then raise exception 'Insert failed';end if;
 if not exists(select 1 from public.coaching_recording_events where source_event_id='recording:'||rid and client_id=cid and coach_id=coach and matching_status='matched') then raise exception 'Exact email identity failed';end if;
 n:=app_private.ingest_fathom_poll(coach,payload);
 if n<>0 then raise exception 'Duplicate was not ignored';end if;
 n:=app_private.ingest_fathom_poll(coach,payload||jsonb_build_object('recording_id','9999000000000002','recorded_by',jsonb_build_object('email','wrong-account@example.invalid')));
 if n<>0 then raise exception 'Foreign provider account accepted';end if;
 n:=app_private.ingest_fathom_poll(coach,payload||jsonb_build_object('recording_id','9999000000000003','calendar_invitees',jsonb_build_array(jsonb_build_object('email','unknown@example.invalid','name','First name'))));
 if n<>1 or not exists(select 1 from public.coaching_recording_events where source_event_id='recording:9999000000000003' and client_id is null and matching_status='unmatched') then raise exception 'Uncertain identity exposed';end if;
 if has_function_privilege('authenticated','app_private.fathom_poll_tick()','execute')
 or has_function_privilege('anon','app_private.ingest_fathom_poll(uuid,jsonb)','execute')
 or has_table_privilege('authenticated','app_private.fathom_poll_state','select') then raise exception 'Worker accessible to clients';end if;
end $$;
-- Simulate an actual client JWT: private recordings remain invisible.
select set_config('request.jwt.claims',jsonb_build_object('sub',(select profile_id from public.clients where profile_id is not null limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin if exists(select 1 from public.coaching_recording_events) then raise exception 'Client can read coach recordings';end if;end $$;
rollback;

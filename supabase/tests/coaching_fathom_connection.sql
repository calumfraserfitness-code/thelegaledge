begin;
create temporary table connection_test as select id coach_id from public.profiles where role='coach' limit 1;
do $$
declare coach uuid:=(select coach_id from connection_test);status jsonb;first_result jsonb;second_result jsonb;
begin
 status:=public.coaching_fathom_config(coach,'key','rollback-test-key-only');
 if status ? 'api_key' or status ? 'key' or status ? 'signing_secret' then raise exception 'Secret exposed in status';end if;
 perform public.coaching_fathom_config(coach,'activate',null,'rollback-webhook-only','whsec_cm9sbGJhY2stdGVzdC1vbmx5');
 first_result:=public.capture_fathom_recording(coach,'999999999990',null,'unmatched',null,'Rollback-only fixture',now(),'Test summary','[]');
 second_result:=public.capture_fathom_recording(coach,'999999999990',null,'unmatched',null,'Changed summary must not overwrite',now(),'Changed','[]');
 if (first_result->>'duplicate')::boolean or not (second_result->>'duplicate')::boolean then raise exception 'Idempotence failed';end if;
 if (select summary from public.coaching_recording_events where source='fathom' and source_event_id='recording:999999999990')<>'Test summary' then raise exception 'Duplicate overwrote review';end if;
 if exists(select 1 from public.coaching_change_proposals p join public.coaching_recording_events e on e.id=p.recording_event_id where e.source_event_id='recording:999999999990') then raise exception 'Unmatched recording generated client actions';end if;
end $$;
set local role authenticated;
do $$ begin
 if has_function_privilege('public.coaching_fathom_secrets(uuid)','execute') or has_function_privilege('public.coaching_fathom_config(uuid,text,text,text,text)','execute') or has_function_privilege('public.capture_fathom_recording(uuid,text,uuid,text,text,text,timestamptz,text,jsonb)','execute') then raise exception 'Client can invoke privileged provider functions';end if;
end $$;
reset role;
rollback;

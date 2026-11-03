-- Server-owned reconciliation. No OAuth/API key is returned to clients.
create table if not exists app_private.fathom_poll_state (
 coach_id uuid primary key references public.profiles(id),
 cursor text, coverage_from timestamptz not null default now()-interval '30 days',
 window_end timestamptz, request_id bigint, requested_at timestamptz,
 next_poll_at timestamptz not null default now(), failures integer not null default 0,
 run_id uuid references public.coaching_sync_runs(id), last_http_status integer,
 last_success_at timestamptz, last_error text
);
alter table app_private.fathom_poll_state enable row level security;
revoke all on app_private.fathom_poll_state from public, anon, authenticated;

create or replace function app_private.ingest_fathom_poll(p_coach uuid,p_meeting jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare expected_email text; candidates uuid[]; cid uuid; eid uuid;
 rid text; stamp timestamptz; url text; actions jsonb;
begin
 select p.email into expected_email from public.profiles p
 join app_private.coaching_fathom_connections c on c.coach_id=p.id and c.enabled
 where p.id=p_coach and p.role='coach';
 if expected_email is null or lower(p_meeting#>>'{recorded_by,email}') is distinct from lower(expected_email) then return 0; end if;
 rid:=p_meeting->>'recording_id';
 if rid is null or rid!~'^[0-9]+$' then raise exception 'Missing recording identity';end if;
 stamp:=coalesce(p_meeting->>'recording_start_time',p_meeting->>'created_at')::timestamptz;
 if stamp is null then raise exception 'Missing recording date';end if;
 -- Exact invitee email, scoped to the coach; ambiguous matches stay private.
 select array_agg(c.id) into candidates from public.clients c
 where c.coach_id=p_coach and c.status='active' and c.profile_id is not null
 and exists(select 1 from jsonb_array_elements(coalesce(p_meeting->'calendar_invitees','[]')) i
 where nullif(lower(btrim(i->>'email')),'')=nullif(lower(btrim(c.email)),''));
 if cardinality(candidates)=1 then cid:=candidates[1];end if;
 url:=coalesce(p_meeting->>'share_url',p_meeting->>'url');
 if url is null or url!~'^https://fathom\.video/' then url:=null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('description',left(a->>'description',2000),
 'timestamp',a->>'recording_timestamp','completed',coalesce((a->>'completed')::boolean,false),'assignee',a->'assignee')),'[]')
 into actions from jsonb_array_elements(coalesce(p_meeting->'action_items','[]')) a;
 insert into public.coaching_recording_events(source,source_event_id,source_url,source_title,
 occurred_at,client_id,coach_id,matching_status,processing_status,summary,action_items,payload,analysis)
 values('fathom','recording:'||rid,url,left(coalesce(p_meeting->>'meeting_title',p_meeting->>'title','Coaching call'),500),
 stamp,cid,p_coach,case when cid is not null then 'matched' when cardinality(candidates)>1 then 'ambiguous' else 'unmatched' end,
 'received',left(coalesce(p_meeting#>>'{default_summary,markdown_formatted}',''),30000),actions,
 jsonb_build_object('recording_id',rid,'import_method','server reconciliation','transcript_retained',false),
 jsonb_build_object('extraction_method','Fathom summary and action items; coach review required'))
 on conflict(source,source_event_id) do nothing returning id into eid;
 -- Enrich prior imports, but preserve any coach-confirmed identity and analysis.
 if eid is null then
  update public.coaching_recording_events e set
   source_url=coalesce(e.source_url,url),
   summary=case when coalesce(e.summary,'')='' then left(coalesce(p_meeting#>>'{default_summary,markdown_formatted}',''),30000) else e.summary end,
   client_id=case when e.matching_status='unmatched' and e.excluded_at is null then cid else e.client_id end,
   matching_status=case when e.matching_status='unmatched' and e.excluded_at is null and cid is not null then 'matched' else e.matching_status end
  where e.source='fathom' and e.source_event_id='recording:'||rid and e.coach_id=p_coach;
 end if;
 return case when eid is null then 0 else 1 end;
end $$;
revoke all on function app_private.ingest_fathom_poll(uuid,jsonb) from public,anon,authenticated;

create or replace function app_private.fathom_poll_tick()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s record; response record; body jsonb; meeting jsonb; count_new integer;
 key_value text; owner_email text; req bigint; run uuid; err text; next_cursor text;
 total integer:=0; queued integer:=0;
begin
 if not pg_try_advisory_xact_lock(hashtext('legal-edge-fathom-poll')) then return jsonb_build_object('busy',true);end if;
 insert into app_private.fathom_poll_state(coach_id)
 select coach_id from app_private.coaching_fathom_connections where enabled on conflict do nothing;
 for s in select st.* from app_private.fathom_poll_state st
 join app_private.coaching_fathom_connections c using(coach_id) where c.enabled order by st.coach_id for update of st loop
  if s.request_id is not null then
   select * into response from net._http_response where id=s.request_id;
   if not found and s.requested_at>now()-interval '2 minutes' then continue;end if;
   err:=null;count_new:=0;
   begin
    if response.status_code is distinct from 200 or response.timed_out or response.error_msg is not null then
     err:=case when response.status_code in (401,403) then 'Fathom rejected the saved key; reconnect required'
      when response.status_code=429 then 'Fathom rate limit; automatic retry scheduled'
      else 'Fathom request failed or timed out; automatic retry scheduled' end;
    else
     body:=response.content::jsonb;
     if jsonb_typeof(body->'items') is distinct from 'array' then raise exception 'Invalid provider response';end if;
     for meeting in select value from jsonb_array_elements(body->'items') loop
      count_new:=count_new+app_private.ingest_fathom_poll(s.coach_id,meeting);
     end loop;
     next_cursor:=nullif(body->>'next_cursor','');
     update app_private.fathom_poll_state set request_id=null,requested_at=null,cursor=next_cursor,
      coverage_from=case when next_cursor is null then greatest(coverage_from,s.window_end-interval '1 day') else coverage_from end,
      window_end=case when next_cursor is null then null else window_end end,
      next_poll_at=case when next_cursor is null then now()+interval '15 minutes' else now() end,
      failures=0,last_http_status=200,last_success_at=now(),last_error=null where coach_id=s.coach_id;
     update public.coaching_sync_runs set imported=imported+count_new,
      status=case when next_cursor is null then 'complete' else 'running' end,
      finished_at=case when next_cursor is null then now() else null end where id=s.run_id;
     insert into public.coaching_sync_state(coach_id,source,mode,enabled,last_started_at,last_success_at,imported_count,coverage_from)
      values(s.coach_id,'fathom','server',true,s.requested_at,now(),count_new,s.coverage_from)
      on conflict(coach_id,source) do update set mode='server',enabled=true,last_success_at=now(),
       imported_count=public.coaching_sync_state.imported_count+count_new,last_error=null,retry_after=null;
     total:=total+count_new;
    end if;
   exception when others then err:='Fathom response could not be safely imported; automatic retry scheduled';end;
   if err is not null then
    update app_private.fathom_poll_state set request_id=null,requested_at=null,failures=failures+1,
     next_poll_at=now()+make_interval(secs=>least(3600,60*power(2,least(s.failures,6)))::integer),
     last_http_status=response.status_code,last_error=err where coach_id=s.coach_id;
    update public.coaching_sync_runs set status='failed',finished_at=now(),error=err where id=s.run_id;
    update public.coaching_sync_state set last_error=err,retry_after=now()+interval '15 minutes',mode='server' where coach_id=s.coach_id and source='fathom';
   end if;
   -- Delete transient raw provider response after harvesting; no transcript retained.
   delete from net._http_response where id=s.request_id;
  end if;
  select st.* into s from app_private.fathom_poll_state st where st.coach_id=s.coach_id;
  if s.request_id is null and s.next_poll_at<=now() then
   select v.decrypted_secret,p.email into key_value,owner_email
    from app_private.coaching_fathom_connections c join vault.decrypted_secrets v on v.id=c.key_id
    join public.profiles p on p.id=c.coach_id where c.coach_id=s.coach_id and c.enabled;
   if key_value is null then continue;end if;
   run:=s.run_id;
   if s.cursor is null or run is null or exists(select 1 from public.coaching_sync_runs where id=run and status='failed') then
    insert into public.coaching_sync_runs(coach_id,source,status) values(s.coach_id,'fathom','running') returning id into run;
   end if;
   req:=net.http_get('https://api.fathom.ai/external/v1/meetings',
    params:=jsonb_build_object('recorded_by[]',owner_email,'created_after',s.coverage_from,
    'created_before',coalesce(s.window_end,now()),'include_summary','true','include_action_items','true')
    ||case when s.cursor is null then '{}'::jsonb else jsonb_build_object('cursor',s.cursor) end,
    headers:=jsonb_build_object('X-Api-Key',key_value),timeout_milliseconds:=20000);
   update app_private.fathom_poll_state set request_id=req,requested_at=now(),run_id=run,
    window_end=case when cursor is null then now() else window_end end where coach_id=s.coach_id;
   insert into public.coaching_sync_state(coach_id,source,mode,enabled,last_started_at)
    values(s.coach_id,'fathom','server',true,now()) on conflict(coach_id,source)
    do update set mode='server',last_started_at=now();
   queued:=queued+1;
  end if;
 end loop;
 return jsonb_build_object('queued',queued,'imported',total);
end $$;
revoke all on function app_private.fathom_poll_tick() from public,anon,authenticated;
select cron.schedule('legal-edge-fathom-server-reconciliation','* * * * *','select app_private.fathom_poll_tick();');

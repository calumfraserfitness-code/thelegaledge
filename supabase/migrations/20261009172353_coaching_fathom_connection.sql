create table app_private.coaching_fathom_connections(
 coach_id uuid primary key references public.profiles(id),key_id uuid references vault.secrets(id),signing_id uuid references vault.secrets(id),
 webhook_id text,enabled boolean not null default false,verified_at timestamptz,last_received_at timestamptz);
alter table app_private.coaching_fathom_connections enable row level security;
revoke all on app_private.coaching_fathom_connections from public,anon,authenticated;
create function public.coaching_fathom_config(p_coach uuid,p_action text,p_key text default null,p_webhook text default null,p_secret text default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg app_private.coaching_fathom_connections; sid uuid;
begin
 if current_setting('role',true) not in ('service_role','none') then raise exception 'Server only' using errcode='42501';end if;
 if not exists(select 1 from public.profiles where id=p_coach and role='coach') then raise exception 'Coach required';end if;
 insert into app_private.coaching_fathom_connections(coach_id) values(p_coach) on conflict do nothing;
 select * into cfg from app_private.coaching_fathom_connections where coach_id=p_coach for update;
 if p_action='key' then
  if length(coalesce(p_key,'')) not between 10 and 1024 then raise exception 'Invalid key';end if;
  if cfg.key_id is null then select vault.create_secret(p_key,'coaching_fathom_key_'||p_coach::text) into sid;
  else sid:=cfg.key_id;perform vault.update_secret(sid,p_key);end if;
  update app_private.coaching_fathom_connections set key_id=sid,enabled=false where coach_id=p_coach;
 elsif p_action='activate' then
  if cfg.key_id is null or coalesce(p_secret,'') !~ '^whsec_[A-Za-z0-9+/=_-]+$' or length(coalesce(p_webhook,'')) not between 1 and 256 then raise exception 'Invalid webhook';end if;
  if cfg.signing_id is null then select vault.create_secret(p_secret,'coaching_fathom_signing_'||p_coach::text) into sid;
  else sid:=cfg.signing_id;perform vault.update_secret(sid,p_secret);end if;
  update app_private.coaching_fathom_connections set signing_id=sid,webhook_id=p_webhook,enabled=true,verified_at=now() where coach_id=p_coach;
 elsif p_action<>'status' then raise exception 'Invalid action';end if;
 select * into cfg from app_private.coaching_fathom_connections where coach_id=p_coach;
 return jsonb_build_object('configured',cfg.key_id is not null,'enabled',cfg.enabled,'verified_at',cfg.verified_at,'last_received_at',cfg.last_received_at);
end $$;
revoke all on function public.coaching_fathom_config(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.coaching_fathom_config(uuid,text,text,text,text) to service_role;
create function public.coaching_fathom_secrets(p_coach uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) not in ('service_role','none') then raise exception 'Server only' using errcode='42501';end if;
 return (select jsonb_build_object('enabled',c.enabled,'signing_secret',s.decrypted_secret,'email',p.email)
  from app_private.coaching_fathom_connections c join public.profiles p on p.id=c.coach_id and p.role='coach'
  left join vault.decrypted_secrets s on s.id=c.signing_id where c.coach_id=p_coach);
end $$;
revoke all on function public.coaching_fathom_secrets(uuid) from public,anon,authenticated;
grant execute on function public.coaching_fathom_secrets(uuid) to service_role;
create function public.capture_fathom_recording(p_coach uuid,p_recording text,p_client uuid,p_matching text,p_url text,p_title text,p_occurred timestamptz,p_summary text,p_actions jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 if current_setting('role',true) not in ('service_role','none') then raise exception 'Server only' using errcode='42501';end if;
 if p_recording !~ '^[0-9]+$' or p_matching not in ('matched','ambiguous','unmatched') then raise exception 'Invalid source';end if;
 if not exists(select 1 from app_private.coaching_fathom_connections where coach_id=p_coach and enabled) then raise exception 'Connection disabled';end if;
 if p_client is not null and not exists(select 1 from public.clients where id=p_client and coach_id=p_coach and status='active' and profile_id is not null) then raise exception 'Client identity invalid';end if;
 if (p_matching='matched') is distinct from (p_client is not null) then raise exception 'Client match required';end if;
 insert into public.coaching_recording_events(source,source_event_id,source_url,source_title,occurred_at,client_id,coach_id,matching_status,processing_status,summary,action_items,payload,analysis)
 values('fathom','recording:'||p_recording,p_url,p_title,p_occurred,p_client,p_coach,p_matching,'received',p_summary,p_actions,
  jsonb_build_object('recording_id',p_recording,'transcript_retained',false),
  jsonb_build_object('extraction_method','Fathom provider summary; detailed analysis pending','attention',jsonb_build_array(case when p_matching='matched' then 'Provider action items are draft evidence. Detailed extraction and coach review are still required.' else 'Client identity must be verified before any client instructions are published.' end)))
 on conflict(source,source_event_id) do nothing returning id into eid;
 update app_private.coaching_fathom_connections set last_received_at=now() where coach_id=p_coach;
 return jsonb_build_object('duplicate',eid is null);
end $$;
revoke all on function public.capture_fathom_recording(uuid,text,uuid,text,text,text,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.capture_fathom_recording(uuid,text,uuid,text,text,text,timestamptz,text,jsonb) to service_role;

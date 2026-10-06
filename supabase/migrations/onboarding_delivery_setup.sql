-- Private sender credentials; public tables expose only setup and receipt status.
create table public.coaching_onboarding_settings (
 coach_id uuid primary key references public.profiles(id),
 welcome_url text not null default '', contract_title text not null default 'Legal Edge Coaching Agreement',
 contract_version text not null default '', contract_body text not null default '',
 privacy_version text not null default '', privacy_body text not null default '',
 documents_approved boolean not null default false,
 updated_at timestamptz not null default now(),
 check (not documents_approved or (length(contract_body)>=40 and length(privacy_body)>=100 and length(contract_version)>0 and length(privacy_version)>0))
);
alter table public.coaching_onboarding_settings enable row level security;
grant select,insert,update on public.coaching_onboarding_settings to authenticated;
revoke all on public.coaching_onboarding_settings from anon;
create policy onboarding_settings_owner on public.coaching_onboarding_settings to authenticated
 using (coach_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='coach'))
 with check (coach_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='coach'));

create table app_private.onboarding_email_credentials (
 coach_id uuid primary key references public.profiles(id), secret_id uuid references vault.secrets(id),
 sender text not null, enabled boolean not null default false, verified_at timestamptz not null default now()
);
alter table app_private.onboarding_email_credentials enable row level security;
revoke all on app_private.onboarding_email_credentials from anon,authenticated;

create table public.document_copy_deliveries (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id),
 coach_id uuid not null references public.profiles(id), consent_id uuid not null references public.legal_consents(id),
 recipient_kind text not null check(recipient_kind in ('client','coach')), recipient text not null,
 status text not null default 'queued' check(status in ('queued','sending','accepted','needs_review')),
 attempts integer not null default 0, first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),
 lease_until timestamptz, lease_token uuid, provider_id text, last_error text, accepted_at timestamptz,
 created_at timestamptz not null default now(), unique(consent_id,recipient_kind)
);
alter table public.document_copy_deliveries enable row level security;
grant select on public.document_copy_deliveries to authenticated;
revoke all on public.document_copy_deliveries from anon;
create policy copy_receipt_owner_read on public.document_copy_deliveries for select to authenticated
 using (coach_id=auth.uid() or (recipient_kind='client' and exists(select 1 from public.clients c where c.id=client_id and c.profile_id=auth.uid())));
create index document_copy_pending on public.document_copy_deliveries(status,next_attempt_at);
create table app_private.document_copy_snapshots (
 consent_id uuid primary key references public.legal_consents(id), bundle jsonb not null
);
alter table app_private.document_copy_snapshots enable row level security;
revoke all on app_private.document_copy_snapshots from anon,authenticated;

create function private.queue_signed_document_copies() returns trigger language plpgsql security definer set search_path='' as $$
declare j public.onboarding_journeys; c public.clients; client_email text; coach_email text;
begin
 select * into j from public.onboarding_journeys where client_id=new.client_id;
 if j.signed_at is null or new.source_system is not null or new.document_version is distinct from j.privacy_version
 or new.visible_content is distinct from j.privacy_body or new.consent_type is distinct from 'coaching_privacy_health'
 or new.details->>'health_data_explicit_consent' is distinct from 'true'
 or lower(trim(new.signature_name)) is distinct from lower(trim(j.signature_name)) then return new; end if;
 select * into c from public.clients where id=new.client_id;
 if auth.uid() is distinct from c.profile_id then return new; end if;
 select email into client_email from auth.users where id=c.profile_id and email_confirmed_at is not null;
 select email into coach_email from auth.users where id=c.coach_id and email_confirmed_at is not null;
 if client_email is null or coach_email is null then return new; end if;
 insert into app_private.document_copy_snapshots(consent_id,bundle) values(new.id,jsonb_build_object(
 'client_id',c.id,'contract_title',j.contract_title,'contract_version',j.contract_version,'contract_body',j.contract_body,
 'signature_name',j.signature_name,'address',j.address,'signed_at',j.signed_at,
 'privacy_version',new.document_version,'privacy_body',new.visible_content,'privacy_accepted_at',new.accepted_at,
 'record_hash',encode(extensions.digest(j.contract_body||new.visible_content||j.signature_name||j.signed_at::text,'sha256'),'hex')))
 on conflict(consent_id) do nothing;
 insert into public.document_copy_deliveries(client_id,coach_id,consent_id,recipient_kind,recipient)
 values(c.id,c.coach_id,new.id,'client',client_email),(c.id,c.coach_id,new.id,'coach',coach_email)
 on conflict(consent_id,recipient_kind) do nothing;
 return new;
end $$;
revoke all on function private.queue_signed_document_copies() from public,anon,authenticated;
create trigger queue_signed_copies after insert or update on public.legal_consents for each row execute function private.queue_signed_document_copies();

create function public.onboarding_email_config(p_coach uuid,p_action text,p_key text default null,p_sender text default null,p_enabled boolean default false)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg app_private.onboarding_email_credentials; sid uuid;
begin
 if current_setting('role',true) not in ('service_role','none') then raise exception 'Server only' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=p_coach and role='coach') then raise exception 'Coach required'; end if;
 select * into cfg from app_private.onboarding_email_credentials where coach_id=p_coach for update;
 if p_action='save' then
  if coalesce(p_key,'') !~ '^re_[A-Za-z0-9_-]{10,}$' or coalesce(p_sender,'') !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then raise exception 'Valid key and sender required'; end if;
  if cfg.secret_id is null then select vault.create_secret(p_key,'onboarding_email_'||p_coach::text) into sid;
  else sid:=cfg.secret_id; perform vault.update_secret(sid,p_key); end if;
  insert into app_private.onboarding_email_credentials(coach_id,secret_id,sender,enabled) values(p_coach,sid,p_sender,p_enabled)
  on conflict(coach_id) do update set secret_id=excluded.secret_id,sender=excluded.sender,enabled=excluded.enabled,verified_at=now();
 elsif p_action='disable' then update app_private.onboarding_email_credentials set enabled=false where coach_id=p_coach;
 elsif p_action<>'status' then raise exception 'Invalid action'; end if;
 select * into cfg from app_private.onboarding_email_credentials where coach_id=p_coach;
 return jsonb_build_object('configured',cfg.secret_id is not null,'sender',cfg.sender,'enabled',coalesce(cfg.enabled,false),'verified_at',cfg.verified_at);
end $$;
revoke all on function public.onboarding_email_config(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.onboarding_email_config(uuid,text,text,text,boolean) to service_role;

do $$ begin
 if not exists(select 1 from vault.secrets where name='legal_edge_onboarding_worker') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'legal_edge_onboarding_worker','Server-only signed copy worker');
 end if;
end $$;
create function public.onboarding_email_worker_allowed(p_token text) returns boolean language sql security definer set search_path='' as $$
 select coalesce(length(p_token)>=32 and exists(select 1 from vault.decrypted_secrets where name='legal_edge_onboarding_worker' and decrypted_secret=p_token),false)
$$;
revoke all on function public.onboarding_email_worker_allowed(text) from public,anon,authenticated;
grant execute on function public.onboarding_email_worker_allowed(text) to service_role;

create function public.claim_document_copies() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if current_setting('role',true) not in ('service_role','none') then raise exception 'Server only' using errcode='42501'; end if;
 update public.document_copy_deliveries set status='needs_review',last_error='Retry window expired; check provider receipt before resending'
 where status in ('queued','sending') and first_attempt_at<now()-interval '23 hours';
 with eligible as (select d.id from public.document_copy_deliveries d join app_private.onboarding_email_credentials c on c.coach_id=d.coach_id and c.enabled
 where (d.status='queued' and d.next_attempt_at<=now()) or (d.status='sending' and d.lease_until<now())
 order by d.created_at limit 10 for update of d skip locked), claimed as (
 update public.document_copy_deliveries d set status='sending',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '10 minutes',lease_token=gen_random_uuid()
 from eligible e where d.id=e.id returning d.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'lease_token',d.lease_token,'recipient',d.recipient,'recipient_kind',d.recipient_kind,
 'sender',c.sender,'api_key',v.decrypted_secret,'bundle',s.bundle)),'[]'::jsonb) into result from claimed d
 join app_private.onboarding_email_credentials c on c.coach_id=d.coach_id
 join vault.decrypted_secrets v on v.id=c.secret_id join app_private.document_copy_snapshots s on s.consent_id=d.consent_id;
 return result;
end $$;
revoke all on function public.claim_document_copies() from public,anon,authenticated;
grant execute on function public.claim_document_copies() to service_role;
create function public.finish_document_copy(p_id uuid,p_lease uuid,p_provider_id text default null,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$ begin
 if current_setting('role',true) not in ('service_role','none') then raise exception 'Server only' using errcode='42501'; end if;
 update public.document_copy_deliveries set status=case when p_provider_id is not null then 'accepted' else 'queued' end,
 provider_id=p_provider_id,last_error=left(p_error,200),accepted_at=case when p_provider_id is not null then now() end,
 lease_until=null,lease_token=null,next_attempt_at=now()+interval '5 minutes'*least(12,greatest(1,attempts))
 where id=p_id and lease_token=p_lease and status='sending';
end $$;
revoke all on function public.finish_document_copy(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_document_copy(uuid,uuid,text,text) to service_role;

-- Fix overescaped provider hostnames: valid official links previously failed enrollment.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('private.journey_action(uuid,text,jsonb)'::regprocedure);
 definition:=replace(definition,chr(92)||chr(92)||'.',chr(92)||'.');
 execute definition;
end $$;

select cron.schedule('legal-edge-signed-copies','*/2 * * * *',$cron$
 select net.http_post(url:='https://baxvhilvrhshlfizakak.supabase.co/functions/v1/onboarding-mail',
 headers:=jsonb_build_object('Content-Type','application/json','x-worker-key',(select decrypted_secret from vault.decrypted_secrets where name='legal_edge_onboarding_worker')),
 body:='{}'::jsonb,timeout_milliseconds:=20000)
 where exists(select 1 from public.document_copy_deliveries d join app_private.onboarding_email_credentials c on c.coach_id=d.coach_id and c.enabled where d.status in ('queued','sending'));
$cron$);

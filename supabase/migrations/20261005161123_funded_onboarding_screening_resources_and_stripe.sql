alter table public.onboarding_journeys
 add column funding_mode text not null default 'personal' check(funding_mode in ('personal','corporate')),
 add column funding_reference text,
 add column payment_url text,
 add column stripe_payment_link_id text,
 add column payment_match_token text not null default encode(extensions.gen_random_bytes(24),'hex') unique,
 add column privacy_body text, add column privacy_version text,
 add column screening_status text not null default 'not_submitted' check(screening_status in ('not_submitted','no_flags','needs_review','reviewed')),
 add column screening_review_note text, add column screening_reviewed_by uuid references public.profiles(id), add column screening_reviewed_at timestamptz;
create or replace function private.journey_action(p_client uuid,p_action text,p_data jsonb) returns public.onboarding_journeys language plpgsql security definer set search_path='' as $$
declare c public.clients; j public.onboarding_journeys;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into c from public.clients where id=p_client for update;
 if c.id is null or (c.coach_id is distinct from auth.uid() and c.profile_id is distinct from auth.uid()) then raise exception 'Client access required'; end if;
 select * into j from public.onboarding_journeys where client_id=p_client for update;
 if p_action='enroll' then
  if c.coach_id is distinct from auth.uid() then raise exception 'Coach required'; end if;
  if c.onboarding_status='complete' or c.plan_status='published' then raise exception 'Existing completed clients keep their current access'; end if;
  if j.client_id is not null then return j; end if;
  if coalesce(p_data->>'welcome_url','') !~ '^https://' or length(trim(coalesce(p_data->>'contract_body','')))<40 or length(trim(coalesce(p_data->>'contract_version','')))=0 or length(trim(coalesce(p_data->>'contract_title','')))=0 then raise exception 'Welcome video URL and versioned agreement required'; end if;
  if length(trim(coalesce(p_data->>'privacy_body','')))<100 or length(trim(coalesce(p_data->>'privacy_version','')))=0 then raise exception 'Approved versioned privacy notice required'; end if;
  if coalesce(p_data->>'funding_mode','personal') not in ('personal','corporate') then raise exception 'Invalid funding mode'; end if;
  if p_data->>'funding_mode'='corporate' and (length(trim(coalesce(p_data->>'funding_reference','')))<3 or not exists(select 1 from public.firm_participants fp join public.firm_pilots p on p.id=fp.pilot_id where fp.client_id=p_client and fp.status in ('invited','active') and p.coach_id=c.coach_id)) then raise exception 'Linked firm place and funding approval required'; end if;
  if coalesce(p_data->>'payment_url','')<>'' and coalesce(p_data->>'payment_url','') !~ '^https://(buy\.stripe\.com/|revolut\.me/|checkout\.revolut\.com/)' then raise exception 'Use an official Stripe or Revolut payment link'; end if;
  if coalesce(p_data->>'stripe_payment_link_id','')<>'' and (p_data->>'stripe_payment_link_id' !~ '^plink_[A-Za-z0-9]+$' or coalesce(p_data->>'payment_url','') !~ '^https://buy\.stripe\.com/') then raise exception 'Stripe payment link ID and URL required'; end if;
  insert into public.onboarding_journeys(client_id,welcome_url,contract_title,contract_version,contract_body,privacy_body,privacy_version,funding_mode,funding_reference,payment_url,stripe_payment_link_id,stage,payment_confirmed_at,payment_confirmed_by)
  values(p_client,p_data->>'welcome_url',p_data->>'contract_title',p_data->>'contract_version',p_data->>'contract_body',p_data->>'privacy_body',p_data->>'privacy_version',coalesce(p_data->>'funding_mode','personal'),nullif(p_data->>'funding_reference',''),nullif(p_data->>'payment_url',''),nullif(p_data->>'stripe_payment_link_id',''),case when p_data->>'funding_mode'='corporate' then 'welcome' else 'payment' end,case when p_data->>'funding_mode'='corporate' then now() end,case when p_data->>'funding_mode'='corporate' then auth.uid() end) returning * into j;
 elsif p_action='payment' then
  if c.coach_id is distinct from auth.uid() then raise exception 'Coach required'; end if;
  if j.stage<>'payment' then return j; end if;
  if length(trim(coalesce(p_data->>'reference','')))<3 then raise exception 'Payment receipt or reference required'; end if;
  update public.onboarding_journeys set stage='welcome',payment_reference=p_data->>'reference',payment_confirmed_by=auth.uid(),payment_confirmed_at=now(),stage_started_at=now() where client_id=p_client returning * into j;
 elsif p_action='welcome' then
  if c.profile_id is distinct from auth.uid() then raise exception 'Client required'; end if;
  if j.stage='contract' then return j; end if;
  if j.stage<>'welcome' or j.payment_confirmed_at is null then raise exception 'Complete the previous step first'; end if;
  update public.onboarding_journeys set stage='contract',welcomed_at=now(),stage_started_at=now() where client_id=p_client returning * into j;
 elsif p_action='sign' then
  if c.profile_id is distinct from auth.uid() then raise exception 'Client required'; end if;
  if j.signed_at is not null then return j; end if;
  if j.stage<>'contract' or j.welcomed_at is null then raise exception 'Complete the previous step first'; end if;
  if length(trim(coalesce(p_data->>'name','')))<2 or length(trim(coalesce(p_data->>'address','')))<8 or p_data->>'consent' is distinct from 'true' then raise exception 'Legal name, postal address and electronic signature consent required'; end if;
  update public.onboarding_journeys set signature_name=trim(p_data->>'name'),address=trim(p_data->>'address'),signed_at=now(),stage_started_at=now() where client_id=p_client returning * into j;
 elsif p_action='screening_review' then
  if c.coach_id is distinct from auth.uid() then raise exception 'Coach required'; end if;
  if j.stage<>'review' or j.screening_status<>'needs_review' or length(trim(coalesce(p_data->>'note','')))<10 then raise exception 'Intake requiring review and review note required'; end if;
  update public.onboarding_journeys set screening_status='reviewed',screening_review_note=p_data->>'note',screening_reviewed_by=auth.uid(),screening_reviewed_at=now() where client_id=p_client returning * into j;
 else raise exception 'Unknown action'; end if;
 if j.client_id is null then raise exception 'Journey not enrolled'; end if;
 return j;
end $$;

create table public.onboarding_drafts(client_id uuid primary key references public.clients(id) on delete cascade,responses jsonb not null default '{}'::jsonb,step integer not null default 0 check(step between 0 and 4),updated_at timestamptz not null default now());
alter table public.onboarding_drafts enable row level security;
grant select,insert,update on public.onboarding_drafts to authenticated;
revoke all on public.onboarding_drafts from anon;
create policy draft_read on public.onboarding_drafts for select to authenticated using(exists(select 1 from public.clients c where c.id=client_id and (c.profile_id=auth.uid() or c.coach_id=auth.uid())));
create policy draft_insert on public.onboarding_drafts for insert to authenticated with check(exists(select 1 from public.clients c join public.onboarding_journeys j on j.client_id=c.id where c.id=client_id and c.profile_id=auth.uid() and j.stage='intake'));
create policy draft_update on public.onboarding_drafts for update to authenticated using(exists(select 1 from public.clients c join public.onboarding_journeys j on j.client_id=c.id where c.id=client_id and c.profile_id=auth.uid() and j.stage='intake')) with check(exists(select 1 from public.clients c join public.onboarding_journeys j on j.client_id=c.id where c.id=client_id and c.profile_id=auth.uid() and j.stage='intake'));
create table public.coaching_start_resources(id uuid primary key default gen_random_uuid(),coach_id uuid not null references public.profiles(id),title text not null check(length(trim(title))>0),body text not null,resource_url text check(resource_url is null or resource_url ~ '^https://'),published boolean not null default false,created_at timestamptz not null default now());
create index start_resources_coach on public.coaching_start_resources(coach_id,published);
alter table public.coaching_start_resources enable row level security;
revoke all on public.coaching_start_resources from anon;
grant select,insert,update on public.coaching_start_resources to authenticated;
create policy start_resource_read on public.coaching_start_resources for select to authenticated using(coach_id=auth.uid() or (published and exists(select 1 from public.clients c join public.onboarding_journeys j on j.client_id=c.id where c.coach_id=coaching_start_resources.coach_id and c.profile_id=auth.uid() and j.stage in ('review','ready'))));
create policy start_resource_insert on public.coaching_start_resources for insert to authenticated with check(coach_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='coach'));
create policy start_resource_update on public.coaching_start_resources for update to authenticated using(coach_id=auth.uid()) with check(coach_id=auth.uid());
create function private.journey_screening() returns trigger language plpgsql security definer set search_path='' as $$
declare has_flags boolean; n text;begin
 if new.version<3 then return new; end if;
 foreach n in array array['heart_condition','chest_pain','fainting','medical_restriction','pregnancy','joint_condition','medication'] loop
  if coalesce(new.responses->'sections'->'health'->>n,'') not in ('yes','no') then raise exception 'Complete every health screening answer'; end if;
 end loop;
 select exists(select 1 from jsonb_each_text(new.responses->'sections'->'health') x where x.key=any(array['heart_condition','chest_pain','fainting','medical_restriction','pregnancy','joint_condition','medication']) and x.value='yes') into has_flags;
 if has_flags and length(trim(coalesce(new.responses->'sections'->'health'->>'health_details','')))<3 then raise exception 'Add details for health screening review'; end if;
 update public.onboarding_journeys set screening_status=case when has_flags then 'needs_review' else 'no_flags' end,screening_review_note=null,screening_reviewed_at=null,screening_reviewed_by=null where client_id=new.client_id;
 return new;end $$;
revoke all on function private.journey_screening() from public,anon,authenticated;
create trigger journey_screening before insert or update on public.onboarding_responses for each row execute function private.journey_screening();
create function private.journey_screening_publish() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.plan_status='published' and old.plan_status is distinct from 'published' and exists(select 1 from public.onboarding_journeys where client_id=new.id and screening_status='needs_review') then raise exception 'Review flagged health answers before publishing'; end if;return new;end $$;
revoke all on function private.journey_screening_publish() from public,anon,authenticated;
create trigger journey_screening_publish before update on public.clients for each row execute function private.journey_screening_publish();
create table private.onboarding_payment_events(event_id text primary key,client_id uuid not null references public.clients(id),received_at timestamptz not null default now());
alter table private.onboarding_payment_events enable row level security;
revoke all on private.onboarding_payment_events from public,anon,authenticated;
create function public.onboarding_stripe_secret() returns text language sql security definer set search_path='' as $$ select decrypted_secret from vault.decrypted_secrets where name='onboarding_stripe_webhook_secret' $$;
revoke all on function public.onboarding_stripe_secret() from public,anon,authenticated;
grant execute on function public.onboarding_stripe_secret() to service_role;
create function public.onboarding_stripe_paid(p_event text,p_token text,p_link text,p_session text) returns boolean language plpgsql security definer set search_path='' as $$
declare j public.onboarding_journeys;begin
 select * into j from public.onboarding_journeys where payment_match_token=p_token and stripe_payment_link_id=p_link and funding_mode='personal' for update;
 if j.client_id is null then return false; end if;
 insert into private.onboarding_payment_events(event_id,client_id) values(p_event,j.client_id) on conflict do nothing;
 if not found then return true; end if;
 update public.onboarding_journeys set stage='welcome',payment_reference=p_session,payment_confirmed_at=now(),stage_started_at=now() where client_id=j.client_id and stage='payment';
 return true;end $$;
revoke all on function public.onboarding_stripe_paid(text,text,text,text) from public,anon,authenticated;
grant execute on function public.onboarding_stripe_paid(text,text,text,text) to service_role;

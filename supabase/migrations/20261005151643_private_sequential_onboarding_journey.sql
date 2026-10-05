-- Separate enrollment preserves all existing client access. Authenticated callers
-- cannot write journey evidence directly; guarded RPCs enforce transitions.
create table public.onboarding_journeys (
 client_id uuid primary key references public.clients(id) on delete cascade,
 stage text not null default 'payment' check(stage in ('payment','welcome','contract','intake','review','ready')),
 welcome_url text not null check(welcome_url ~ '^https://'),
 contract_title text not null, contract_version text not null, contract_body text not null,
 payment_reference text, payment_confirmed_at timestamptz, payment_confirmed_by uuid references public.profiles(id),
 welcomed_at timestamptz, signature_name text, address text, signed_at timestamptz,
 intake_completed_at timestamptz, created_at timestamptz not null default now(), stage_started_at timestamptz not null default now()
);
alter table public.onboarding_journeys enable row level security;
revoke all on public.onboarding_journeys from anon, authenticated;
grant select on public.onboarding_journeys to authenticated;
create policy journey_private_read on public.onboarding_journeys for select to authenticated using(exists(select 1 from public.clients c where c.id=client_id and (c.profile_id=auth.uid() or c.coach_id=auth.uid())));
create function private.journey_action(p_client uuid,p_action text,p_data jsonb) returns public.onboarding_journeys language plpgsql security definer set search_path='' as $$
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
  insert into public.onboarding_journeys(client_id,welcome_url,contract_title,contract_version,contract_body) values(p_client,p_data->>'welcome_url',p_data->>'contract_title',p_data->>'contract_version',p_data->>'contract_body') returning * into j;
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
 else raise exception 'Unknown action'; end if;
 if j.client_id is null then raise exception 'Journey not enrolled'; end if;
 return j;
end $$;
revoke all on function private.journey_action(uuid,text,jsonb) from public,anon;
grant execute on function private.journey_action(uuid,text,jsonb) to authenticated;
create function public.journey_action(p_client uuid,p_action text,p_data jsonb default '{}'::jsonb) returns public.onboarding_journeys language sql security invoker set search_path='' as $$ select private.journey_action(p_client,p_action,p_data) $$;
revoke all on function public.journey_action(uuid,text,jsonb) from public,anon;
grant execute on function public.journey_action(uuid,text,jsonb) to authenticated;
create function private.journey_gate() returns trigger language plpgsql security definer set search_path='' as $$
declare j public.onboarding_journeys;
begin
 select * into j from public.onboarding_journeys where client_id=new.client_id for update;
 if j.client_id is null then return new; end if;
 if tg_table_name='legal_consents' then
  if j.signed_at is null then raise exception 'Sign the agreement first'; end if;
  update public.onboarding_journeys set stage='intake',stage_started_at=now() where client_id=new.client_id and stage='contract';
 else
  if j.stage not in ('intake','review','ready') then raise exception 'Complete the agreement and consent first'; end if;
  if new.completed_at is null or coalesce(new.responses->'sections','{}'::jsonb)='{}'::jsonb then raise exception 'Completed intake required'; end if;
  update public.onboarding_journeys set stage='review',intake_completed_at=coalesce(intake_completed_at,now()),stage_started_at=case when stage='intake' then now() else stage_started_at end where client_id=new.client_id and stage='intake';
 end if;
 return new;
end $$;
revoke all on function private.journey_gate() from public,anon,authenticated;
create trigger journey_legal_gate before insert or update on public.legal_consents for each row execute function private.journey_gate();
create trigger journey_intake_gate before insert or update on public.onboarding_responses for each row execute function private.journey_gate();
create function private.journey_publish() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.plan_status='published' and old.plan_status is distinct from 'published' then
  if exists(select 1 from public.onboarding_journeys where client_id=new.id and stage<>'review' and stage<>'ready') then raise exception 'Complete client onboarding before publishing'; end if;
  update public.onboarding_journeys set stage='ready',stage_started_at=now() where client_id=new.id and stage='review';
 end if; return new; end $$;
revoke all on function private.journey_publish() from public,anon,authenticated;
create trigger journey_publish before update on public.clients for each row execute function private.journey_publish();

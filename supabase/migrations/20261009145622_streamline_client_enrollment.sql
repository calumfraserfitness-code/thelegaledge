alter table public.onboarding_journeys add column if not exists payment_handled_externally boolean not null default false;
alter table public.onboarding_journeys drop constraint onboarding_journeys_welcome_url_check;
alter table public.onboarding_journeys add constraint onboarding_journeys_welcome_url_check check(welcome_url='' or welcome_url ~ '^https://');
CREATE OR REPLACE FUNCTION private.journey_action(p_client uuid, p_action text, p_data jsonb)
 RETURNS onboarding_journeys
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if (coalesce(p_data->>'welcome_url','')<>'' and coalesce(p_data->>'welcome_url','') !~ '^https://') or length(trim(coalesce(p_data->>'contract_body','')))<40 or length(trim(coalesce(p_data->>'contract_version','')))=0 or length(trim(coalesce(p_data->>'contract_title','')))=0 then raise exception 'Versioned agreement and a valid optional welcome URL required'; end if;
  if length(trim(coalesce(p_data->>'privacy_body','')))<100 or length(trim(coalesce(p_data->>'privacy_version','')))=0 then raise exception 'Approved versioned privacy notice required'; end if;
  if coalesce(p_data->>'funding_mode','personal') not in ('personal','corporate') then raise exception 'Invalid funding mode'; end if;
  if p_data->>'funding_mode'='corporate' and (length(trim(coalesce(p_data->>'funding_reference','')))<3 or not exists(select 1 from public.firm_participants fp join public.firm_pilots p on p.id=fp.pilot_id where fp.client_id=p_client and fp.status in ('invited','active') and p.coach_id=c.coach_id)) then raise exception 'Linked firm place and funding approval required'; end if;
  if coalesce(p_data->>'payment_url','')<>'' and coalesce(p_data->>'payment_url','') !~ '^https://(buy\.stripe\.com/|revolut\.me/|checkout\.revolut\.com/)' then raise exception 'Use an official Stripe or Revolut payment link'; end if;
  if coalesce(p_data->>'stripe_payment_link_id','')<>'' and (p_data->>'stripe_payment_link_id' !~ '^plink_[A-Za-z0-9]+$' or coalesce(p_data->>'payment_url','') !~ '^https://buy\.stripe\.com/') then raise exception 'Stripe payment link ID and URL required'; end if;
  insert into public.onboarding_journeys(client_id,welcome_url,contract_title,contract_version,contract_body,privacy_body,privacy_version,funding_mode,funding_reference,payment_url,stripe_payment_link_id,stage,payment_confirmed_at,payment_confirmed_by,payment_handled_externally,welcomed_at)
  values(p_client,coalesce(p_data->>'welcome_url',''),p_data->>'contract_title',p_data->>'contract_version',p_data->>'contract_body',p_data->>'privacy_body',p_data->>'privacy_version',coalesce(p_data->>'funding_mode','personal'),nullif(p_data->>'funding_reference',''),nullif(p_data->>'payment_url',''),nullif(p_data->>'stripe_payment_link_id',''),case when p_data->>'payment_handled_externally'='true' then 'contract' when p_data->>'funding_mode'='corporate' then 'welcome' else 'payment' end,case when p_data->>'funding_mode'='corporate' then now() end,case when p_data->>'funding_mode'='corporate' then auth.uid() end,coalesce(p_data->>'payment_handled_externally'='true',false),case when p_data->>'payment_handled_externally'='true' then now() end) returning * into j;
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
end $function$

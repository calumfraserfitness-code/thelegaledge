-- Corporate compliance launch gate, participant withdrawal and privacy requests.
-- Apply only after the accompanying policies and contract pack have been reviewed.

create table if not exists public.firm_pilot_launch_checks (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.firm_pilots(id) on delete cascade,
  check_key text not null check (check_key in (
    'services_agreement','data_roles','participant_notice','participant_agreement',
    'dpia','insurance','security_review','subprocessor_register',
    'incident_contacts','synthetic_end_to_end_test'
  )),
  status text not null default 'pending' check (status in ('pending','verified')),
  evidence_note text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pilot_id, check_key),
  check ((status='verified' and verified_by is not null and verified_at is not null) or status='pending')
);

alter table public.firm_pilot_launch_checks enable row level security;
revoke all on public.firm_pilot_launch_checks from public, anon;
grant select, update on public.firm_pilot_launch_checks to authenticated;

create policy firm_launch_check_coach_read on public.firm_pilot_launch_checks
for select to authenticated using (exists (
  select 1 from public.firm_pilots p
  where p.id=pilot_id and p.coach_id=(select auth.uid()) and (select private.is_coach())
));

create policy firm_launch_check_coach_update on public.firm_pilot_launch_checks
for update to authenticated using (exists (
  select 1 from public.firm_pilots p
  where p.id=pilot_id and p.coach_id=(select auth.uid()) and (select private.is_coach())
)) with check (exists (
  select 1 from public.firm_pilots p
  where p.id=pilot_id and p.coach_id=(select auth.uid()) and (select private.is_coach())
));

create or replace function private.seed_firm_launch_checks(target_pilot uuid)
returns void language sql security definer set search_path='' as $$
  insert into public.firm_pilot_launch_checks(pilot_id,check_key)
  select target_pilot,k from unnest(array[
    'services_agreement','data_roles','participant_notice','participant_agreement',
    'dpia','insurance','security_review','subprocessor_register',
    'incident_contacts','synthetic_end_to_end_test'
  ]) k on conflict(pilot_id,check_key) do nothing;
$$;
revoke all on function private.seed_firm_launch_checks(uuid) from public,anon,authenticated;

create or replace function private.seed_new_firm_launch_checks()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.seed_firm_launch_checks(new.id);
  return new;
end $$;
revoke all on function private.seed_new_firm_launch_checks() from public,anon,authenticated;

drop trigger if exists seed_firm_launch_checks on public.firm_pilots;
create trigger seed_firm_launch_checks after insert on public.firm_pilots
for each row execute function private.seed_new_firm_launch_checks();

select private.seed_firm_launch_checks(id) from public.firm_pilots;

create or replace function private.guard_firm_pilot_launch()
returns trigger language plpgsql security definer set search_path='' as $$
declare missing_count integer;
begin
  if new.status in ('inviting','active') and old.status is distinct from new.status then
    perform private.seed_firm_launch_checks(new.id);
    select count(*) into missing_count from public.firm_pilot_launch_checks
      where pilot_id=new.id and status<>'verified';
    if missing_count>0 then
      raise exception 'Pilot launch blocked: % mandatory compliance checks remain',missing_count using errcode='23514';
    end if;
    if new.start_date is null or new.end_date is null then
      raise exception 'Pilot launch blocked: approved start and end dates are required' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_firm_pilot_launch() from public,anon,authenticated;

drop trigger if exists guard_firm_pilot_launch on public.firm_pilots;
create trigger guard_firm_pilot_launch before update of status on public.firm_pilots
for each row execute function private.guard_firm_pilot_launch();

-- Eight is the minimum for quantitative sponsor outcome reporting. A five-person
-- service pilot therefore remains delivery-only even if all five respond.
create or replace function public.firm_pilot_summary(target_pilot_id uuid)
returns table (phase text, respondents bigint, energy numeric, sleep numeric,
  stress numeric, workload numeric, consistency numeric)
language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.firm_pilots p where p.id=target_pilot_id
      and p.coach_id=(select auth.uid()) and (select private.is_coach())
  ) then raise exception 'Not authorized for this pilot' using errcode='42501'; end if;
  return query
    select a.phase,count(*)::bigint,round(avg(a.energy),1),round(avg(a.sleep),1),
      round(avg(a.stress),1),round(avg(a.workload),1),round(avg(a.consistency),1)
    from public.firm_assessments a
    join public.firm_participants m on m.id=a.participant_id
    join public.firm_consents consent on consent.participant_id=m.id
    join public.firm_pilots p on p.id=m.pilot_id
    where p.id=target_pilot_id and m.status<>'withdrawn'
    group by a.phase,p.minimum_report_count
    having count(*)>=greatest(8,p.minimum_report_count);
end $$;
revoke all on function public.firm_pilot_summary(uuid) from public,anon;
grant execute on function public.firm_pilot_summary(uuid) to authenticated;

create or replace function public.firm_weekly_summary(target_pilot_id uuid,target_week date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare threshold integer; result jsonb;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.firm_pilots p where p.id=target_pilot_id
      and (p.coach_id=(select auth.uid()) or exists(
        select 1 from public.firm_employer_access a
        where a.organization_id=p.organization_id and a.user_id=(select auth.uid())
      ))
  ) then raise exception 'Assigned firm access required' using errcode='42501'; end if;
  if target_week is null or extract(isodow from target_week)<>1 then
    raise exception 'Choose a Monday';
  end if;
  select greatest(8,minimum_report_count) into threshold from public.firm_pilots where id=target_pilot_id;
  with latest as (
    select distinct on(c.client_id) c.client_id,c.energy,c.sleep,c.stress
    from public.checkins c
    join public.firm_participants m on m.client_id=c.client_id
    join public.firm_consents consent on consent.participant_id=m.id and consent.client_id=c.client_id
    where m.pilot_id=target_pilot_id and m.status<>'withdrawn' and consent.include_weekly_ratings
      and c.submitted_at>=consent.accepted_at and c.submitted_at>=m.joined_at
      and (c.period_start=target_week or (c.period_start is null and c.submitted_at::date between target_week and target_week+6))
    order by c.client_id,c.submitted_at desc,c.id desc
  ), metrics as (
    select count(*) n,count(energy) en,avg(energy) ea,count(sleep) sn,avg(sleep) sa,count(stress) stn,avg(stress) sta from latest
  ) select jsonb_build_object(
    'pilot_id',target_pilot_id,'week_start',target_week,'minimum_count',threshold,
    'respondents',case when n>=threshold then n end,
    'energy',case when en>=threshold then round(ea,1) end,'energy_count',en,
    'sleep',case when sn>=threshold then round(sa,1) end,'sleep_count',sn,
    'stress',case when stn>=threshold then round(sta,1) end,'stress_count',stn
  ) into result from metrics;
  return result;
end $$;
revoke all on function public.firm_weekly_summary(uuid,date) from public,anon;
grant execute on function public.firm_weekly_summary(uuid,date) to authenticated;

alter table public.firm_consents add column if not exists withdrawn_at timestamptz;

create or replace function public.withdraw_from_firm_pilot(target_participant_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare target_client uuid;
begin
  select m.client_id into target_client from public.firm_participants m
  join public.clients c on c.id=m.client_id
  where m.id=target_participant_id and c.profile_id=(select auth.uid());
  if target_client is null then raise exception 'Your pilot membership was not found' using errcode='42501'; end if;
  update public.firm_participants set status='withdrawn' where id=target_participant_id;
  update public.firm_consents set withdrawn_at=now(),include_weekly_ratings=false where participant_id=target_participant_id;
  insert into public.audit_events(client_id,event_type,details)
    values(target_client,'firm_pilot_withdrawal',jsonb_build_object('participant_id',target_participant_id));
end $$;
revoke all on function public.withdraw_from_firm_pilot(uuid) from public,anon;
grant execute on function public.withdraw_from_firm_pilot(uuid) to authenticated;

create table if not exists public.data_rights_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id),
  client_id uuid not null references public.clients(id),
  request_type text not null check(request_type in ('access','correction','deletion','restriction','portability','objection','consent_withdrawal')),
  details text not null check(length(trim(details)) between 3 and 2000),
  status text not null default 'received' check(status in ('received','identity_check','in_progress','completed','refused')),
  received_at timestamptz not null default now(),
  due_at timestamptz not null default (now()+interval '1 month'),
  completed_at timestamptz,
  response_note text,
  handled_by uuid references public.profiles(id)
);
alter table public.data_rights_requests enable row level security;
revoke all on public.data_rights_requests from public,anon;
grant select,update on public.data_rights_requests to authenticated;
create policy rights_request_participant_read on public.data_rights_requests for select to authenticated
  using(requester_id=(select auth.uid()));
create policy rights_request_coach_manage on public.data_rights_requests for all to authenticated
  using(exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()) and (select private.is_coach())))
  with check(exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()) and (select private.is_coach())));

create or replace function public.submit_data_rights_request(request_type text,request_details text)
returns uuid language plpgsql security definer set search_path='' as $$
declare target_client uuid; request_id uuid;
begin
  if request_type not in ('access','correction','deletion','restriction','portability','objection','consent_withdrawal') then raise exception 'Unsupported request type'; end if;
  if length(trim(coalesce(request_details,'')))<3 then raise exception 'Add a short description of your request'; end if;
  select id into target_client from public.clients where profile_id=(select auth.uid()) order by created_at desc limit 1;
  if target_client is null then raise exception 'Client account not found' using errcode='42501'; end if;
  insert into public.data_rights_requests(requester_id,client_id,request_type,details)
    values((select auth.uid()),target_client,request_type,trim(request_details)) returning id into request_id;
  return request_id;
end $$;
revoke all on function public.submit_data_rights_request(text,text) from public,anon;
grant execute on function public.submit_data_rights_request(text,text) to authenticated;


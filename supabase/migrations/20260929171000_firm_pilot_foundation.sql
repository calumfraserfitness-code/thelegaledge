-- Coach-operated firm pilots. No employer login or access to participant records.
create table public.firm_organizations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id),
  name text not null check (length(trim(name)) between 2 and 160),
  contact_name text,
  contact_email text,
  created_at timestamptz not null default now()
);

create table public.firm_pilots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.firm_organizations(id),
  coach_id uuid not null references public.profiles(id),
  name text not null check (length(trim(name)) between 2 and 160),
  start_date date,
  end_date date,
  capacity integer not null default 10 check (capacity between 5 and 100),
  status text not null default 'planning' check (status in ('planning','inviting','active','complete')),
  minimum_report_count integer not null default 5 check (minimum_report_count >= 5),
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  check (minimum_report_count <= capacity)
);

create table public.firm_participants (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.firm_pilots(id),
  client_id uuid not null references public.clients(id),
  status text not null default 'invited' check (status in ('invited','active','withdrawn')),
  joined_at timestamptz not null default now(),
  unique (pilot_id, client_id),
  unique (id, client_id)
);

create table public.firm_consents (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null,
  client_id uuid not null,
  accepted_at timestamptz not null default now(),
  statement_version text not null default 'pilot-aggregate-v1',
  unique (participant_id),
  foreign key (participant_id, client_id) references public.firm_participants(id, client_id)
);

create table public.firm_assessments (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null,
  client_id uuid not null,
  phase text not null check (phase in ('baseline','midpoint','endline')),
  energy integer not null check (energy between 1 and 10),
  sleep integer not null check (sleep between 1 and 10),
  stress integer not null check (stress between 1 and 10),
  workload integer not null check (workload between 1 and 10),
  consistency integer not null check (consistency between 1 and 10),
  submitted_at timestamptz not null default now(),
  unique (participant_id, phase),
  foreign key (participant_id, client_id) references public.firm_participants(id, client_id)
);

create index firm_org_coach_idx on public.firm_organizations(coach_id);
create index firm_pilot_org_idx on public.firm_pilots(organization_id);
create index firm_pilot_coach_idx on public.firm_pilots(coach_id);
create index firm_participant_client_idx on public.firm_participants(client_id);
create index firm_participant_pilot_idx on public.firm_participants(pilot_id);
create index firm_assessment_phase_idx on public.firm_assessments(phase);

alter table public.firm_organizations enable row level security;
alter table public.firm_pilots enable row level security;
alter table public.firm_participants enable row level security;
alter table public.firm_consents enable row level security;
alter table public.firm_assessments enable row level security;

revoke all on public.firm_organizations, public.firm_pilots, public.firm_participants,
  public.firm_consents, public.firm_assessments from public, anon;
grant select, insert, update on public.firm_organizations, public.firm_pilots,
  public.firm_participants to authenticated;
grant select, insert on public.firm_consents, public.firm_assessments to authenticated;

-- A narrow membership lookup avoids recursive policies across pilots and rosters.
create function private.is_pilot_participant(target_pilot_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.firm_participants m join public.clients c on c.id = m.client_id
    where m.pilot_id = target_pilot_id and c.profile_id = (select auth.uid())
  )
$$;
revoke all on function private.is_pilot_participant(uuid) from public, anon;
grant execute on function private.is_pilot_participant(uuid) to authenticated;

create policy firm_org_coach on public.firm_organizations for all to authenticated
  using ((select private.is_coach()) and coach_id = (select auth.uid()))
  with check ((select private.is_coach()) and coach_id = (select auth.uid()));

create policy firm_org_participant_read on public.firm_organizations for select to authenticated
  using (exists (
    select 1 from public.firm_pilots p
    where p.organization_id = id and (select private.is_pilot_participant(p.id))
  ));

create policy firm_pilot_coach on public.firm_pilots for all to authenticated
  using ((select private.is_coach()) and coach_id = (select auth.uid()))
  with check ((select private.is_coach()) and coach_id = (select auth.uid()) and exists (
    select 1 from public.firm_organizations o where o.id = organization_id and o.coach_id = (select auth.uid())
  ));

create policy firm_pilot_participant_read on public.firm_pilots for select to authenticated
  using ((select private.is_pilot_participant(id)));

create policy firm_participant_read on public.firm_participants for select to authenticated
  using (exists (
    select 1 from public.firm_pilots p where p.id = pilot_id and p.coach_id = (select auth.uid())
  ) or exists (
    select 1 from public.clients c where c.id = client_id and c.profile_id = (select auth.uid())
  ));

create policy firm_participant_coach_insert on public.firm_participants for insert to authenticated
  with check ((select private.is_coach()) and exists (
    select 1 from public.firm_pilots p join public.clients c on c.coach_id = p.coach_id
    where p.id = pilot_id and c.id = client_id and p.coach_id = (select auth.uid())
  ));

create policy firm_participant_coach_update on public.firm_participants for update to authenticated
  using ((select private.is_coach()) and exists (
    select 1 from public.firm_pilots p where p.id = pilot_id and p.coach_id = (select auth.uid())
  ))
  with check ((select private.is_coach()) and exists (
    select 1 from public.firm_pilots p join public.clients c on c.coach_id = p.coach_id
    where p.id = pilot_id and c.id = client_id and p.coach_id = (select auth.uid())
  ));

create policy firm_consent_read on public.firm_consents for select to authenticated
  using (exists (
    select 1 from public.firm_participants m join public.firm_pilots p on p.id = m.pilot_id
    join public.clients c on c.id = m.client_id
    where m.id = participant_id and (p.coach_id = (select auth.uid()) or c.profile_id = (select auth.uid()))
  ));

create policy firm_consent_client_insert on public.firm_consents for insert to authenticated
  with check (exists (
    select 1 from public.firm_participants m join public.clients c on c.id = m.client_id
    where m.id = firm_consents.participant_id and m.client_id = firm_consents.client_id and m.status <> 'withdrawn'
      and c.profile_id = (select auth.uid())
  ));

create policy firm_assessment_read on public.firm_assessments for select to authenticated
  using (exists (
    select 1 from public.firm_participants m join public.firm_pilots p on p.id = m.pilot_id
    join public.clients c on c.id = m.client_id
    where m.id = participant_id and (p.coach_id = (select auth.uid()) or c.profile_id = (select auth.uid()))
  ));

create policy firm_assessment_client_insert on public.firm_assessments for insert to authenticated
  with check (exists (
    select 1 from public.firm_participants m join public.clients c on c.id = m.client_id
    join public.firm_consents consent on consent.participant_id = m.id
    where m.id = firm_assessments.participant_id and m.client_id = firm_assessments.client_id and m.status <> 'withdrawn'
      and c.profile_id = (select auth.uid())
  ));

-- This is the only sponsor-report data path. It returns no rows for small cohorts.
create function public.firm_pilot_summary(target_pilot_id uuid)
returns table (phase text, respondents bigint, energy numeric, sleep numeric,
  stress numeric, workload numeric, consistency numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.firm_pilots p where p.id = target_pilot_id
      and p.coach_id = (select auth.uid()) and (select private.is_coach())
  ) then
    raise exception 'Not authorized for this pilot' using errcode = '42501';
  end if;
  return query
    select a.phase, count(*)::bigint,
      round(avg(a.energy), 1), round(avg(a.sleep), 1), round(avg(a.stress), 1),
      round(avg(a.workload), 1), round(avg(a.consistency), 1)
    from public.firm_assessments a
    join public.firm_participants m on m.id = a.participant_id
    join public.firm_consents consent on consent.participant_id = m.id
    join public.firm_pilots p on p.id = m.pilot_id
    where p.id = target_pilot_id and m.status <> 'withdrawn'
    group by a.phase, p.minimum_report_count
    having count(*) >= greatest(5, p.minimum_report_count);
end;
$$;
revoke all on function public.firm_pilot_summary(uuid) from public, anon;
grant execute on function public.firm_pilot_summary(uuid) to authenticated;

-- Coach-curated resources scoped to one pilot; no sponsor read access.
create table public.firm_resources (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.firm_pilots(id),
  title text not null check (length(trim(title)) between 3 and 160),
  topic text not null check (length(trim(topic)) between 2 and 80),
  summary text not null check (length(trim(summary)) between 10 and 500),
  body text not null check (length(trim(body)) between 30 and 10000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index firm_resources_pilot_idx on public.firm_resources(pilot_id, published, created_at desc);
alter table public.firm_resources enable row level security;
revoke all on public.firm_resources from public, anon;
grant select, insert, update, delete on public.firm_resources to authenticated;

create policy firm_resources_coach_read on public.firm_resources
for select to authenticated using (exists (
  select 1 from public.firm_pilots p
  where p.id = firm_resources.pilot_id and p.coach_id = (select auth.uid())
));
create policy firm_resources_member_read on public.firm_resources
for select to authenticated using (published and exists (
  select 1 from public.firm_participants m
  join public.clients c on c.id = m.client_id
  where m.pilot_id = firm_resources.pilot_id and m.status <> 'withdrawn'
    and c.profile_id = (select auth.uid())
));
create policy firm_resources_coach_insert on public.firm_resources
for insert to authenticated with check ((select private.is_coach()) and exists (
  select 1 from public.firm_pilots p
  where p.id = firm_resources.pilot_id and p.coach_id = (select auth.uid())
));
create policy firm_resources_coach_update on public.firm_resources
for update to authenticated
using ((select private.is_coach()) and exists (
  select 1 from public.firm_pilots p
  where p.id = firm_resources.pilot_id and p.coach_id = (select auth.uid())
))
with check ((select private.is_coach()) and exists (
  select 1 from public.firm_pilots p
  where p.id = firm_resources.pilot_id and p.coach_id = (select auth.uid())
));
create policy firm_resources_coach_delete on public.firm_resources
for delete to authenticated using ((select private.is_coach()) and exists (
  select 1 from public.firm_pilots p
  where p.id = firm_resources.pilot_id and p.coach_id = (select auth.uid())
));

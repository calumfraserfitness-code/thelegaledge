-- Acknowledgement only; never replaces agreement or health consent.
create table public.client_welcome_receipts (
 client_id uuid primary key references public.clients(id) on delete cascade,
 seen_at timestamptz not null default now()
);
alter table public.client_welcome_receipts enable row level security;
revoke all on public.client_welcome_receipts from anon;
grant select,insert on public.client_welcome_receipts to authenticated;
create policy welcome_read on public.client_welcome_receipts for select to authenticated
 using(exists(select 1 from public.clients c where c.id=client_id and (c.profile_id=(select auth.uid()) or c.coach_id=(select auth.uid()))));
create policy welcome_insert on public.client_welcome_receipts for insert to authenticated
 with check(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())));
-- The same published library remains available after either onboarding route.
drop policy start_resource_read on public.coaching_start_resources;
create policy start_resource_read on public.coaching_start_resources for select to authenticated
 using(coach_id=(select auth.uid()) or (published and exists(select 1 from public.clients c where c.coach_id=coaching_start_resources.coach_id and c.profile_id=(select auth.uid()) and (c.onboarding_status='complete' or exists(select 1 from public.onboarding_journeys j where j.client_id=c.id and j.stage in ('review','ready'))))));

-- Applied through Supabase migration legacy_transition_coach_snapshots.
create table public.legacy_transition_snapshots (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id),
 coach_id uuid not null references public.profiles(id),
 source_client_id text not null,
 source_url text not null,
 section text not null,
 payload jsonb not null,
 captured_at timestamptz not null default now(),
 unique(client_id,section,captured_at)
);
alter table public.legacy_transition_snapshots enable row level security;
revoke all on public.legacy_transition_snapshots from anon,authenticated;
grant select on public.legacy_transition_snapshots to authenticated;
create policy assigned_coach_read on public.legacy_transition_snapshots for select to authenticated using (
 coach_id=(select auth.uid())
 and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()))
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='coach')
);
create index legacy_transition_client_capture on public.legacy_transition_snapshots(client_id,captured_at desc);

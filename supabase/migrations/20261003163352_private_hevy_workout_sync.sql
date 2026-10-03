create table public.hevy_connections (
 client_id uuid primary key references public.clients(id) on delete cascade,
 key_ciphertext text, key_iv text,
 status text not null check(status in ('connected','disconnected','needs_reconnect')),
 last_synced_at timestamptz, updated_at timestamptz not null default now(),
 check((key_ciphertext is null)=(key_iv is null))
);
alter table public.hevy_connections enable row level security;
revoke all on public.hevy_connections from public,anon,authenticated;
grant select(client_id,status,last_synced_at,updated_at) on public.hevy_connections to authenticated;
grant all on public.hevy_connections to service_role;
create policy own_hevy_status on public.hevy_connections for select to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())));
create table public.hevy_workouts(
 client_id uuid not null references public.clients(id) on delete cascade,
 hevy_id text not null check(length(hevy_id) between 1 and 100),
 title text not null, start_time timestamptz not null, end_time timestamptz,
 source_updated_at timestamptz, exercises jsonb not null check(jsonb_typeof(exercises)='array'),
 synced_at timestamptz not null default now(),
 primary key(client_id,hevy_id)
);
alter table public.hevy_workouts enable row level security;
revoke all on public.hevy_workouts from public,anon,authenticated;
grant select on public.hevy_workouts to authenticated;
grant all on public.hevy_workouts to service_role;
create policy private_hevy_workouts on public.hevy_workouts for select to authenticated using(exists(select 1 from public.clients c where c.id=client_id and (c.profile_id=(select auth.uid()) or c.coach_id=(select auth.uid()))));
create index hevy_workouts_client_date on public.hevy_workouts(client_id,start_time desc);

alter table public.client_health_connections drop constraint if exists client_health_connections_provider_check;
alter table public.client_health_connections add constraint client_health_connections_provider_check
  check (provider in ('apple_health','google_health','health_connect','fitbit'));

alter table public.client_health_daily drop constraint if exists client_health_daily_source_check;
alter table public.client_health_daily add constraint client_health_daily_source_check
  check (source in ('apple_health','google_health','health_connect','fitbit','manual'));

alter table public.client_health_workouts drop constraint if exists client_health_workouts_source_check;
alter table public.client_health_workouts add constraint client_health_workouts_source_check
  check (source in ('apple_health','google_health','health_connect','fitbit'));

create table if not exists public.client_health_imports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  provider text not null check (provider in ('apple_health','google_health','health_connect','fitbit')),
  file_name text,
  imported_rows integer not null default 0 check (imported_rows >= 0),
  date_from date,
  date_to date,
  status text not null default 'completed' check (status in ('completed','partial','failed')),
  error_message text,
  imported_at timestamptz not null default now()
);

alter table public.client_health_imports enable row level security;
drop policy if exists health_imports_access on public.client_health_imports;
create policy health_imports_access on public.client_health_imports for all to authenticated
  using ((select private.can_access_client(client_id)))
  with check ((select private.can_access_client(client_id)));

create index if not exists client_health_imports_client_date_idx
  on public.client_health_imports(client_id, imported_at desc);

grant select, insert, update, delete on public.client_health_imports to authenticated;

create table if not exists public.client_health_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  provider text not null check (provider in ('apple_health','google_health','health_connect')),
  status text not null default 'disconnected' check (status in ('connected','disconnected','error','revoked')),
  provider_user_id text,
  scopes text[] not null default '{}',
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, provider)
);

create table if not exists public.client_health_daily (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null,
  steps integer check (steps is null or steps >= 0),
  sleep_minutes integer check (sleep_minutes is null or sleep_minutes >= 0),
  weight_kg numeric check (weight_kg is null or weight_kg > 0),
  resting_heart_rate numeric check (resting_heart_rate is null or resting_heart_rate > 0),
  active_calories numeric check (active_calories is null or active_calories >= 0),
  distance_km numeric check (distance_km is null or distance_km >= 0),
  hrv_ms numeric check (hrv_ms is null or hrv_ms >= 0),
  source text not null check (source in ('apple_health','google_health','health_connect','manual')),
  source_priority smallint not null default 100,
  provider_record_id text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, date, source)
);

create table if not exists public.client_health_workouts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  provider_workout_id text not null,
  activity_type text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes numeric check (duration_minutes is null or duration_minutes >= 0),
  distance_km numeric check (distance_km is null or distance_km >= 0),
  calories numeric check (calories is null or calories >= 0),
  source text not null check (source in ('apple_health','google_health','health_connect')),
  raw_metadata jsonb not null default '{}',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(client_id, source, provider_workout_id)
);

alter table public.client_health_connections enable row level security;
alter table public.client_health_daily enable row level security;
alter table public.client_health_workouts enable row level security;

create policy health_connections_access on public.client_health_connections for all to authenticated
  using ((select private.can_access_client(client_id)))
  with check ((select private.can_access_client(client_id)));
create policy health_daily_access on public.client_health_daily for all to authenticated
  using ((select private.can_access_client(client_id)))
  with check ((select private.can_access_client(client_id)));
create policy health_workouts_access on public.client_health_workouts for all to authenticated
  using ((select private.can_access_client(client_id)))
  with check ((select private.can_access_client(client_id)));

create index if not exists client_health_daily_client_date_idx on public.client_health_daily(client_id, date desc);
create index if not exists client_health_workouts_client_started_idx on public.client_health_workouts(client_id, started_at desc);

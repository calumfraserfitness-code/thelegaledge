create table if not exists private.health_oauth_states (
  state uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'fitbit'),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

create table if not exists private.health_provider_tokens (
  client_id uuid not null references public.clients(id) on delete cascade,
  provider text not null check (provider = 'fitbit'),
  provider_user_id text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (client_id, provider)
);

revoke all on private.health_oauth_states from public, anon, authenticated;
revoke all on private.health_provider_tokens from public, anon, authenticated;

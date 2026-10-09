-- Additive logs and favourites; no existing meals, plans or history are rewritten.
create table public.client_food_entries (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id) on delete cascade,
 entry_date date not null,
 slot_key text not null check (length(slot_key) between 1 and 200),
 meal_snapshot jsonb not null check (jsonb_typeof(meal_snapshot)='object' and meal_snapshot ? 'name' and jsonb_typeof(meal_snapshot->'name')='string' and length(meal_snapshot->>'name') between 1 and 200),
 servings numeric not null default 1 check (servings>0 and servings<=20),
 eaten boolean not null default false,
 created_at timestamptz not null default now(),
 unique(client_id,entry_date,slot_key)
);
create table public.client_recipe_favourites (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id) on delete cascade,
 recipe_key text not null check(length(recipe_key) between 1 and 200),
 meal_snapshot jsonb not null check (jsonb_typeof(meal_snapshot)='object' and meal_snapshot ? 'name' and jsonb_typeof(meal_snapshot->'name')='string' and length(meal_snapshot->>'name') between 1 and 200),
 created_at timestamptz not null default now(),
 unique(client_id,recipe_key)
);
alter table public.client_food_entries enable row level security;
alter table public.client_recipe_favourites enable row level security;
revoke all on public.client_food_entries,public.client_recipe_favourites from anon;
grant select,insert,update,delete on public.client_food_entries,public.client_recipe_favourites to authenticated;
create policy food_owner_access on public.client_food_entries for all to authenticated
 using(private.can_access_client(client_id)) with check(private.can_access_client(client_id));
create policy favourite_owner_access on public.client_recipe_favourites for all to authenticated
 using(private.can_access_client(client_id)) with check(private.can_access_client(client_id));
-- Stored snapshots keep previous food logs stable when recipes are later edited.
-- Employers have no policy: only the linked client and their assigned coach qualify.
notify pgrst,'reload schema';

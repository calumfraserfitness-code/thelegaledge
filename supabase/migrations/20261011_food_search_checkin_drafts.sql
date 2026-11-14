create table if not exists public.client_checkin_drafts (
 client_id uuid not null references public.clients(id) on delete cascade,
 period_start date not null, answers jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 primary key(client_id,period_start),
 check (jsonb_typeof(answers)='object' and octet_length(answers::text)<30000)
);
alter table public.client_checkin_drafts enable row level security;
create policy draft_owner on public.client_checkin_drafts for all to authenticated
 using (exists(select 1 from public.clients c where c.id=client_id and c.profile_id=auth.uid()))
 with check (exists(select 1 from public.clients c where c.id=client_id and c.profile_id=auth.uid()));
grant select,insert,update,delete on public.client_checkin_drafts to authenticated;
create table if not exists public.food_source_cache (
 cache_key text primary key, result jsonb not null, expires_at timestamptz not null
);
alter table public.food_source_cache enable row level security;
revoke all on public.food_source_cache from anon,authenticated;
create table if not exists public.food_search_rate (
 profile_id uuid primary key references auth.users(id) on delete cascade,
 requested_at timestamptz not null default now()
);
alter table public.food_search_rate enable row level security;
revoke all on public.food_search_rate from anon,authenticated;
create or replace function public.claim_food_search(p_profile uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare claimed uuid;
begin
 insert into public.food_search_rate(profile_id,requested_at) values(p_profile,now())
 on conflict(profile_id) do update set requested_at=excluded.requested_at
 where public.food_search_rate.requested_at < now()-interval '10 seconds'
 returning profile_id into claimed;
 return claimed is not null;
end $$;
revoke all on function public.claim_food_search(uuid) from public,anon,authenticated;
grant execute on function public.claim_food_search(uuid) to service_role;

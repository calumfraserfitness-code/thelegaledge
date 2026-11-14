create table public.client_food_feedback (
 client_id uuid not null references public.clients(id) on delete cascade,
 meal_name text not null check(length(meal_name) between 1 and 200),
 verdict text not null check(verdict in ('prefer','avoid')),
 updated_at timestamptz not null default now(),primary key(client_id,meal_name)
);
alter table public.client_food_feedback enable row level security;
create policy feedback_owner on public.client_food_feedback for all to authenticated
 using (exists(select 1 from public.clients c where c.id=client_id and c.profile_id=auth.uid()))
 with check (exists(select 1 from public.clients c where c.id=client_id and c.profile_id=auth.uid()));
grant select,insert,update,delete on public.client_food_feedback to authenticated;

create table public.firm_programme_briefs (
  pilot_id uuid primary key references public.firm_pilots(id),
  objective text not null check (length(btrim(objective)) between 10 and 2000),
  success_criteria text not null check (length(btrim(success_criteria)) between 10 and 3000),
  constraints text not null default '' check (length(constraints) <= 3000),
  review_date date,
  recommendation text not null default 'pending' check (recommendation in ('pending','continue','adjust','pause')),
  next_action text not null default '' check (length(next_action) <= 3000),
  updated_at timestamptz not null default now()
);
alter table public.firm_programme_briefs enable row level security;
revoke all on public.firm_programme_briefs from public, anon, authenticated;
grant select, insert, update on public.firm_programme_briefs to authenticated;
create policy assigned_coach_brief on public.firm_programme_briefs
for all to authenticated
using ((select private.is_coach()) and exists (
 select 1 from public.firm_pilots p where p.id = pilot_id and p.coach_id = (select auth.uid())
))
with check ((select private.is_coach()) and exists (
 select 1 from public.firm_pilots p where p.id = pilot_id and p.coach_id = (select auth.uid())
));

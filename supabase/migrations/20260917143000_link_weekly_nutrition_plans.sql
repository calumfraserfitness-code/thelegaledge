alter table public.nutrition_days
  add column if not exists nutrition_plan_id uuid references public.nutrition_plans(id) on delete set null;

create index if not exists nutrition_days_plan_idx
  on public.nutrition_days(nutrition_plan_id);

drop index if exists public.onboarding_responses_client_version_uidx;

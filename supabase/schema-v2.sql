-- Legal Edge Client App only (project baxvhilvrhshlfizakak).
-- Expanded coaching schema. Every public table is protected by RLS.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.clients
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists timezone text default 'Europe/Dublin',
  add column if not exists weight_unit text default 'kg' check (weight_unit in ('kg','lbs')),
  add column if not exists start_weight_kg numeric,
  add column if not exists goal_summary text,
  add column if not exists checkin_day smallint check (checkin_day between 0 and 6),
  add column if not exists track_weight boolean not null default true,
  add column if not exists weekly_checkin_enabled boolean not null default true,
  add column if not exists midweek_checkin_enabled boolean not null default false,
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists source_system text,
  add column if not exists source_id text unique,
  add column if not exists archived_at timestamptz;

alter table public.program_weeks
  add column if not exists week_number integer,
  add column if not exists goal_weight_kg numeric,
  add column if not exists adherence_percent integer check (adherence_percent between 0 and 100),
  add column if not exists published_at timestamptz,
  add column if not exists copied_from_week_id uuid references public.program_weeks(id) on delete set null;

alter table public.training_sessions
  add column if not exists programme_day_id uuid,
  add column if not exists moved_from_date date,
  add column if not exists duration_minutes integer,
  add column if not exists distance_km numeric,
  add column if not exists pace text,
  add column if not exists heart_rate_target text,
  add column if not exists zone text,
  add column if not exists actual_value numeric,
  add column if not exists actual_unit text,
  add column if not exists client_notes text;

alter table public.exercises
  add column if not exists video_url text,
  add column if not exists coach_instructions text,
  add column if not exists previous_performance text,
  add column if not exists actual_sets integer,
  add column if not exists actual_reps text,
  add column if not exists actual_load text,
  add column if not exists completed_at timestamptz;

alter table public.checkins
  add column if not exists week_number integer,
  add column if not exists week_score integer check (week_score between 1 and 10),
  add column if not exists hunger integer check (hunger between 1 and 10),
  add column if not exists cravings integer check (cravings between 1 and 10),
  add column if not exists average_steps integer,
  add column if not exists steps_adherence integer check (steps_adherence between 0 and 100),
  add column if not exists food_summary text,
  add column if not exists training_summary text,
  add column if not exists focus_next_week text,
  add column if not exists make_next_week_better text,
  add column if not exists support_needed text,
  add column if not exists voice_note_url text,
  add column if not exists reviewed_at timestamptz;

alter table public.progress_entries
  add column if not exists chest_cm numeric,
  add column if not exists hips_cm numeric,
  add column if not exists thigh_cm numeric,
  add column if not exists arm_cm numeric,
  add column if not exists body_fat_percent numeric,
  add column if not exists training_adherence integer check (training_adherence between 0 and 100),
  add column if not exists nutrition_adherence integer check (nutrition_adherence between 0 and 100);

create table if not exists public.onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  version integer not null default 1,
  submitted_at timestamptz,
  completed_at timestamptz,
  responses jsonb not null default '{}'::jsonb,
  source_system text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, version)
);

create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  signed_at timestamptz,
  signature_name text,
  signature_date date,
  country text,
  date_of_birth date,
  professional_role text,
  firm text,
  bloodwork_consent boolean,
  genetics_consent boolean,
  photo_storage_consent boolean,
  photo_marketing_consent boolean,
  parq_details text,
  medications text,
  source_system text,
  source_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('draft','active','archived')),
  is_template boolean not null default false,
  started_at date,
  ended_at date,
  source_system text,
  source_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs(id) on delete cascade,
  title text not null,
  training_type public.training_type not null default 'weights',
  day_index integer not null default 0,
  coach_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.training_program_days(id) on delete cascade,
  name text not null,
  sets integer,
  reps text,
  load text,
  rest_seconds integer,
  tempo text,
  notes text,
  coach_instructions text,
  video_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.training_sessions drop constraint if exists training_sessions_programme_day_id_fkey;
alter table public.training_sessions add constraint training_sessions_programme_day_id_fkey foreign key (programme_day_id) references public.training_program_days(id) on delete set null;

create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.program_weeks(id) on delete cascade,
  plan_date date not null,
  coach_note text,
  published boolean not null default false,
  completed boolean not null default false,
  completed_items integer not null default 0,
  total_items integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(week_id, plan_date)
);

create table if not exists public.step_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  entry_date date not null,
  target_steps integer,
  actual_steps integer,
  completed boolean generated always as (actual_steps is not null and target_steps is not null and actual_steps >= target_steps) stored,
  source text default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, entry_date)
);

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  day_type text not null default 'Training Day',
  days_per_week integer not null default 1 check (days_per_week between 0 and 7),
  calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  coach_notes text,
  is_active boolean not null default true,
  source_system text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_plan_meals (
  id uuid primary key default gen_random_uuid(),
  nutrition_plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  name text not null,
  timing text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meal_plan_meals(id) on delete cascade,
  name text not null,
  description text,
  quantity numeric,
  unit text,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  is_busy_day_alternative boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  dosage text,
  timing text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  target text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null,
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique(habit_id, log_date)
);

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid references public.profiles(id) on delete set null,
  note text not null,
  category text default 'general',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  meeting_url text,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  created_at timestamptz not null default now()
);

create table if not exists public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_type text not null,
  storage_path text not null,
  original_name text,
  mime_type text,
  week_number integer,
  photo_view text check (photo_view in ('front','side','back') or photo_view is null),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text,
  attachment_path text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (coalesce(length(body),0) > 0 or attachment_path is not null)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  assessment_type text not null,
  assessed_at timestamptz not null default now(),
  responses jsonb not null default '{}'::jsonb,
  coach_summary text,
  source_system text,
  source_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.diagnostic_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  report_type text not null,
  report_date date,
  title text not null,
  summary text,
  data jsonb not null default '{}'::jsonb,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  client_id uuid references public.clients(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clients_coach_id_idx on public.clients(coach_id);
create index if not exists program_weeks_client_id_idx on public.program_weeks(client_id, week_start desc);
create index if not exists training_sessions_week_id_idx on public.training_sessions(week_id, session_date);
create index if not exists exercises_session_id_idx on public.exercises(session_id, sort_order);
create index if not exists nutrition_days_week_id_idx on public.nutrition_days(week_id, nutrition_date);
create index if not exists meals_nutrition_day_id_idx on public.meals(nutrition_day_id, sort_order);
create index if not exists checkins_client_id_idx on public.checkins(client_id, submitted_at desc);
create index if not exists progress_entries_client_id_idx on public.progress_entries(client_id, entry_date desc);
create index if not exists onboarding_client_id_idx on public.onboarding_responses(client_id);
create index if not exists legal_consents_client_id_idx on public.legal_consents(client_id);
create index if not exists training_programs_client_id_idx on public.training_programs(client_id);
create index if not exists training_program_days_program_id_idx on public.training_program_days(program_id, day_index);
create index if not exists program_exercises_day_id_idx on public.program_exercises(program_day_id, sort_order);
create index if not exists step_entries_client_date_idx on public.step_entries(client_id, entry_date desc);
create index if not exists nutrition_plans_client_id_idx on public.nutrition_plans(client_id);
create index if not exists habits_client_id_idx on public.habits(client_id);
create index if not exists coach_notes_client_id_idx on public.coach_notes(client_id, occurred_at desc);
create index if not exists appointments_client_id_idx on public.appointments(client_id, starts_at desc);
create index if not exists files_client_id_idx on public.client_files(client_id, created_at desc);
create index if not exists messages_client_id_idx on public.messages(client_id, created_at);
create index if not exists assessments_client_id_idx on public.assessments(client_id, assessed_at desc);
create index if not exists diagnostic_reports_client_id_idx on public.diagnostic_reports(client_id, report_date desc);

create or replace function private.is_coach()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='coach') $$;

create or replace function private.can_access_client(target_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.clients c
    where c.id=target_client_id
      and (c.profile_id=(select auth.uid()) or c.coach_id=(select auth.uid()))
  )
$$;

revoke all on function private.is_coach() from public, anon;
revoke all on function private.can_access_client(uuid) from public, anon;
grant execute on function private.is_coach() to authenticated;
grant execute on function private.can_access_client(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'onboarding_responses','legal_consents','training_programs','training_program_days',
    'program_exercises','daily_plans','step_entries','nutrition_plans','meal_plan_meals',
    'meal_plan_items','supplements','habits','habit_logs','coach_notes','appointments',
    'client_files','messages','assessments','diagnostic_reports','audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

-- Direct client-owned tables.
create policy onboarding_access on public.onboarding_responses for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.can_access_client(client_id)));
create policy legal_access on public.legal_consents for select to authenticated
  using ((select private.can_access_client(client_id)));
create policy programs_access on public.training_programs for all to authenticated
  using ((select private.can_access_client(client_id)) or ((select private.is_coach()) and is_template))
  with check ((select private.can_access_client(client_id)) or ((select private.is_coach()) and is_template));
create policy steps_access on public.step_entries for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.can_access_client(client_id)));
create policy nutrition_plans_access on public.nutrition_plans for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.can_access_client(client_id)));
create policy supplements_access on public.supplements for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.can_access_client(client_id)));
create policy habits_access on public.habits for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.can_access_client(client_id)));
create policy coach_notes_access on public.coach_notes for all to authenticated
  using ((select private.is_coach()) and (select private.can_access_client(client_id)))
  with check ((select private.is_coach()) and (select private.can_access_client(client_id)));
create policy appointments_access on public.appointments for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.can_access_client(client_id)));
create policy files_access on public.client_files for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.can_access_client(client_id)));
create policy messages_access on public.messages for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.can_access_client(client_id)));
create policy assessments_access on public.assessments for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.can_access_client(client_id)));
create policy diagnostics_access on public.diagnostic_reports for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.is_coach()) and (select private.can_access_client(client_id)));
create policy audit_coach_select on public.audit_events for select to authenticated
  using ((select private.is_coach()) and (client_id is null or (select private.can_access_client(client_id))));

-- Descendant tables inherit access through their parent client.
create policy program_days_access on public.training_program_days for all to authenticated
  using (exists(select 1 from public.training_programs p where p.id=program_id and ((p.client_id is not null and (select private.can_access_client(p.client_id))) or (p.is_template and (select private.is_coach())))))
  with check (exists(select 1 from public.training_programs p where p.id=program_id and ((p.client_id is not null and (select private.can_access_client(p.client_id))) or (p.is_template and (select private.is_coach())))));
create policy program_exercises_access on public.program_exercises for all to authenticated
  using (exists(select 1 from public.training_program_days d join public.training_programs p on p.id=d.program_id where d.id=program_day_id and ((p.client_id is not null and (select private.can_access_client(p.client_id))) or (p.is_template and (select private.is_coach())))))
  with check (exists(select 1 from public.training_program_days d join public.training_programs p on p.id=d.program_id where d.id=program_day_id and ((p.client_id is not null and (select private.can_access_client(p.client_id))) or (p.is_template and (select private.is_coach())))));
create policy daily_plans_access on public.daily_plans for all to authenticated
  using (exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id))))
  with check (exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id))));
create policy meal_plan_meals_access on public.meal_plan_meals for all to authenticated
  using (exists(select 1 from public.nutrition_plans p where p.id=nutrition_plan_id and (select private.can_access_client(p.client_id))))
  with check (exists(select 1 from public.nutrition_plans p where p.id=nutrition_plan_id and (select private.can_access_client(p.client_id))));
create policy meal_plan_items_access on public.meal_plan_items for all to authenticated
  using (exists(select 1 from public.meal_plan_meals m join public.nutrition_plans p on p.id=m.nutrition_plan_id where m.id=meal_id and (select private.can_access_client(p.client_id))))
  with check (exists(select 1 from public.meal_plan_meals m join public.nutrition_plans p on p.id=m.nutrition_plan_id where m.id=meal_id and (select private.can_access_client(p.client_id))));
create policy habit_logs_access on public.habit_logs for all to authenticated
  using (exists(select 1 from public.habits h where h.id=habit_id and (select private.can_access_client(h.client_id))))
  with check (exists(select 1 from public.habits h where h.id=habit_id and (select private.can_access_client(h.client_id))));

-- Make the profile/client root policies assignment-aware and remove duplicated permissive policies.
drop policy if exists profiles_self_or_coach_select on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id=(select auth.uid()) or exists(select 1 from public.clients c where c.profile_id=profiles.id and c.coach_id=(select auth.uid()))
);
create policy profiles_self_update on public.profiles for update to authenticated
  using (id=(select auth.uid())) with check (id=(select auth.uid()));

drop policy if exists clients_select on public.clients;
drop policy if exists clients_coach_manage on public.clients;
create policy clients_access on public.clients for select to authenticated
  using (profile_id=(select auth.uid()) or coach_id=(select auth.uid()));
create policy clients_coach_insert on public.clients for insert to authenticated
  with check ((select private.is_coach()) and coach_id=(select auth.uid()));
create policy clients_coach_update on public.clients for update to authenticated
  using (coach_id=(select auth.uid())) with check (coach_id=(select auth.uid()));

-- Existing child tables: consolidate read access and keep writes assignment-aware.
drop policy if exists weeks_select on public.program_weeks;
drop policy if exists weeks_coach_manage on public.program_weeks;
create policy weeks_access on public.program_weeks for select to authenticated using ((select private.can_access_client(client_id)));
create policy weeks_coach_manage on public.program_weeks for all to authenticated
  using ((select private.is_coach()) and (select private.can_access_client(client_id)))
  with check ((select private.is_coach()) and (select private.can_access_client(client_id)));

-- Follow-up consolidation for the original V1 policies and all foreign-key indexes.
drop policy if exists weeks_coach_manage on public.program_weeks;
create policy weeks_coach_insert on public.program_weeks for insert to authenticated with check ((select private.is_coach()) and (select private.can_access_client(client_id)));
create policy weeks_coach_update on public.program_weeks for update to authenticated using ((select private.is_coach()) and (select private.can_access_client(client_id))) with check ((select private.is_coach()) and (select private.can_access_client(client_id)));
create policy weeks_coach_delete on public.program_weeks for delete to authenticated using ((select private.is_coach()) and (select private.can_access_client(client_id)));

drop policy if exists sessions_select on public.training_sessions;
drop policy if exists sessions_client_update on public.training_sessions;
drop policy if exists sessions_coach_manage on public.training_sessions;
create policy sessions_access on public.training_sessions for select to authenticated using (exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id))));
create policy sessions_insert on public.training_sessions for insert to authenticated with check ((select private.is_coach()) and exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id))));
create policy sessions_update on public.training_sessions for update to authenticated using (exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id)))) with check (exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id))));
create policy sessions_delete on public.training_sessions for delete to authenticated using ((select private.is_coach()) and exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id))));

drop policy if exists exercises_select on public.exercises;
drop policy if exists exercises_client_update on public.exercises;
drop policy if exists exercises_coach_manage on public.exercises;
create policy exercises_access on public.exercises for select to authenticated using (exists(select 1 from public.training_sessions s join public.program_weeks w on w.id=s.week_id where s.id=session_id and (select private.can_access_client(w.client_id))));
create policy exercises_insert on public.exercises for insert to authenticated with check ((select private.is_coach()) and exists(select 1 from public.training_sessions s join public.program_weeks w on w.id=s.week_id where s.id=session_id and (select private.can_access_client(w.client_id))));
create policy exercises_update on public.exercises for update to authenticated using (exists(select 1 from public.training_sessions s join public.program_weeks w on w.id=s.week_id where s.id=session_id and (select private.can_access_client(w.client_id)))) with check (exists(select 1 from public.training_sessions s join public.program_weeks w on w.id=s.week_id where s.id=session_id and (select private.can_access_client(w.client_id))));
create policy exercises_delete on public.exercises for delete to authenticated using ((select private.is_coach()) and exists(select 1 from public.training_sessions s join public.program_weeks w on w.id=s.week_id where s.id=session_id and (select private.can_access_client(w.client_id))));

drop policy if exists nutrition_select on public.nutrition_days;
drop policy if exists nutrition_client_update on public.nutrition_days;
drop policy if exists nutrition_coach_manage on public.nutrition_days;
create policy nutrition_days_access on public.nutrition_days for select to authenticated using (exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id))));
create policy nutrition_days_insert on public.nutrition_days for insert to authenticated with check ((select private.is_coach()) and exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id))));
create policy nutrition_days_update on public.nutrition_days for update to authenticated using (exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id)))) with check (exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id))));
create policy nutrition_days_delete on public.nutrition_days for delete to authenticated using ((select private.is_coach()) and exists(select 1 from public.program_weeks w where w.id=week_id and (select private.can_access_client(w.client_id))));

drop policy if exists meals_select on public.meals;
drop policy if exists meals_client_update on public.meals;
drop policy if exists meals_coach_manage on public.meals;
create policy meals_access on public.meals for select to authenticated using (exists(select 1 from public.nutrition_days n join public.program_weeks w on w.id=n.week_id where n.id=nutrition_day_id and (select private.can_access_client(w.client_id))));
create policy meals_insert on public.meals for insert to authenticated with check ((select private.is_coach()) and exists(select 1 from public.nutrition_days n join public.program_weeks w on w.id=n.week_id where n.id=nutrition_day_id and (select private.can_access_client(w.client_id))));
create policy meals_update on public.meals for update to authenticated using (exists(select 1 from public.nutrition_days n join public.program_weeks w on w.id=n.week_id where n.id=nutrition_day_id and (select private.can_access_client(w.client_id)))) with check (exists(select 1 from public.nutrition_days n join public.program_weeks w on w.id=n.week_id where n.id=nutrition_day_id and (select private.can_access_client(w.client_id))));
create policy meals_delete on public.meals for delete to authenticated using ((select private.is_coach()) and exists(select 1 from public.nutrition_days n join public.program_weeks w on w.id=n.week_id where n.id=nutrition_day_id and (select private.can_access_client(w.client_id))));

create index if not exists audit_events_client_id_idx on public.audit_events(client_id);
create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id);
create index if not exists client_files_uploaded_by_idx on public.client_files(uploaded_by);
create index if not exists coach_notes_coach_id_idx on public.coach_notes(coach_id);
create index if not exists meal_plan_items_meal_id_idx on public.meal_plan_items(meal_id);
create index if not exists meal_plan_meals_plan_id_idx on public.meal_plan_meals(nutrition_plan_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists program_weeks_copied_from_idx on public.program_weeks(copied_from_week_id);
create index if not exists supplements_client_id_idx on public.supplements(client_id);
create unique index if not exists clients_source_unique
  on public.clients(source_system, source_id)
  where source_system is not null and source_id is not null;
create index if not exists training_programs_created_by_idx on public.training_programs(created_by);
create index if not exists training_sessions_programme_day_idx on public.training_sessions(programme_day_id);

drop policy if exists progress_select on public.progress_entries;
drop policy if exists progress_client_manage on public.progress_entries;
drop policy if exists progress_coach_manage on public.progress_entries;
create policy progress_access on public.progress_entries for all to authenticated
  using ((select private.can_access_client(client_id))) with check ((select private.can_access_client(client_id)));

-- Private storage bucket for progress photos, voice notes, diagnostics and client files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('client-files','client-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/mp4','audio/webm'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy client_files_storage_select on storage.objects for select to authenticated using (
  bucket_id='client-files' and (select private.can_access_client(((storage.foldername(name))[1])::uuid))
);
create policy client_files_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='client-files' and (select private.can_access_client(((storage.foldername(name))[1])::uuid))
);
create policy client_files_storage_update on storage.objects for update to authenticated
  using (bucket_id='client-files' and (select private.can_access_client(((storage.foldername(name))[1])::uuid)))
  with check (bucket_id='client-files' and (select private.can_access_client(((storage.foldername(name))[1])::uuid)));

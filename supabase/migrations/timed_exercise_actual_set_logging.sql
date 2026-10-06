alter table public.exercise_set_logs add column if not exists duration_seconds integer check(duration_seconds between 1 and 86400);

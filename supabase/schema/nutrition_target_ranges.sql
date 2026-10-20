-- Only the assigned coach can update clients; client reads retain existing RLS.
alter table public.clients add column if not exists nutrition_target_ranges jsonb
 not null default '[]'::jsonb check(jsonb_typeof(nutrition_target_ranges)='array');

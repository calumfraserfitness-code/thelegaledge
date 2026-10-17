-- Add provenance without changing existing ownership policies or prescribed plans.
alter table public.training_sessions add column if not exists source_system text,
 add column if not exists source_id text, add column if not exists source_metadata jsonb;
alter table public.exercise_set_logs add column if not exists source_system text,
 add column if not exists source_id text, add column if not exists source_metadata jsonb;
create unique index if not exists training_sessions_legacy_source_unique
 on public.training_sessions(source_system,source_id)
 where source_system is not null and source_id is not null;
create unique index if not exists exercise_sets_legacy_source_unique
 on public.exercise_set_logs(source_system,source_id)
 where source_system is not null and source_id is not null;

-- Imported completed history is available even when its old week was a draft.
create policy imported_client_workout_history_read on public.training_sessions
 for select to authenticated using(
 source_system='legacy_client_session_logs' and source_id is not null and exists(
 select 1 from public.clients c
 where c.source_id=training_sessions.source_metadata->>'client_id'
 and c.profile_id=(select auth.uid()) and c.deleted_at is null and c.portal_enabled));
create or replace function public.client_recorded_workouts(p_client uuid)
 returns setof public.training_sessions language sql stable security invoker set search_path=''
 as $function$
 select t.* from public.training_sessions t
 join public.clients c on c.source_id=t.source_metadata->>'client_id'
 where c.id=p_client and c.deleted_at is null
 and t.source_system='legacy_client_session_logs'
 order by t.session_date desc,t.completed_at desc
 $function$;
revoke all on function public.client_recorded_workouts(uuid) from public,anon;
grant execute on function public.client_recorded_workouts(uuid) to authenticated;

-- A Monday draft is created automatically for every active client. Existing
-- weeks are never overwritten; a coach publishes after reviewing the copy.
create or replace function public.prepare_client_week(p_client_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_start date := current_date - (extract(isodow from current_date)::integer - 1);
  v_client public.clients%rowtype;
  v_source public.program_weeks%rowtype;
  v_new public.program_weeks%rowtype;
  v_number integer;
begin
  select * into v_client from public.clients where id = p_client_id and status = 'active';
  if not found then raise exception 'Active client not found'; end if;
  if current_user <> 'postgres' and
     (not private.is_coach() or v_client.coach_id is distinct from auth.uid()) then
    raise exception 'Only the assigned coach can prepare this week' using errcode = '42501';
  end if;

  -- Serialise repeated page loads and the scheduled job for this client.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_id::text || v_start::text, 0));
  select * into v_new from public.program_weeks
    where client_id = p_client_id and week_start = v_start;
  if found then return v_new.id; end if;
  select * into v_source from public.program_weeks
    where client_id = p_client_id and week_start < v_start
    order by week_start desc limit 1;
  v_number := case when v_source.id is null then 1
    else coalesce(v_source.week_number, 0) + ((v_start - v_source.week_start) / 7) end;
  insert into public.program_weeks
    (client_id, week_start, week_number, title, published, copied_from_week_id, goal_weight_kg)
  values (p_client_id, v_start, v_number, 'Week ' || v_number, false,
          v_source.id, v_source.goal_weight_kg)
  returning * into v_new;

  if v_source.id is not null then
    insert into public.training_sessions
      (week_id, session_date, training_type, title, notes, target_value,
       target_unit, sort_order, status, programme_day_id, duration_minutes,
       distance_km, pace, heart_rate_target, zone)
    select v_new.id, v_start + (s.session_date - v_source.week_start),
      s.training_type, s.title, s.notes, s.target_value, s.target_unit,
      s.sort_order, 'planned', s.programme_day_id, s.duration_minutes,
      s.distance_km, s.pace, s.heart_rate_target, s.zone
    from public.training_sessions s where s.week_id = v_source.id;

    insert into public.nutrition_days
      (week_id, nutrition_date, calorie_target, protein_target_g,
       carbs_target_g, fat_target_g, notes, adhered, nutrition_plan_id)
    select v_new.id, v_start + (n.nutrition_date - v_source.week_start),
      n.calorie_target, n.protein_target_g, n.carbs_target_g, n.fat_target_g,
      n.notes, false, n.nutrition_plan_id
    from public.nutrition_days n where n.week_id = v_source.id;
  end if;
  return v_new.id;
end;
$$;
revoke all on function public.prepare_client_week(uuid) from public, anon;
grant execute on function public.prepare_client_week(uuid) to authenticated, postgres;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('legal-edge-weekly-drafts', '5 0 * * 1',
  $job$select public.prepare_client_week(id) from public.clients where status = 'active'$job$);

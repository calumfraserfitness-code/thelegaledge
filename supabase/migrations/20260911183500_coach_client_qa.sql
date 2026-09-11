create or replace view public.client_qa_summary
with (security_invoker = true)
as
select
  c.id as client_id,
  c.display_name,
  c.status,
  c.onboarding_status,
  c.plan_status,
  c.goal_summary is not null as goal_set,
  c.start_weight_kg is not null as start_weight_set,
  count(distinct np.id) filter (where np.is_active is not false) as nutrition_days,
  count(distinct ma.meal_id) as assigned_meals,
  count(distinct ma.meal_id) filter (
    where jsonb_array_length(coalesce(mb.ingredients, '[]'::jsonb)) > 0
      and not exists (
        select 1 from jsonb_array_elements(coalesce(mb.ingredients, '[]'::jsonb)) ingredient
        where nullif(trim(ingredient->>'name'), '') is null
           or nullif(trim(ingredient->>'quantity'), '') is null
           or nullif(trim(ingredient->>'unit'), '') is null
      )
  ) as complete_meals,
  count(distinct tp.id) filter (where tp.status = 'active') as active_programmes,
  count(distinct tpd.id) as programme_days,
  count(distinct pe.id) as prescribed_exercises,
  count(distinct pw.id) filter (where pw.published) as published_weeks,
  count(distinct pr.id) as progress_entries,
  count(distinct hc.id) filter (where hc.status = 'connected') as health_connections
from public.clients c
left join public.nutrition_plans np on np.client_id = c.id
left join public.meal_assignments ma on ma.client_id = c.id and ma.nutrition_plan_id = np.id
left join public.meal_bank mb on mb.id = ma.meal_id
left join public.training_programs tp on tp.client_id = c.id
left join public.training_program_days tpd on tpd.program_id = tp.id
left join public.program_exercises pe on pe.program_day_id = tpd.id
left join public.program_weeks pw on pw.client_id = c.id
left join public.progress_entries pr on pr.client_id = c.id
left join public.client_health_connections hc on hc.client_id = c.id
group by c.id, c.display_name, c.status, c.onboarding_status, c.plan_status, c.goal_summary, c.start_weight_kg;

grant select on public.client_qa_summary to authenticated;

-- Aggregate each independent relation separately; avoid meal x exercise x week x progress fan-out.
create or replace view public.client_qa_summary with (security_invoker=true) as
select c.id as client_id,c.display_name,c.status,c.onboarding_status,c.plan_status,
 c.goal_summary is not null as goal_set,c.start_weight_kg is not null as start_weight_set,
 (select count(*) from public.nutrition_plans np where np.client_id=c.id and np.is_active is not false) as nutrition_days,
 (select count(distinct ma.meal_id) from public.meal_assignments ma join public.nutrition_plans np on np.id=ma.nutrition_plan_id and np.client_id=c.id where ma.client_id=c.id) as assigned_meals,
 (select count(distinct ma.meal_id) from public.meal_assignments ma join public.nutrition_plans np on np.id=ma.nutrition_plan_id and np.client_id=c.id join public.meal_bank mb on mb.id=ma.meal_id where ma.client_id=c.id and jsonb_array_length(coalesce(mb.ingredients,'[]'::jsonb))>0 and not exists (select 1 from jsonb_array_elements(coalesce(mb.ingredients,'[]'::jsonb)) ingredient(value) where nullif(trim(ingredient.value->>'name'),'') is null or nullif(trim(ingredient.value->>'quantity'),'') is null or nullif(trim(ingredient.value->>'unit'),'') is null)) as complete_meals,
 (select count(*) from public.training_programs tp where tp.client_id=c.id and tp.status='active') as active_programmes,
 (select count(*) from public.training_program_days tpd join public.training_programs tp on tp.id=tpd.program_id where tp.client_id=c.id) as programme_days,
 (select count(*) from public.program_exercises pe join public.training_program_days tpd on tpd.id=pe.program_day_id join public.training_programs tp on tp.id=tpd.program_id where tp.client_id=c.id) as prescribed_exercises,
 (select count(*) from public.program_weeks pw where pw.client_id=c.id and pw.published and pw.week_start=current_date-(extract(isodow from current_date)::integer-1)) as published_weeks,
 (select count(*) from public.progress_entries pr where pr.client_id=c.id) as progress_entries,
 (select count(*) from public.client_health_connections hc where hc.client_id=c.id and hc.status='connected') as health_connections
from public.clients c;

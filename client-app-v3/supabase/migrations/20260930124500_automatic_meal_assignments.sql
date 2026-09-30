create or replace function public.assign_client_week_nutrition(p_client_id uuid,p_week_id uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_week public.program_weeks%rowtype; v_date date; v_index integer; v_saved public.nutrition_days%rowtype; v_plan public.nutrition_plans%rowtype; v_count integer:=0; v_training boolean;
begin
select * into v_week from public.program_weeks where id=p_week_id and client_id=p_client_id;
if not found then raise exception 'Client week not found'; end if;
if current_user<>'postgres' and (not private.is_coach() or not exists(select 1 from public.clients where id=p_client_id and coach_id=auth.uid())) then raise exception 'Only the assigned coach can assign meals' using errcode='42501'; end if;
for v_index in 0..6 loop
v_date:=v_week.week_start+v_index;
select * into v_saved from public.nutrition_days where week_id=p_week_id and nutrition_date=v_date;
-- Preserve manually chosen active menus and all completed days.
if v_saved.id is not null and (v_saved.adhered or exists(select 1 from public.nutrition_plans where id=v_saved.nutrition_plan_id and is_active)) then continue; end if;
if v_saved.id is not null and v_date<current_date then continue; end if;
select exists(select 1 from public.training_sessions where week_id=p_week_id and session_date=v_date and training_type in ('weights','resistance','cardio')) into v_training;
select * into v_plan from public.nutrition_plans where client_id=p_client_id and is_active
order by case when (source_json->>'weekday')::int=v_index then 0 when day_type=case when v_training then 'Training Day' else 'Rest Day' end or (not v_training and day_type='Non-Training Day') then 1 else 2 end,created_at desc limit 1;
if v_plan.id is null then continue; end if;
insert into public.nutrition_days(week_id,nutrition_date,nutrition_plan_id,calorie_target,protein_target_g,carbs_target_g,fat_target_g,adhered)
values(p_week_id,v_date,v_plan.id,v_plan.calories,v_plan.protein_g,v_plan.carbs_g,v_plan.fat_g,false)
on conflict(week_id,nutrition_date) do update set nutrition_plan_id=excluded.nutrition_plan_id,calorie_target=excluded.calorie_target,protein_target_g=excluded.protein_target_g,carbs_target_g=excluded.carbs_target_g,fat_target_g=excluded.fat_target_g;
v_count:=v_count+1;
end loop;
return v_count;
end;
$$;
revoke all on function public.assign_client_week_nutrition(uuid,uuid) from public,anon;
grant execute on function public.assign_client_week_nutrition(uuid,uuid) to authenticated;
-- Attach gap-filling to the existing weekly scheduler. Do not overwrite any
-- existing active manual assignment, such as an explicitly chosen Busy Day.
do $$
declare v_definition text;
begin
select pg_get_functiondef('public.prepare_client_week(uuid)'::regprocedure) into v_definition;
v_definition:=replace(v_definition,'if found then return v_new.id; end if;', 'if found then perform public.assign_client_week_nutrition(p_client_id,v_new.id); return v_new.id; end if;');
v_definition:=replace(v_definition,'  return v_new.id;', '  perform public.assign_client_week_nutrition(p_client_id,v_new.id); return v_new.id;');
execute v_definition;
end $$;

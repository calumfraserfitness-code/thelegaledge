alter table public.program_exercises add column if not exists image_url text;
alter table public.exercise_bank add column if not exists image_url text;

-- Save the entire menu in one transaction. RLS and assigned-coach authorization
-- apply to every write. Earlier plans/meals are retained, never deleted.
create or replace function public.import_client_nutrition(target_client_id uuid, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_client public.clients%rowtype;
  v_day jsonb; v_meal jsonb; v_ingredient jsonb; v_plan uuid; v_meal_id uuid;
  v_plans uuid[] := '{}'; v_old uuid[]; v_count integer; v_order integer;
  v_start date := current_date - (extract(isodow from current_date)::int-1);
  v_week uuid; v_date date; v_index integer; v_chosen public.nutrition_plans%rowtype;
  v_has_training boolean; v_explicit integer; v_totals numeric[];
begin
  select * into v_client from public.clients where id=target_client_id;
  if not found or not private.is_coach() or v_client.coach_id is distinct from auth.uid() then
    raise exception 'Only the assigned coach can import this menu' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_client_id::text || 'nutrition',0));
  if jsonb_typeof(payload->'days') is distinct from 'array' then raise exception 'Menu days must be an array'; end if;
  v_count := jsonb_array_length(payload->'days');
  if v_count not between 1 and 7 then raise exception 'Menu needs between one and seven days'; end if;
  select count(*) into v_explicit from jsonb_array_elements(payload->'days') d where d ? 'weekday';
  if v_explicit > 0 and (v_explicit <> 7 or
    (select count(distinct (d->>'weekday')::int) from jsonb_array_elements(payload->'days') d) <> 7 or
    exists(select 1 from jsonb_array_elements(payload->'days') d where (d->>'weekday')::numeric not between 0 and 6 or (d->>'weekday')::numeric<>trunc((d->>'weekday')::numeric))) then
    raise exception 'Weekly menus need all seven weekdays exactly once';
  end if;
  if (select sum((d->>'days_per_week')::numeric) from jsonb_array_elements(payload->'days') d) <> 7 then raise exception 'Day frequencies must total seven'; end if;
  select array_agg(id) into v_old from public.nutrition_plans where client_id=target_client_id and is_active;
  for v_day in select value from jsonb_array_elements(payload->'days') loop
    if coalesce(v_day->>'day_type','') not in ('Training Day','Rest Day','Non-Training Day','Busy Day') then raise exception 'Invalid day category'; end if;
    if coalesce((v_day->>'days_per_week')::numeric,0) not between 1 and 7 or (v_day->>'days_per_week')::numeric <> trunc((v_day->>'days_per_week')::numeric) then raise exception 'Invalid day frequency'; end if;
    if jsonb_typeof(v_day->'meals') is distinct from 'array' or jsonb_array_length(v_day->'meals') < 1 then raise exception 'Each day needs complete meals'; end if;
    if exists(select 1 from unnest(array['calories','protein_g','carbs_g','fat_g']) k where v_day->>k is null or (v_day->>k)::numeric < 0) then raise exception 'Day nutrition targets are required'; end if;
    v_totals := array[0,0,0,0]::numeric[];
    insert into public.nutrition_plans(client_id,name,day_type,days_per_week,calories,protein_g,carbs_g,fat_g,coach_notes,is_active,source_system,source_json)
      values(target_client_id,coalesce(nullif(v_day->>'name',''),v_day->>'day_type'),v_day->>'day_type',(v_day->>'days_per_week')::int,(v_day->>'calories')::int,(v_day->>'protein_g')::int,(v_day->>'carbs_g')::int,(v_day->>'fat_g')::int,v_day->>'coach_notes',true,'coach_json',v_day) returning id into v_plan;
    v_plans := array_append(v_plans,v_plan); v_order := 0;
    for v_meal in select value from jsonb_array_elements(v_day->'meals') loop
      if coalesce(btrim(v_meal->>'name'),'')='' or coalesce(btrim(v_meal->>'cooking_instructions'),'')='' then raise exception 'Each meal needs a name and cooking instructions'; end if;
      if jsonb_typeof(v_meal->'ingredients') is distinct from 'array' or jsonb_array_length(v_meal->'ingredients') < 1 then raise exception 'Every meal needs measured ingredients'; end if;
      for v_ingredient in select value from jsonb_array_elements(v_meal->'ingredients') loop
        if coalesce(btrim(v_ingredient->>'name'),'')='' or coalesce(btrim(v_ingredient->>'unit'),'')='' or coalesce((v_ingredient->>'quantity')::numeric,0)<=0 then raise exception 'Ingredient food, positive quantity and unit are required'; end if;
      end loop;
      if exists(select 1 from unnest(array['calories','protein_g','carbs_g','fat_g']) k where v_meal->>k is null or (v_meal->>k)::numeric < 0) then raise exception 'Meal nutrition totals are required'; end if;
      if abs((v_meal->>'protein_g')::numeric*4+(v_meal->>'carbs_g')::numeric*4+(v_meal->>'fat_g')::numeric*9-(v_meal->>'calories')::numeric)>greatest(100,(v_meal->>'calories')::numeric*.15) then raise exception 'Meal calories do not reconcile with macros'; end if;
      v_totals := array[v_totals[1]+(v_meal->>'calories')::numeric,v_totals[2]+(v_meal->>'protein_g')::numeric,v_totals[3]+(v_meal->>'carbs_g')::numeric,v_totals[4]+(v_meal->>'fat_g')::numeric];
      insert into public.meal_bank(name,meal_type,calories,protein_g,carbs_g,fat_g,ingredients,cooking_instructions,swaps,source_system)
        values(v_meal->>'name',coalesce(v_meal->>'meal_type','Meal'),(v_meal->>'calories')::numeric,(v_meal->>'protein_g')::numeric,(v_meal->>'carbs_g')::numeric,(v_meal->>'fat_g')::numeric,v_meal->'ingredients',v_meal->>'cooking_instructions',coalesce(v_meal->'swaps','[]'::jsonb),'coach_json') returning id into v_meal_id;
      insert into public.meal_assignments(meal_id,client_id,nutrition_plan_id,historical,sort_order) values(v_meal_id,target_client_id,v_plan,false,v_order);
      v_order := v_order+1;
    end loop;
    if abs(v_totals[1]-(v_day->>'calories')::numeric)>greatest(100,(v_day->>'calories')::numeric*.1) or abs(v_totals[2]-(v_day->>'protein_g')::numeric)>10 or abs(v_totals[3]-(v_day->>'carbs_g')::numeric)>10 or abs(v_totals[4]-(v_day->>'fat_g')::numeric)>10 then raise exception 'Meal totals do not match the day targets'; end if;
  end loop;
  update public.nutrition_plans set is_active=false where id=any(v_old);
  -- Apply the new menu to uncompleted days in the current draft; past/adhered
  -- assignments are left intact. Explicit weekdays take precedence.
  select id into v_week from public.program_weeks where client_id=target_client_id and week_start=v_start;
  if v_week is not null then
    for v_index in 0..6 loop
      v_date := v_start+v_index;
      if v_date < current_date or exists(select 1 from public.nutrition_days where week_id=v_week and nutrition_date=v_date and adhered) then continue; end if;
      select exists(select 1 from public.training_sessions where week_id=v_week and session_date=v_date and training_type in ('weights','resistance','cardio')) into v_has_training;
      select * into v_chosen from public.nutrition_plans where id=any(v_plans)
        order by case when (source_json->>'weekday')::int=v_index then 0 when day_type=case when v_has_training then 'Training Day' else 'Rest Day' end or (not v_has_training and day_type='Non-Training Day') then 1 else 2 end, array_position(v_plans,id) limit 1;
      insert into public.nutrition_days(week_id,nutrition_date,nutrition_plan_id,calorie_target,protein_target_g,carbs_target_g,fat_target_g,adhered)
        values(v_week,v_date,v_chosen.id,v_chosen.calories,v_chosen.protein_g,v_chosen.carbs_g,v_chosen.fat_g,false)
        on conflict(week_id,nutrition_date) do update set nutrition_plan_id=excluded.nutrition_plan_id,calorie_target=excluded.calorie_target,protein_target_g=excluded.protein_target_g,carbs_target_g=excluded.carbs_target_g,fat_target_g=excluded.fat_target_g;
    end loop;
  end if;
  return jsonb_build_object('plan_ids',to_jsonb(v_plans),'days',v_count);
end;
$$;
revoke all on function public.import_client_nutrition(uuid,jsonb) from public,anon;
grant execute on function public.import_client_nutrition(uuid,jsonb) to authenticated;

create or replace function public.save_client_nutrition_plan(p_client uuid,p_plan uuid,p_values jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare result public.nutrition_plans%rowtype; k text;
begin
 if not private.is_coach() or not exists(select 1 from public.clients where id=p_client and coach_id=auth.uid()) then raise exception 'Assigned coach required' using errcode='42501';end if;
 if not p_values ?& array['name','day_type','days_per_week','calories','protein_g','carbs_g','fat_g'] then raise exception 'Complete menu targets required';end if;
 if exists(select 1 from jsonb_object_keys(p_values) key where key not in('name','day_type','days_per_week','calories','protein_g','carbs_g','fat_g')) then raise exception 'Unsupported plan fields';end if;
 if p_values->>'day_type' not in('Training Day','Rest Day','Busy Day') or nullif(trim(p_values->>'name'),'') is null or (p_values->>'days_per_week')::int not between 0 and 7 then raise exception 'Check plan name, day type and days per week';end if;
 foreach k in array array['calories','protein_g','carbs_g','fat_g'] loop if jsonb_typeof(p_values->k)<>'number' or (p_values->>k)::numeric<0 then raise exception 'All four targets are required';end if;end loop;
 update public.nutrition_plans set name=p_values->>'name',day_type=p_values->>'day_type',days_per_week=(p_values->>'days_per_week')::int,calories=(p_values->>'calories')::numeric,protein_g=(p_values->>'protein_g')::numeric,carbs_g=(p_values->>'carbs_g')::numeric,fat_g=(p_values->>'fat_g')::numeric where id=p_plan and client_id=p_client returning * into result;
 if result.id is null then raise exception 'Client menu not found';end if;
 update public.nutrition_days d set calorie_target=result.calories,protein_target_g=result.protein_g,carbs_target_g=result.carbs_g,fat_target_g=result.fat_g
 from public.program_weeks w,public.clients c where d.week_id=w.id and w.client_id=p_client and c.id=w.client_id and d.nutrition_plan_id=p_plan and not d.adhered and d.nutrition_date>=(now() at time zone c.timezone)::date;
 return to_jsonb(result);
end $$;
revoke all on function public.save_client_nutrition_plan(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_client_nutrition_plan(uuid,uuid,jsonb) to authenticated;

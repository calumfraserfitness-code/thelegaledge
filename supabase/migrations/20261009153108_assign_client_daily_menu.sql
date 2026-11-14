create or replace function public.assign_client_daily_menu(p_client uuid,p_plan uuid,p_week uuid,p_dates date[])
returns setof public.nutrition_days language plpgsql security invoker set search_path='' as $$
declare c public.clients; p public.nutrition_plans; w public.program_weeks;
begin
 select * into c from public.clients where id=p_client;
 if auth.uid() is null or c.coach_id is distinct from auth.uid() or not exists(select 1 from public.profiles where id=auth.uid() and role='coach') then raise exception 'Assigned coach required'; end if;
 select * into p from public.nutrition_plans where id=p_plan and client_id=p_client and is_active is distinct from false;
 select * into w from public.program_weeks where id=p_week and client_id=p_client;
 if p.id is null or w.id is null then raise exception 'Choose this client’s menu and coaching week'; end if;
 if coalesce(cardinality(p_dates),0)<1 or cardinality(p_dates)>7 or exists(select 1 from unnest(p_dates) d where d is null or d<w.week_start or d>w.week_start+6) then raise exception 'Choose up to seven dates in the selected week'; end if;
 if exists(select 1 from public.nutrition_days where week_id=p_week and nutrition_date=any(p_dates) and adhered is true)
 or exists(select 1 from public.client_food_entries where client_id=p_client and entry_date=any(p_dates) and eaten is true) then raise exception 'A selected day already has a completed food log. Choose unlogged dates'; end if;
 return query insert into public.nutrition_days(week_id,nutrition_date,nutrition_plan_id,calorie_target,protein_target_g,carbs_target_g,fat_target_g,adhered)
 select p_week,d,p.id,p.calories,p.protein_g,p.carbs_g,p.fat_g,false from (select distinct unnest(p_dates) d) dates
 on conflict(week_id,nutrition_date) do update set nutrition_plan_id=excluded.nutrition_plan_id,calorie_target=excluded.calorie_target,protein_target_g=excluded.protein_target_g,carbs_target_g=excluded.carbs_target_g,fat_target_g=excluded.fat_target_g
 returning *;
end $$;
revoke all on function public.assign_client_daily_menu(uuid,uuid,uuid,date[]) from public,anon;
grant execute on function public.assign_client_daily_menu(uuid,uuid,uuid,date[]) to authenticated;

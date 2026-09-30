create or replace function public.save_client_meal(target_assignment_id uuid, meal_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.meal_assignments%rowtype; original public.meal_bank%rowtype; saved public.meal_bank%rowtype;
begin
 if not coalesce(private.is_coach(),false) then raise exception 'Coach access required'; end if;
 select * into a from public.meal_assignments where id=target_assignment_id for update;
 if not found or not coalesce(private.can_access_client(a.client_id),false) then raise exception 'Assigned meal unavailable'; end if;
 if jsonb_typeof(meal_patch) <> 'object' or nullif(btrim(meal_patch->>'name'),'') is null then raise exception 'Meal name required'; end if;
 if jsonb_typeof(meal_patch->'ingredients') <> 'array' then raise exception 'Ingredients must be a list'; end if;
 select * into original from public.meal_bank where id=a.meal_id;
 if not found then raise exception 'Source meal unavailable'; end if;
 insert into public.meal_bank(name,meal_type,calories,protein_g,carbs_g,fat_g,ingredients,preparation,cooking_instructions,swaps,tags,source_system)
 values(btrim(meal_patch->>'name'),meal_patch->>'meal_type',(meal_patch->>'calories')::numeric,(meal_patch->>'protein_g')::numeric,(meal_patch->>'carbs_g')::numeric,(meal_patch->>'fat_g')::numeric,meal_patch->'ingredients',original.preparation,meal_patch->>'cooking_instructions',original.swaps,original.tags,'coach_personal_adjustment') returning * into saved;
 update public.meal_assignments set meal_id=saved.id where id=a.id;
 if not found then raise exception 'Assignment was not updated'; end if;
 return jsonb_build_object('assignment_id',a.id,'meal',to_jsonb(saved));
end $$;
revoke all on function public.save_client_meal(uuid,jsonb) from public,anon;
grant execute on function public.save_client_meal(uuid,jsonb) to authenticated;
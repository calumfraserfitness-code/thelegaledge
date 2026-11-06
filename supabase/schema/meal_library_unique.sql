create or replace view public.meal_library_unique with (security_invoker=true) as
select distinct on (name,meal_type,calories,protein_g,carbs_g,fat_g,ingredients,preparation,cooking_instructions,swaps,tags)
id,name,meal_type,calories,protein_g,carbs_g,fat_g,ingredients,preparation,cooking_instructions,tags,source_system
from public.meal_bank
order by name,meal_type,calories,protein_g,carbs_g,fat_g,ingredients,preparation,cooking_instructions,swaps,tags,id;
revoke all on public.meal_library_unique from public,anon,authenticated;
grant select on public.meal_library_unique to authenticated;

begin;
create temp table recipe_test(coach_id uuid, client_id uuid);
insert into recipe_test select (select id from profiles where role='coach' limit 1),(select id from profiles where role='client' limit 1);
grant select on recipe_test to authenticated;
select set_config('request.jwt.claim.sub',(select coach_id::text from recipe_test),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.meal_bank where source_system='usda-meal-combinations-v1')<>2680 then raise exception 'Coach library is incomplete'; end if;
 if (select count(*) from (select id from public.meal_bank where source_system='usda-meal-combinations-v1' order by name,id offset 2400 limit 24) p)<>24 then raise exception 'Later pages unavailable'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select client_id::text from recipe_test),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.meal_bank where source_system='usda-meal-combinations-v1') then raise exception 'Client can see unassigned library meals'; end if;
end $$;
reset role;
select 'PASS coach has all 2680 combinations and pages after 2400; client sees no unassigned new library recipes.' as result;
rollback;

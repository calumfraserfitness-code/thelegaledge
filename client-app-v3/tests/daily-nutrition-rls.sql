begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('99910000-0000-4000-8000-000000000001','food-owner-qa@example.invalid','{}'),
 ('99910000-0000-4000-8000-000000000002','food-peer-qa@example.invalid','{}'),
 ('99910000-0000-4000-8000-000000000003','food-coach-qa@example.invalid','{}');
update public.profiles set role='coach' where id='99910000-0000-4000-8000-000000000003';
insert into public.clients(id,profile_id,coach_id,display_name) values
 ('99920000-0000-4000-8000-000000000001','99910000-0000-4000-8000-000000000001','99910000-0000-4000-8000-000000000003','Food QA owner'),
 ('99920000-0000-4000-8000-000000000002','99910000-0000-4000-8000-000000000002','99910000-0000-4000-8000-000000000003','Food QA peer');
set local role authenticated;
select set_config('request.jwt.claim.sub','99910000-0000-4000-8000-000000000001',true);
insert into public.client_food_entries(client_id,entry_date,slot_key,meal_snapshot,eaten) values
 ('99920000-0000-4000-8000-000000000001','2026-10-09','breakfast-1','{"name":"Fixture breakfast","calories":400}',true);
insert into public.client_food_entries(client_id,entry_date,slot_key,meal_snapshot,eaten) values
 ('99920000-0000-4000-8000-000000000001','2026-10-09','breakfast-1','{"name":"Fixture swap","calories":450}',false)
 on conflict(client_id,entry_date,slot_key) do update set meal_snapshot=excluded.meal_snapshot,eaten=excluded.eaten;
insert into public.client_recipe_favourites(client_id,recipe_key,meal_snapshot) values
 ('99920000-0000-4000-8000-000000000001','fixture','{"name":"Fixture recipe"}');
do $$begin
 if (select count(*) from client_food_entries where client_id='99920000-0000-4000-8000-000000000001')<>1 then raise exception 'Upsert duplicated dated meal';end if;
 if (select eaten from client_food_entries where client_id='99920000-0000-4000-8000-000000000001') then raise exception 'Chosen swap falsely logged eaten';end if;
 begin
  insert into client_food_entries(client_id,entry_date,slot_key,meal_snapshot) values('99920000-0000-4000-8000-000000000002','2026-10-09','peer','{"name":"Forbidden"}');
  raise exception 'Cross-client insert allowed';
 exception when insufficient_privilege then null;end;
 begin
  update client_food_entries set client_id='99920000-0000-4000-8000-000000000002' where client_id='99920000-0000-4000-8000-000000000001';
  raise exception 'Reassignment allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into client_food_entries(client_id,entry_date,slot_key,meal_snapshot,servings) values('99920000-0000-4000-8000-000000000001','2026-10-09','invalid','{"name":"Invalid"}',-1);
  raise exception 'Invalid servings allowed';
 exception when check_violation then null;end;
end$$;
select set_config('request.jwt.claim.sub','99910000-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from client_food_entries where client_id='99920000-0000-4000-8000-000000000001') then raise exception 'Peer read food';end if;
 if exists(select 1 from client_recipe_favourites where client_id='99920000-0000-4000-8000-000000000001') then raise exception 'Peer read favourites';end if;
end$$;
select set_config('request.jwt.claim.sub','99910000-0000-4000-8000-000000000003',true);
do $$begin
 if not exists(select 1 from client_food_entries where client_id='99920000-0000-4000-8000-000000000001') then raise exception 'Assigned coach cannot review';end if;
end$$;
set local role anon;
do $$begin
 begin perform * from client_food_entries;raise exception 'Public food access';exception when insufficient_privilege then null;end;
 begin perform * from client_recipe_favourites;raise exception 'Public recipe access';exception when insufficient_privilege then null;end;
end$$;
reset role;
select 'PASS: owner insert/upsert, dated replacement, no implicit eating, peer isolation, reassignment denial, coach review, invalid servings and anonymous denial; all fixture writes rolled back' as result;
rollback;

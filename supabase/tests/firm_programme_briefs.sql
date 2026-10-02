begin;
create temp table brief_fixture as select gen_random_uuid() coach, gen_random_uuid() other_coach, gen_random_uuid() client, gen_random_uuid() org, gen_random_uuid() pilot;
grant select on brief_fixture to authenticated;
insert into auth.users(id, aud, role, email, raw_user_meta_data)
select id,'authenticated','authenticated',id::text||'@example.invalid','{"full_name":"Brief test"}'::jsonb
from brief_fixture cross join lateral (values (coach),(other_coach),(client)) u(id);
insert into public.profiles(id,role,full_name)
select id, r::public.user_role,'Brief test' from brief_fixture cross join lateral (values (coach,'coach'),(other_coach,'coach'),(client,'client')) u(id,r)
on conflict(id) do update set role=excluded.role;
insert into public.firm_organizations(id,coach_id,name) select org,coach,'Rolled back fixture' from brief_fixture;
insert into public.firm_pilots(id,organization_id,coach_id,name) select pilot,org,coach,'Rolled back pilot' from brief_fixture;
select set_config('request.jwt.claim.sub',coach::text,true) from brief_fixture;
set local role authenticated;
insert into public.firm_programme_briefs(pilot_id,objective,success_criteria) select pilot,'Useful practical support','Agree measurable participation criteria' from brief_fixture;
update public.firm_programme_briefs set next_action='Review aggregate evidence',recommendation='adjust';
do $$ begin
 if (select count(*) from public.firm_programme_briefs) <> 1 or not exists(select 1 from public.firm_programme_briefs where recommendation='adjust') then raise exception 'Own coach save failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',other_coach::text,true) from brief_fixture;
do $$ begin
 if exists(select 1 from public.firm_programme_briefs) then raise exception 'Other coach could read brief'; end if;
 update public.firm_programme_briefs set objective='Unauthorized overwrite';
 if found then raise exception 'Other coach could update'; end if;
 begin
  insert into public.firm_programme_briefs(pilot_id,objective,success_criteria) select pilot,'Unauthorized creation','Unauthorized criterion' from brief_fixture;
  raise exception 'Other coach could insert';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',client::text,true) from brief_fixture;
do $$ begin
 if exists(select 1 from public.firm_programme_briefs) then raise exception 'Client could read firm brief'; end if;
 update public.firm_programme_briefs set objective='Unauthorized client change';
 if found then raise exception 'Client could update'; end if;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.firm_programme_briefs','select') then raise exception 'Anonymous grant exists'; end if;
 if not exists(select 1 from public.firm_programme_briefs where objective='Useful practical support' and next_action='Review aggregate evidence') then raise exception 'Original brief changed'; end if;
end $$;
rollback;

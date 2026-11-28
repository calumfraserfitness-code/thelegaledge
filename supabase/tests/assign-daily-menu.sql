-- Isolated fixtures and all writes roll back. Never changes real clients.
begin;
insert into auth.users(instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','99942000-0000-4000-8000-000000000001','authenticated','authenticated','qa-daily-menu-coach@example.invalid','{"role":"coach"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','99942000-0000-4000-8000-000000000002','authenticated','authenticated','qa-daily-menu-owner@example.invalid','{"role":"client"}','{}',now(),now());
update public.profiles set role='coach' where id='99942000-0000-4000-8000-000000000001';
insert into public.clients(id,profile_id,coach_id,display_name,status,source_system) values('99952000-0000-4000-8000-000000000001','99942000-0000-4000-8000-000000000002','99942000-0000-4000-8000-000000000001','QA only','past','qa_daily_menu_fixture');
insert into public.nutrition_plans(id,client_id,name,day_type,calories,protein_g,carbs_g,fat_g) values('99962000-0000-4000-8000-000000000001','99952000-0000-4000-8000-000000000001','QA daily menu','Training Day',2000,150,200,65);
insert into public.program_weeks(id,client_id,week_start,published) values('99972000-0000-4000-8000-000000000001','99952000-0000-4000-8000-000000000001','2026-10-05',false);
select set_config('request.jwt.claims','{"sub":"99942000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.assign_client_daily_menu('99952000-0000-4000-8000-000000000001','99962000-0000-4000-8000-000000000001','99972000-0000-4000-8000-000000000001',array['2026-10-09'::date,'2026-10-10'::date]);
do $$ begin
 if (select count(*) from public.nutrition_days where week_id='99972000-0000-4000-8000-000000000001' and nutrition_plan_id='99962000-0000-4000-8000-000000000001' and calorie_target=2000)<>2 then raise exception 'Assignment did not save'; end if;
 begin perform public.assign_client_daily_menu('99952000-0000-4000-8000-000000000001','99962000-0000-4000-8000-000000000001','99972000-0000-4000-8000-000000000001',array['2026-10-12'::date]); raise exception 'Unexpected cross-week assignment'; exception when others then if sqlerrm not like 'Choose up to seven dates%' then raise; end if; end;
end $$;
reset role;
update public.nutrition_days set adhered=true where week_id='99972000-0000-4000-8000-000000000001' and nutrition_date='2026-10-09';
set local role authenticated;
do $$ begin
 begin perform public.assign_client_daily_menu('99952000-0000-4000-8000-000000000001','99962000-0000-4000-8000-000000000001','99972000-0000-4000-8000-000000000001',array['2026-10-09'::date,'2026-10-11'::date]); raise exception 'Unexpected completed-day overwrite'; exception when others then if sqlerrm not like 'A selected day already%' then raise; end if; end;
 if exists(select 1 from public.nutrition_days where week_id='99972000-0000-4000-8000-000000000001' and nutrition_date='2026-10-11') then raise exception 'Failed batch partially saved'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"99942000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.assign_client_daily_menu('99952000-0000-4000-8000-000000000001','99962000-0000-4000-8000-000000000001','99972000-0000-4000-8000-000000000001',array['2026-10-10'::date]); raise exception 'Unexpected client assignment'; exception when others then if sqlerrm<>'Assigned coach required' then raise; end if; end;
end $$;
reset role;
select 'PASS: scoped coach assignment, exact dates/targets, no out-of-week assignment, completed-day protection, atomic failure and client denial' as result;
rollback;

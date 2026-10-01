create table public.client_coaching_goals(
id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id),title text not null check(length(title) between 1 and 160),
metric text not null check(metric in ('manual','weight_kg','steps','weekly_sessions','sleep_minutes','nutrition_adherence','energy')),
baseline numeric not null,current_value numeric,target numeric not null,unit text not null default '',target_date date,reason text,status text not null default 'active' check(status in ('active','complete','paused')),created_at timestamptz not null default now());
create index on public.client_coaching_goals(client_id,status);
create table public.client_coaching_calls(
id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id),title text not null default 'Monthly coaching call',
scheduled_at timestamptz not null,duration_minutes integer not null default 30 check(duration_minutes between 5 and 180),
join_url text check(join_url is null or join_url ~ '^https://'),status text not null default 'scheduled' check(status in ('scheduled','complete','cancelled')),recap text,created_at timestamptz not null default now());
create index on public.client_coaching_calls(client_id,scheduled_at);
create table public.client_coaching_guidance(
id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id),category text not null check(category in ('busy_week','eating_out','meal_example','recovery')),
title text not null check(length(title) between 1 and 160),body text not null,ingredients jsonb not null default '[]' check(jsonb_typeof(ingredients)='array'),
published boolean not null default false,created_at timestamptz not null default now());
create index on public.client_coaching_guidance(client_id,published);
alter table public.client_coaching_goals enable row level security;
grant select,insert,update,delete on public.client_coaching_goals to authenticated;
revoke all on public.client_coaching_goals from anon;
create policy client_coaching_goals_read on public.client_coaching_goals for select to authenticated using(private.can_access_client(client_id) );
create policy client_coaching_goals_coach_insert on public.client_coaching_goals for insert to authenticated with check(private.is_coach() and private.can_access_client(client_id));
create policy client_coaching_goals_coach_update on public.client_coaching_goals for update to authenticated using(private.is_coach() and private.can_access_client(client_id)) with check(private.is_coach() and private.can_access_client(client_id));
create policy client_coaching_goals_coach_delete on public.client_coaching_goals for delete to authenticated using(private.is_coach() and private.can_access_client(client_id));
alter table public.client_coaching_calls enable row level security;
grant select,insert,update,delete on public.client_coaching_calls to authenticated;
revoke all on public.client_coaching_calls from anon;
create policy client_coaching_calls_read on public.client_coaching_calls for select to authenticated using(private.can_access_client(client_id) );
create policy client_coaching_calls_coach_insert on public.client_coaching_calls for insert to authenticated with check(private.is_coach() and private.can_access_client(client_id));
create policy client_coaching_calls_coach_update on public.client_coaching_calls for update to authenticated using(private.is_coach() and private.can_access_client(client_id)) with check(private.is_coach() and private.can_access_client(client_id));
create policy client_coaching_calls_coach_delete on public.client_coaching_calls for delete to authenticated using(private.is_coach() and private.can_access_client(client_id));
alter table public.client_coaching_guidance enable row level security;
grant select,insert,update,delete on public.client_coaching_guidance to authenticated;
revoke all on public.client_coaching_guidance from anon;
create policy client_coaching_guidance_read on public.client_coaching_guidance for select to authenticated using(private.can_access_client(client_id) and (published or private.is_coach()));
create policy client_coaching_guidance_coach_insert on public.client_coaching_guidance for insert to authenticated with check(private.is_coach() and private.can_access_client(client_id));
create policy client_coaching_guidance_coach_update on public.client_coaching_guidance for update to authenticated using(private.is_coach() and private.can_access_client(client_id)) with check(private.is_coach() and private.can_access_client(client_id));
create policy client_coaching_guidance_coach_delete on public.client_coaching_guidance for delete to authenticated using(private.is_coach() and private.can_access_client(client_id));
alter table public.training_sessions add column scheduled_time time;
alter table public.training_sessions add column schedule_timezone text not null default 'Europe/Dublin';
alter table public.checkins add column period_start date;
alter table public.checkins add column workload integer check(workload between 1 and 10);
alter table public.checkins add column sleep_hours numeric check(sleep_hours between 0 and 24);
alter table public.checkins add column busy_week text;
alter table public.checkins add column next_week_availability text;
create unique index checkins_client_period on public.checkins(client_id,period_start) where period_start is not null;
create or replace function public.schedule_client_session(target_session_id uuid,new_date date,new_time time,new_timezone text)
returns public.training_sessions language plpgsql security invoker set search_path='' as $$
declare s public.training_sessions%rowtype; w public.program_weeks%rowtype;
begin
select * into s from public.training_sessions where id=target_session_id for update;
if not found then raise exception 'Session unavailable';end if;
select * into w from public.program_weeks where id=s.week_id;
if not coalesce(private.can_access_client(w.client_id),false) or (not w.published and not private.is_coach()) then raise exception 'Published client week required';end if;
if s.status='completed' then raise exception 'Completed activities cannot be moved';end if;
if new_date is null or new_date<w.week_start or new_date>w.week_start+6 then raise exception 'Choose a date in this week';end if;
if not exists(select 1 from pg_catalog.pg_timezone_names where name=new_timezone) then raise exception 'Choose a valid timezone';end if;
update public.training_sessions set session_date=new_date,scheduled_time=new_time,schedule_timezone=new_timezone,moved_from_date=coalesce(s.moved_from_date,case when new_date<>s.session_date then s.session_date end) where id=s.id returning * into s;
return s;end $$;
revoke all on function public.schedule_client_session(uuid,date,time,text) from public,anon;
grant execute on function public.schedule_client_session(uuid,date,time,text) to authenticated;

create or replace function public.submit_client_checkin(target_client_id uuid,answers jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.checkins%rowtype; p public.progress_entries%rowtype; period date; display_date date; field text; value numeric;
begin
if not coalesce(private.can_access_client(target_client_id),false) then raise exception 'Client access required';end if;
for field in select unnest(array['energy','sleep','stress','hunger','cravings','workload']) loop value:=(answers->>field)::numeric;if value is not null and (value<1 or value>10) then raise exception 'Ratings must be 1–10';end if;end loop;
for field in select unnest(array['training_adherence','nutrition_adherence']) loop value:=(answers->>field)::numeric;if value is not null and (value<0 or value>100) then raise exception 'Adherence must be 0–100';end if;end loop;
if (answers->>'weight_kg')::numeric<=0 or (answers->>'average_steps')::numeric<0 then raise exception 'Weight must be positive and steps nonnegative';end if;
period:=(answers->>'period_start')::date;
if period is null or extract(isodow from period)<>1 or period>date_trunc('week',now() at time zone 'Europe/Dublin')::date then raise exception 'Choose a current or past Monday';end if;
perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_client_id::text||period::text,0));
select * into c from public.checkins where client_id=target_client_id and period_start=period;
if found then return jsonb_build_object('checkin',to_jsonb(c),'already_submitted',true);end if;
insert into public.checkins(client_id,submitted_at,period_start,week_number,weight_kg,average_steps,training_adherence,nutrition_adherence,energy,sleep,stress,hunger,cravings,workload,sleep_hours,busy_week,next_week_availability,wins,challenges,support_needed,source_system)
values(target_client_id,now(),period,(answers->>'week_number')::int,(answers->>'weight_kg')::numeric,(answers->>'average_steps')::int,(answers->>'training_adherence')::int,(answers->>'nutrition_adherence')::int,(answers->>'energy')::int,(answers->>'sleep')::int,(answers->>'stress')::int,(answers->>'hunger')::int,(answers->>'cravings')::int,(answers->>'workload')::int,(answers->>'sleep_hours')::numeric,answers->>'busy_week',answers->>'next_week_availability',answers->>'wins',answers->>'challenges',answers->>'support_needed','client_weekly_v2')returning * into c;
display_date:=(now() at time zone 'Europe/Dublin')::date;
if c.weight_kg is not null or c.average_steps is not null or c.training_adherence is not null or c.nutrition_adherence is not null then
insert into public.progress_entries(client_id,entry_date,weight_kg,steps,training_adherence,nutrition_adherence)
values(target_client_id,display_date,c.weight_kg,c.average_steps,c.training_adherence,c.nutrition_adherence)
on conflict(client_id,entry_date)do update set weight_kg=coalesce(excluded.weight_kg,progress_entries.weight_kg),steps=coalesce(excluded.steps,progress_entries.steps),training_adherence=coalesce(excluded.training_adherence,progress_entries.training_adherence),nutrition_adherence=coalesce(excluded.nutrition_adherence,progress_entries.nutrition_adherence)
returning * into p;end if;
return jsonb_build_object('checkin',to_jsonb(c),'progress',case when p.id is not null then to_jsonb(p) end,'already_submitted',false);
end $$;
revoke all on function public.submit_client_checkin(uuid,jsonb) from public,anon;
grant execute on function public.submit_client_checkin(uuid,jsonb) to authenticated;
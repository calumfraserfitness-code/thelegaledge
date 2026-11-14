-- Client-owned weekly inputs; private to the participant and their assigned coach.
create table public.client_busy_week_settings (
 client_id uuid primary key references public.clients(id) on delete cascade,
 heavy_sessions integer not null default 2 check (heavy_sessions between 0 and 7),
 crisis_sessions integer not null default 1 check (crisis_sessions between 0 and 7 and crisis_sessions<=heavy_sessions),
 heavy_notes text not null default '' check(length(heavy_notes)<=2000),
 crisis_notes text not null default '' check(length(crisis_notes)<=2000),
 home_day_id uuid references public.training_program_days(id), hotel_day_id uuid references public.training_program_days(id),
 office_food text not null default '' check(length(office_food)<=2000),
 takeaway_food text not null default '' check(length(takeaway_food)<=2000),
 late_food text not null default '' check(length(late_food)<=2000),
 recovery_notes text not null default '' check(length(recovery_notes)<=2000),
 published boolean not null default false, updated_at timestamptz not null default now()
);
create table public.client_busy_weeks (
 client_id uuid not null references public.clients(id) on delete cascade,
 week_start date not null check(extract(isodow from week_start)=1),
 work_hours numeric not null check(work_hours between 0 and 120),
 sleep_hours numeric not null check(sleep_hours between 0 and 24),
 training_windows integer not null check(training_windows between 0 and 7),
 session_minutes integer not null check(session_minutes between 5 and 180),
 energy integer not null check(energy between 1 and 5), recovery integer not null check(recovery between 1 and 5),
 health text not null check(health in ('none','injury','illness')),
 travel boolean not null, location text not null check(location in ('gym','home','hotel')),
 meal_access text not null check(meal_access in ('prepared','office','takeaway','limited')),
 mode text not null check(mode in ('normal','heavy','crisis','review')),
 updated_at timestamptz not null default now(), primary key(client_id,week_start)
);
create table public.busy_week_session_swaps (
 session_id uuid primary key references public.training_sessions(id) on delete cascade,
 client_id uuid not null references public.clients(id) on delete cascade,
 original_day_id uuid references public.training_program_days(id), original_title text not null,
 updated_at timestamptz not null default now()
);
alter table public.client_busy_week_settings enable row level security;
alter table public.client_busy_weeks enable row level security;
alter table public.busy_week_session_swaps enable row level security;
create policy busy_settings_read on public.client_busy_week_settings for select to authenticated using (private.can_access_client(client_id));
create policy busy_settings_write on public.client_busy_week_settings for all to authenticated using (exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()) and private.is_coach())) with check (exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()) and private.is_coach()));
create policy busy_inputs_access on public.client_busy_weeks for all to authenticated using (private.can_access_client(client_id)) with check(private.can_access_client(client_id));
create policy busy_swaps_access on public.busy_week_session_swaps for all to authenticated using(private.can_access_client(client_id)) with check(private.can_access_client(client_id) and exists(select 1 from public.training_sessions s join public.program_weeks w on w.id=s.week_id where s.id=session_id and w.client_id=busy_week_session_swaps.client_id and original_day_id is not distinct from s.programme_day_id and original_title=s.title));
revoke all on public.client_busy_week_settings,public.client_busy_weeks,public.busy_week_session_swaps from anon,authenticated;
grant select,insert,update on public.client_busy_week_settings,public.client_busy_weeks,public.busy_week_session_swaps to authenticated;
revoke update on public.busy_week_session_swaps from authenticated;
grant all on public.client_busy_week_settings,public.client_busy_weeks,public.busy_week_session_swaps to service_role;
create function private.busy_week_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='client_busy_weeks' then
  new.mode:=case when new.health<>'none' then 'review'
   when new.training_windows<2 or new.work_hours>=60 or new.sleep_hours<5 or new.energy<=2 or new.recovery<=2 then 'crisis'
   when new.training_windows=2 or new.work_hours>=45 or new.sleep_hours<6.5 or new.energy=3 or new.recovery=3 or new.meal_access='limited' then 'heavy' else 'normal' end;
 else
  if (new.home_day_id is not null and not exists(select 1 from public.training_program_days d join public.training_programs p on p.id=d.program_id where d.id=new.home_day_id and p.client_id=new.client_id)) or (new.hotel_day_id is not null and not exists(select 1 from public.training_program_days d join public.training_programs p on p.id=d.program_id where d.id=new.hotel_day_id and p.client_id=new.client_id)) then raise exception 'Choose this client''s assigned workout';end if;
 end if;
 new.updated_at:=clock_timestamp();return new;
end $$;
create trigger busy_input_guard before insert or update on public.client_busy_weeks for each row execute function private.busy_week_guard();
create trigger busy_settings_guard before insert or update on public.client_busy_week_settings for each row execute function private.busy_week_guard();
create function public.save_busy_week(p_client uuid,p_week date,p_values jsonb,p_expected timestamptz default null) returns public.client_busy_weeks language plpgsql security invoker set search_path='' as $$
declare r public.client_busy_weeks; local_monday date; tz text;
begin
 if not coalesce(private.can_access_client(p_client),false) then raise exception 'Client unavailable';end if;
 select c.timezone into tz from public.clients c where c.id=p_client and c.deleted_at is null and c.status='active';
 if tz is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) then raise exception 'A valid client time zone is required';end if;
 local_monday:=date_trunc('week',now() at time zone tz)::date;
 if p_week is null or p_week<>local_monday then raise exception 'Refresh to set up the current week';end if;
 insert into public.client_busy_weeks(client_id,week_start,work_hours,sleep_hours,training_windows,session_minutes,energy,recovery,health,travel,location,meal_access,mode)
 values(p_client,p_week,(p_values->>'work_hours')::numeric,(p_values->>'sleep_hours')::numeric,(p_values->>'training_windows')::integer,(p_values->>'session_minutes')::integer,(p_values->>'energy')::integer,(p_values->>'recovery')::integer,p_values->>'health',(p_values->>'travel')::boolean,p_values->>'location',p_values->>'meal_access','normal')
 on conflict(client_id,week_start) do update set work_hours=excluded.work_hours,sleep_hours=excluded.sleep_hours,training_windows=excluded.training_windows,session_minutes=excluded.session_minutes,energy=excluded.energy,recovery=excluded.recovery,health=excluded.health,travel=excluded.travel,location=excluded.location,meal_access=excluded.meal_access where client_busy_weeks.updated_at is not distinct from p_expected returning * into r;
 if not found then raise exception 'This week changed on another device. Refresh before saving again';end if;return r;
end $$;
revoke all on function public.save_busy_week(uuid,date,jsonb,timestamptz) from public,anon;
grant execute on function public.save_busy_week(uuid,date,jsonb,timestamptz) to authenticated;
-- A location alternative must be explicitly selected and published by this client's coach.
create function public.use_busy_week_workout(p_session uuid,p_location text) returns public.training_sessions language plpgsql security invoker set search_path='' as $$
declare s public.training_sessions; w public.program_weeks; cfg public.client_busy_week_settings; d public.training_program_days; old public.busy_week_session_swaps; chosen uuid;
begin
 select * into s from public.training_sessions where id=p_session for update;
 if not found then raise exception 'Workout unavailable';end if;
 select * into w from public.program_weeks where id=s.week_id;
 if not w.published or not coalesce(private.can_access_client(w.client_id),false) then raise exception 'Published workout required';end if;
 if s.status='completed' or exists(select 1 from public.exercise_set_logs l where l.training_session_id=p_session) then raise exception 'A workout with recorded sets cannot be switched';end if;
 if exists(select 1 from public.client_busy_weeks b where b.client_id=w.client_id and b.week_start=w.week_start and b.health<>'none') then raise exception 'Ask your coach to review your health change before switching workouts';end if;
 select * into cfg from public.client_busy_week_settings where client_id=w.client_id;
 select * into old from public.busy_week_session_swaps where session_id=p_session;
 if p_location='original' then
  if old.session_id is null then raise exception 'No original workout to restore';end if;
  update public.training_sessions set programme_day_id=old.original_day_id,title=old.original_title where id=p_session returning * into s;return s;
 end if;
 if p_location not in ('home','hotel') or cfg.published is not true then raise exception 'Coach-approved alternative required';end if;
 chosen:=case p_location when 'home' then cfg.home_day_id else cfg.hotel_day_id end;
 select td.* into d from public.training_program_days td join public.training_programs p on p.id=td.program_id where td.id=chosen and p.client_id=w.client_id and td.training_type=s.training_type;
 if not found then raise exception 'No matching coach-approved alternative is available';end if;
 insert into public.busy_week_session_swaps(session_id,client_id,original_day_id,original_title) values(p_session,w.client_id,s.programme_day_id,s.title) on conflict(session_id) do nothing;
 update public.training_sessions set programme_day_id=d.id,title=d.title where id=p_session returning * into s;return s;
end $$;
revoke all on function public.use_busy_week_workout(uuid,text) from public,anon;
grant execute on function public.use_busy_week_workout(uuid,text) to authenticated;

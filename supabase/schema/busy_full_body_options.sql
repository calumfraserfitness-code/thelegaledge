
alter table public.client_busy_week_settings add column heavy_day_a uuid references public.training_program_days(id);
alter table public.client_busy_week_settings add column heavy_day_b uuid references public.training_program_days(id);
create function private.guard_busy_full_body_options() returns trigger language plpgsql security invoker set search_path='' as $$
declare dayid uuid;
begin
 foreach dayid in array array[new.heavy_day_a,new.heavy_day_b] loop
  if dayid is not null and not exists(select 1 from public.training_program_days d join public.training_programs p on p.id=d.program_id where d.id=dayid and p.client_id=new.client_id and d.training_type in ('weights','resistance') and exists(select 1 from public.program_exercises e where e.program_day_id=d.id)) then raise exception 'Choose this client''s prescribed strength workout';end if;
 end loop;return new;
end $$;
create trigger busy_full_body_guard before insert or update on public.client_busy_week_settings for each row execute function private.guard_busy_full_body_options();

create or replace function public.use_busy_week_workout(p_session uuid,p_location text) returns public.training_sessions language plpgsql security invoker set search_path='' as $$
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
 if p_location not in ('home','hotel','heavy_a','heavy_b') or cfg.published is not true then raise exception 'Coach-approved alternative required';end if;
 chosen:=case p_location when 'home' then cfg.home_day_id when 'hotel' then cfg.hotel_day_id when 'heavy_a' then cfg.heavy_day_a else cfg.heavy_day_b end;
 select td.* into d from public.training_program_days td join public.training_programs p on p.id=td.program_id where td.id=chosen and p.client_id=w.client_id and td.training_type in ('weights','resistance') and s.training_type in ('weights','resistance');
 if not found then raise exception 'No matching coach-approved alternative is available';end if;
 insert into public.busy_week_session_swaps(session_id,client_id,original_day_id,original_title) values(p_session,w.client_id,s.programme_day_id,s.title) on conflict(session_id) do nothing;
 update public.training_sessions set programme_day_id=d.id,title=d.title where id=p_session returning * into s;return s;
end $$;
revoke all on function public.use_busy_week_workout(uuid,text) from public,anon;
grant execute on function public.use_busy_week_workout(uuid,text) to authenticated;

-- Preserve prescribed-plan protection; allow only the assigned coach's published alternatives.
create or replace function private.guard_client_plan_update() returns trigger language plpgsql security invoker set search_path='' as $$
declare allowed text[];
begin
 if auth.uid() is null or private.is_coach() then return new;end if;
 allowed:=case when tg_table_name='training_sessions' then array['status','completed_at','session_date','scheduled_time','schedule_timezone','moved_from_date','updated_at'] else array['adhered','updated_at'] end;
 if tg_table_name='training_sessions' then
  if (new.programme_day_id is distinct from old.programme_day_id or new.title is distinct from old.title)
   and old.status='planned' and new.status=old.status
   and not exists(select 1 from public.exercise_set_logs l where l.training_session_id=old.id)
   and exists(select 1 from public.program_weeks w where w.id=old.week_id and w.published and private.can_access_client(w.client_id)
    and not exists(select 1 from public.client_busy_weeks b where b.client_id=w.client_id and b.week_start=w.week_start and b.health<>'none')
    and (
     exists(select 1 from public.client_busy_week_settings cfg join public.training_program_days d on d.id=new.programme_day_id join public.training_programs p on p.id=d.program_id
       where cfg.client_id=w.client_id and cfg.published and new.programme_day_id in (cfg.home_day_id,cfg.hotel_day_id,cfg.heavy_day_a,cfg.heavy_day_b) and p.client_id=w.client_id and d.title=new.title and d.training_type in ('weights','resistance') and new.training_type in ('weights','resistance'))
     or exists(select 1 from public.busy_week_session_swaps swap where swap.session_id=old.id and swap.client_id=w.client_id and swap.original_day_id is not distinct from new.programme_day_id and swap.original_title=new.title)
    )) then allowed:=allowed||array['programme_day_id','title'];
  end if;
 end if;
 if (to_jsonb(new)-allowed) is distinct from (to_jsonb(old)-allowed) then raise exception 'Only your coach can edit prescribed plan details' using errcode='42501';end if;
 if tg_table_name='training_sessions' and new.session_date is distinct from old.session_date then
  if old.status='completed' or not exists(select 1 from public.program_weeks w where w.id=new.week_id and new.session_date between w.week_start and w.week_start+6) then raise exception 'Choose a date in your published week' using errcode='42501';end if;
 end if;
 return new;
end $$;


create function public.save_busy_week_plan(p_client uuid,p_week date,p_values jsonb,p_expected timestamptz default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.client_busy_weeks;cfg public.client_busy_week_settings;s record;changed jsonb:='[]';item public.training_sessions;remaining integer;slot integer:=0;
begin
 r:=public.save_busy_week(p_client,p_week,p_values,p_expected);
 select * into cfg from public.client_busy_week_settings where client_id=p_client;
 if r.mode='heavy' and cfg.published and cfg.heavy_day_a is not null and cfg.heavy_day_b is not null then
  select greatest(0,least(2,r.training_windows,cfg.heavy_sessions)-count(*))::int into remaining from public.training_sessions ts join public.program_weeks w on w.id=ts.week_id where w.client_id=p_client and w.week_start=p_week and ts.status='completed' and ts.training_type in ('weights','resistance');
  for s in select ts.id from public.training_sessions ts join public.program_weeks w on w.id=ts.week_id where w.client_id=p_client and w.week_start=p_week and w.published and ts.status='planned' and ts.training_type in ('weights','resistance') and not exists(select 1 from public.exercise_set_logs l where l.training_session_id=ts.id) order by ts.session_date,ts.id limit remaining loop
   item:=public.use_busy_week_workout(s.id,case when slot=0 then 'heavy_a' else 'heavy_b' end);changed:=changed||jsonb_build_array(to_jsonb(item));slot:=slot+1;
  end loop;
 end if;
 return to_jsonb(r)||jsonb_build_object('adapted_sessions',changed);
end $$;
revoke all on function public.save_busy_week_plan(uuid,date,jsonb,timestamptz) from public,anon;
grant execute on function public.save_busy_week_plan(uuid,date,jsonb,timestamptz) to authenticated;

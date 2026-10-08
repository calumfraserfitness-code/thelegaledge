create table if not exists public.session_exercise_choices (
 client_id uuid not null references public.clients(id) on delete cascade,
 training_session_id uuid not null references public.training_sessions(id) on delete cascade,
 program_exercise_id uuid not null references public.program_exercises(id) on delete cascade,
 exercise_name text not null check(length(exercise_name) between 1 and 160),
 updated_at timestamptz not null default now(),
 primary key(client_id,training_session_id,program_exercise_id)
);
alter table public.session_exercise_choices enable row level security;
grant select,insert,update,delete on public.session_exercise_choices to authenticated;
revoke all on public.session_exercise_choices from anon;
create policy session_exercise_choices_read on public.session_exercise_choices for select to authenticated using (
 exists(select 1 from public.clients c where c.id=session_exercise_choices.client_id and (c.profile_id=(select auth.uid()) or c.coach_id=(select auth.uid())))
);
create policy session_exercise_choices_insert on public.session_exercise_choices for insert to authenticated with check (
 exists(select 1 from public.clients c join public.program_weeks w on w.client_id=c.id join public.training_sessions s on s.week_id=w.id join public.program_exercises e on e.program_day_id=s.programme_day_id
 where c.id=session_exercise_choices.client_id and s.id=session_exercise_choices.training_session_id and e.id=session_exercise_choices.program_exercise_id and w.published and c.portal_enabled and c.plan_status='published' and c.onboarding_status='complete' and (c.profile_id=(select auth.uid()) or c.coach_id=(select auth.uid()))
 and (session_exercise_choices.exercise_name=e.name or exists(select 1 from unnest(string_to_array(coalesce(e.alternatives,''),'|')) as option(name) where trim(option.name)=session_exercise_choices.exercise_name)))
);
create policy session_exercise_choices_update on public.session_exercise_choices for update to authenticated using (
 exists(select 1 from public.clients c where c.id=session_exercise_choices.client_id and (c.profile_id=(select auth.uid()) or c.coach_id=(select auth.uid())))
) with check (
 exists(select 1 from public.clients c join public.program_weeks w on w.client_id=c.id join public.training_sessions s on s.week_id=w.id join public.program_exercises e on e.program_day_id=s.programme_day_id
 where c.id=session_exercise_choices.client_id and s.id=session_exercise_choices.training_session_id and e.id=session_exercise_choices.program_exercise_id and w.published and c.portal_enabled and c.plan_status='published' and c.onboarding_status='complete' and (c.profile_id=(select auth.uid()) or c.coach_id=(select auth.uid()))
 and (session_exercise_choices.exercise_name=e.name or exists(select 1 from unnest(string_to_array(coalesce(e.alternatives,''),'|')) as option(name) where trim(option.name)=session_exercise_choices.exercise_name)))
);
alter table public.exercise_set_logs add column if not exists exercise_name text;
create or replace function private.lock_session_exercise_choice() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.training_session_id::text||new.program_exercise_id::text,0));
 if exists(select 1 from public.exercise_set_logs l where l.client_id=new.client_id and l.training_session_id=new.training_session_id and l.program_exercise_id=new.program_exercise_id) then
  raise exception 'This exercise already has logged sets. Keep the recorded exercise for this session.';
 end if;
 new.updated_at=now();return new;
end $$;
create trigger lock_session_exercise_choice before insert or update on public.session_exercise_choices for each row execute function private.lock_session_exercise_choice();
create or replace function private.snapshot_logged_exercise_name() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.training_session_id::text||new.program_exercise_id::text,0));
 if TG_OP='UPDATE' and old.exercise_name is not null then new.exercise_name=old.exercise_name;return new;end if;
 select coalesce((select x.exercise_name from public.session_exercise_choices x where x.client_id=new.client_id and x.training_session_id=new.training_session_id and x.program_exercise_id=new.program_exercise_id),e.name) into new.exercise_name from public.program_exercises e where e.id=new.program_exercise_id;
 return new;
end $$;
create trigger snapshot_logged_exercise_name before insert or update on public.exercise_set_logs for each row execute function private.snapshot_logged_exercise_name();
revoke all on function private.lock_session_exercise_choice() from public,anon;
revoke all on function private.snapshot_logged_exercise_name() from public,anon;
create index session_exercise_choices_session_idx on public.session_exercise_choices(training_session_id);
create index session_exercise_choices_exercise_idx on public.session_exercise_choices(program_exercise_id);

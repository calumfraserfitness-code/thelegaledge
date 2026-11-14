-- Recorder identity is never a client identity.
create or replace function private.guard_fathom_client_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.source='fathom' and new.client_id is not null and not exists(select 1 from public.clients c join public.profiles p on p.id=c.profile_id where c.id=new.client_id and c.coach_id=new.coach_id and c.status='active' and c.deleted_at is null and p.role='client' and p.id<>new.coach_id) then
  new.analysis:=coalesce(new.analysis,'{}')||jsonb_build_object('identity_review_reason','Source match was not an active client profile','previous_client_id',new.client_id);new.client_id:=null;new.matching_status:='unmatched';
 end if;return new;
end $$;
create trigger fathom_client_identity_guard before insert or update of client_id,matching_status on public.coaching_recording_events for each row execute function private.guard_fathom_client_identity();
create table public.fathom_training_update_receipts(
 event_id uuid primary key references public.coaching_recording_events(id),coach_id uuid not null references public.profiles(id),client_id uuid not null references public.clients(id),previous_program_id uuid not null references public.training_programs(id),new_program_id uuid not null references public.training_programs(id),before_hash text not null,evidence text not null,status text not null check(status in('draft','applied')),created_at timestamptz not null default now());
alter table public.fathom_training_update_receipts enable row level security;
revoke all on public.fathom_training_update_receipts from public,anon,authenticated;
grant select on public.fathom_training_update_receipts to authenticated;
grant all on public.fathom_training_update_receipts to service_role;
create policy fathom_training_receipt_coach on public.fathom_training_update_receipts for select to authenticated using(coach_id=(select auth.uid()) and private.is_coach());
create function public.coaching_training_snapshot(p_program uuid) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('program',to_jsonb(p),'days',(select jsonb_agg(to_jsonb(d)||jsonb_build_object('exercises',(select jsonb_agg(to_jsonb(e) order by e.sort_order,e.id) from public.program_exercises e where e.program_day_id=d.id)) order by d.id) from public.training_program_days d where d.program_id=p.id)) from public.training_programs p where p.id=p_program;
$$;
revoke all on function public.coaching_training_snapshot(uuid) from public,anon;
grant execute on function public.coaching_training_snapshot(uuid) to authenticated,service_role;
-- Worker-only, atomic and idempotent. The connected worker sets the verified coach JWT
-- claim within its SQL transaction; this function still checks the source and ownership.
create function public.apply_fathom_training_update(p_coach uuid,p_event uuid,p_program uuid,p_before_hash text,p_payload jsonb,p_evidence text,p_apply boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.coaching_recording_events;c public.clients;p public.training_programs;r public.fathom_training_update_receipts;result jsonb;n uuid;snapshot jsonb;
begin
 if auth.uid() is distinct from p_coach or not private.is_coach() then raise exception 'Verified coach required';end if;
 select * into e from public.coaching_recording_events where id=p_event for update;
 if e.coach_id is distinct from p_coach or e.source<>'fathom' or e.matching_status<>'matched' or e.client_id is null or e.occurred_at<now()-interval '1 month' then raise exception 'Verified recent client recording required';end if;
 select * into c from public.clients where id=e.client_id;
 if c.coach_id is distinct from p_coach or c.status<>'active' or c.deleted_at is not null or not exists(select 1 from public.profiles where id=c.profile_id and role='client' and id<>p_coach) then raise exception 'Active genuine client required';end if;
 select * into r from public.fathom_training_update_receipts where event_id=p_event;
 if found then return to_jsonb(r)||jsonb_build_object('already_processed',true);end if;
 select * into p from public.training_programs where id=p_program for update;
 if p.client_id is distinct from c.id or p.status<>'active' then raise exception 'Current client programme required';end if;
 snapshot:=public.coaching_training_snapshot(p_program);
 if md5(snapshot::text) is distinct from p_before_hash then raise exception 'Programme changed; review fresh evidence';end if;
 if coalesce(length(trim(p_evidence)),0) not between 20 and 4000 then raise exception 'Source agreement evidence required';end if;
 result:=public.import_client_training(c.id,p_payload||jsonb_build_object('fathom_event_id',p_event,'source_url',e.source_url,'agreement_evidence',p_evidence));n:=(result->>'programme_id')::uuid;
 if p_apply then
  if e.occurred_at<p.created_at then raise exception 'Older call requires a reviewed draft';end if;
  if (select count(*) from public.training_program_days where program_id=p_program)<>(select count(*) from public.training_program_days where program_id=n) or exists(select 1 from public.training_program_days od where od.program_id=p_program and (select count(*) from public.training_program_days nd where nd.program_id=n and nd.title=od.title and nd.day_index=od.day_index and nd.training_type=od.training_type)<>1) then raise exception 'Changed workout schedule requires a reviewed draft';end if;
  if exists(select 1 from public.training_program_days nd join public.program_exercises x on x.program_day_id=nd.id where nd.program_id=n and nd.training_type in ('weights','resistance') and (x.sets is null or coalesce(trim(x.reps),'')='' or x.rest_seconds is null)) then raise exception 'Incomplete exercise prescription requires a reviewed draft';end if;
  -- Preserve all historical/recorded workouts. Only same-named, unstarted future
  -- sessions adopt a new prescription; changed schedules require coach review.
  update public.training_programs set status='active' where id=n;
  update public.training_programs set status='archived' where id=p_program;
  update public.training_sessions s set programme_day_id=nd.id from public.program_weeks w,public.training_program_days od,public.training_program_days nd
   where s.week_id=w.id and w.client_id=c.id and s.session_date>=(now() at time zone c.timezone)::date and s.status='planned' and od.id=s.programme_day_id and od.program_id=p_program and nd.program_id=n and nd.title=od.title
   and not exists(select 1 from public.exercise_set_logs l where l.training_session_id=s.id);
   update public.client_busy_week_settings cfg set
   home_day_id=coalesce((select nd.id from public.training_program_days od join public.training_program_days nd on nd.title=od.title and nd.program_id=n where od.id=cfg.home_day_id and od.program_id=p_program),cfg.home_day_id),
   hotel_day_id=coalesce((select nd.id from public.training_program_days od join public.training_program_days nd on nd.title=od.title and nd.program_id=n where od.id=cfg.hotel_day_id and od.program_id=p_program),cfg.hotel_day_id),
   heavy_day_a=coalesce((select nd.id from public.training_program_days od join public.training_program_days nd on nd.title=od.title and nd.program_id=n where od.id=cfg.heavy_day_a and od.program_id=p_program),cfg.heavy_day_a),
   heavy_day_b=coalesce((select nd.id from public.training_program_days od join public.training_program_days nd on nd.title=od.title and nd.program_id=n where od.id=cfg.heavy_day_b and od.program_id=p_program),cfg.heavy_day_b)
   where cfg.client_id=c.id;
 end if;
 insert into public.fathom_training_update_receipts(event_id,coach_id,client_id,previous_program_id,new_program_id,before_hash,evidence,status) values(p_event,p_coach,c.id,p_program,n,p_before_hash,p_evidence,case when p_apply then 'applied' else 'draft' end) returning * into r;
 return to_jsonb(r)||jsonb_build_object('already_processed',false);
end $$;
revoke all on function public.apply_fathom_training_update(uuid,uuid,uuid,text,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.apply_fathom_training_update(uuid,uuid,uuid,text,jsonb,text,boolean) to service_role;

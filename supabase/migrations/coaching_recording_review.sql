-- Additive review workflow. Raw recordings and proposals are coach-only.
alter table public.coaching_recording_events add column coach_id uuid references public.profiles(id), add column analysis jsonb not null default '{}', add column last_error text;
create index coaching_recording_coach_date on public.coaching_recording_events(coach_id,occurred_at desc);
create index coaching_recording_client_date on public.coaching_recording_events(client_id,occurred_at desc);
revoke all on public.coaching_recording_events,public.coaching_change_proposals from anon,authenticated;
grant select on public.coaching_recording_events,public.coaching_change_proposals to authenticated;
grant all on public.coaching_recording_events,public.coaching_change_proposals to service_role;
create policy recording_assigned_coach on public.coaching_recording_events for select to authenticated using(coach_id=(select auth.uid()) and private.is_coach());
create policy proposal_assigned_coach on public.coaching_change_proposals for select to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid())) and private.is_coach());
create table public.client_weekly_focus(
 id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id),
 proposal_id uuid not null unique references public.coaching_change_proposals(id),
 description text not null check(length(description) between 1 and 2000),
 starts_on date not null,expires_on date not null check(expires_on>=starts_on),
 completed_at timestamptz,archived_at timestamptz,approved_by uuid not null references public.profiles(id),approved_at timestamptz not null default now());
create index focus_client_dates on public.client_weekly_focus(client_id,expires_on);
alter table public.client_weekly_focus enable row level security;
revoke all on public.client_weekly_focus from public,anon,authenticated;
grant select on public.client_weekly_focus to authenticated;
grant all on public.client_weekly_focus to service_role;
create policy focus_owner_read on public.client_weekly_focus for select to authenticated using(private.can_access_client(client_id));
create table public.coaching_review_audit(
 id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id),
 proposal_id uuid references public.coaching_change_proposals(id),actor_id uuid not null references public.profiles(id),
 action text not null,before_value jsonb,after_value jsonb,created_at timestamptz not null default now());
alter table public.coaching_review_audit enable row level security;
revoke all on public.coaching_review_audit from public,anon,authenticated;
grant select on public.coaching_review_audit to authenticated;
grant all on public.coaching_review_audit to service_role;
create policy review_audit_coach on public.coaching_review_audit for select to authenticated using(private.is_coach() and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid())));
-- Privileged functions live in the unexposed private schema with explicit checks.
-- There are no direct client writes to proposals, source data or approval fields.
create function private.review_coaching_proposal(p_id uuid,p_decision text,p_description text,p_starts date,p_expires date,p_conflict_reviewed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.coaching_change_proposals; e public.coaching_recording_events; f public.client_weekly_focus; before_p jsonb;
begin
 if auth.uid() is null or not private.is_coach() then raise exception 'Coach access required';end if;
 if p_decision not in ('approved','rejected') then raise exception 'Invalid decision';end if;
 select * into p from public.coaching_change_proposals where id=p_id for update;
 if not found or not exists(select 1 from public.clients c where c.id=p.client_id and c.coach_id=auth.uid()) then raise exception 'Assigned coach required';end if;
 select * into e from public.coaching_recording_events where id=p.recording_event_id;
 if e.client_id is distinct from p.client_id or e.coach_id is distinct from auth.uid() or e.matching_status<>'matched' then raise exception 'Verify the recording identity first';end if;
 if p.status<>'pending' then return jsonb_build_object('status',p.status,'already_reviewed',true);end if;
 before_p:=to_jsonb(p);
 if p_decision='approved' then
   if length(trim(p_description)) not between 1 and 2000 or p_description is null then raise exception 'Enter a clear client instruction';end if;
   if p_starts is null or p_expires is null or p_expires<p_starts or p_expires<current_date or p_expires>p_starts+31 then raise exception 'Choose a current focus period of at most 31 days';end if;
   if coalesce((p.proposed_value->>'requires_reconciliation')::boolean,false) and not coalesce(p_conflict_reviewed,false) then raise exception 'Reconcile the conflicting prescription first';end if;
   insert into public.client_weekly_focus(client_id,proposal_id,description,starts_on,expires_on,approved_by) values(p.client_id,p.id,trim(p_description),p_starts,p_expires,auth.uid()) returning * into f;
 end if;
 update public.coaching_change_proposals set status=p_decision,description=case when p_decision='approved' then trim(p_description) else description end,reviewed_at=now() where id=p.id returning * into p;
 insert into public.coaching_review_audit(client_id,proposal_id,actor_id,action,before_value,after_value) values(p.client_id,p.id,auth.uid(),p_decision,before_p,to_jsonb(p));
 return jsonb_build_object('status',p.status,'focus',to_jsonb(f),'prescriptions_changed',false);
end $$;
revoke all on function private.review_coaching_proposal(uuid,text,text,date,date,boolean) from public,anon,authenticated;
grant execute on function private.review_coaching_proposal(uuid,text,text,date,date,boolean) to authenticated;
create function public.review_coaching_proposal(p_id uuid,p_decision text,p_description text default null,p_starts date default null,p_expires date default null,p_conflict_reviewed boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.review_coaching_proposal(p_id,p_decision,p_description,p_starts,p_expires,p_conflict_reviewed) $$;
revoke all on function public.review_coaching_proposal(uuid,text,text,date,date,boolean) from public,anon;
grant execute on function public.review_coaching_proposal(uuid,text,text,date,date,boolean) to authenticated;
create function private.complete_coaching_focus(p_id uuid,p_complete boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.client_weekly_focus;begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into f from public.client_weekly_focus where id=p_id for update;
 if not found or not exists(select 1 from public.clients c where c.id=f.client_id and c.profile_id=auth.uid()) then raise exception 'Client ownership required';end if;
 if f.archived_at is not null or f.expires_on<current_date or f.starts_on>current_date then raise exception 'This focus is not current';end if;
 update public.client_weekly_focus set completed_at=case when p_complete then now() else null end where id=p_id returning * into f;
 insert into public.coaching_review_audit(client_id,proposal_id,actor_id,action,after_value) values(f.client_id,f.proposal_id,auth.uid(),case when p_complete then 'completed' else 'reopened' end,to_jsonb(f));
 return to_jsonb(f);end $$;
revoke all on function private.complete_coaching_focus(uuid,boolean) from public,anon;
grant execute on function private.complete_coaching_focus(uuid,boolean) to authenticated;
create function public.complete_coaching_focus(p_id uuid,p_complete boolean) returns jsonb language sql security invoker set search_path='' as $$select private.complete_coaching_focus(p_id,p_complete)$$;
revoke all on function public.complete_coaching_focus(uuid,boolean) from public,anon;
grant execute on function public.complete_coaching_focus(uuid,boolean) to authenticated;
-- Scheduled expiry archives targets, preserving completion and source history.
create function private.archive_coaching_focus() returns void language sql security definer set search_path='' as $$update public.client_weekly_focus set archived_at=now() where expires_on<current_date and archived_at is null$$;
revoke all on function private.archive_coaching_focus() from public,anon,authenticated,service_role;
select cron.schedule('legal-edge-focus-expiry','15 0 * * *','select private.archive_coaching_focus();');

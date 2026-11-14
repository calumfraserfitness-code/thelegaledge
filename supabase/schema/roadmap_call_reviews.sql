-- Goal changes are private, source-linked and revision checked. No prescription writes.
create function private.valid_roadmap_goal_details(p jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare g jsonb;k text;d date;begin
 for g in select value from jsonb_array_elements(p->'goals') loop
  foreach k in array array['baseline','target','weekly_actions','source_ref','review_on'] loop
   if g ? k and (jsonb_typeof(g->k)<>'string' or length(g->>k)>case when k='review_on' then 10 else 1000 end) then return false;end if;
  end loop;
  if g ? 'target_status' and coalesce(g->>'target_status','') not in('proposed','agreed') then return false;end if;
  if coalesce(g->>'review_on','')<>'' then
   if g->>'review_on' !~ '^\d{4}-\d{2}-\d{2}$' then return false;end if;
   begin d:=(g->>'review_on')::date;exception when others then return false;end;
  end if;
  if g->>'target_status'='agreed' then
   foreach k in array array['baseline','target','weekly_actions','success_measure','review_on'] loop
    if length(trim(coalesce(g->>k,'')))=0 then return false;end if;
   end loop;
  end if;
 end loop;return true;
end $$;
revoke all on function private.valid_roadmap_goal_details(jsonb) from public,anon;
grant execute on function private.valid_roadmap_goal_details(jsonb) to authenticated;
alter table public.coach_client_roadmaps add constraint roadmap_goal_details check(private.valid_roadmap_goal_details(payload));
create table public.coach_roadmap_versions(
 client_id uuid not null references public.clients(id),coach_id uuid not null references public.profiles(id),revision integer not null,
 payload jsonb not null,changed_at timestamptz not null,actor_id uuid,reason text not null,source_event_id uuid,
 primary key(client_id,coach_id,revision));
create table public.coach_goal_call_reviews(
 client_id uuid not null references public.clients(id),coach_id uuid not null references public.profiles(id),event_id uuid not null references public.coaching_recording_events(id),
 source_hash text not null,status text not null default 'pending' check(status in('pending','reviewed')),created_at timestamptz not null default now(),reviewed_at timestamptz,
 primary key(event_id,coach_id));
create table public.coach_goal_change_receipts(
 client_id uuid not null references public.clients(id),coach_id uuid not null references public.profiles(id),event_id uuid not null references public.coaching_recording_events(id),
 goal_id text not null,source_hash text not null,action text not null,reason text not null,before_goal jsonb not null,after_goal jsonb not null,
 roadmap_revision integer not null,created_at timestamptz not null default now(),
 primary key(event_id,coach_id,goal_id,source_hash));
create index coach_goal_call_reviews_client on public.coach_goal_call_reviews(client_id,coach_id,status);
create index coach_goal_change_receipts_client on public.coach_goal_change_receipts(client_id,coach_id,created_at desc);
alter table public.coach_roadmap_versions enable row level security;
alter table public.coach_goal_call_reviews enable row level security;
alter table public.coach_goal_change_receipts enable row level security;
revoke all on public.coach_roadmap_versions,public.coach_goal_call_reviews,public.coach_goal_change_receipts from public,anon,authenticated;
grant select on public.coach_roadmap_versions,public.coach_goal_call_reviews,public.coach_goal_change_receipts to authenticated;
grant insert,update on public.coach_goal_call_reviews to authenticated;
grant insert on public.coach_goal_change_receipts to authenticated;
do $$ declare t text;begin foreach t in array array['coach_roadmap_versions','coach_goal_call_reviews','coach_goal_change_receipts'] loop
 execute format('create policy assigned_record_coach on public.%I for all to authenticated using(coach_id=(select auth.uid()) and (select private.is_coach()) and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null)) with check(coach_id=(select auth.uid()) and (select private.is_coach()) and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null and c.status in(''active'',''ending'')))',t);
end loop;end $$;

create function private.roadmap_call_hash(e public.coaching_recording_events) returns text language sql immutable security invoker set search_path='' as $$
 select md5(jsonb_build_array(e.client_id,e.coach_id,e.source_url,e.occurred_at at time zone 'UTC',e.matching_status,e.excluded_at at time zone 'UTC',e.summary,e.action_items,e.analysis)::text);
$$;
revoke all on function private.roadmap_call_hash(public.coaching_recording_events) from public,anon;
grant execute on function private.roadmap_call_hash(public.coaching_recording_events) to authenticated;

create function private.capture_roadmap_version() returns trigger language plpgsql security definer set search_path='' as $$
declare why text:='Manual roadmap edit';eid uuid;begin
 if auth.uid() is not null and (auth.uid()<>new.coach_id or not coalesce(private.is_coach(),false)) then raise exception 'Assigned coach required';end if;
 if not exists(select 1 from public.clients c where c.id=new.client_id and c.coach_id=new.coach_id and c.deleted_at is null) then raise exception 'Roadmap assignment changed';end if;
 if tg_op='UPDATE' then
  if new.client_id<>old.client_id or new.coach_id<>old.coach_id or new.revision<>old.revision+1 then raise exception 'Roadmap identity is fixed and each save requires a new revision';end if;
  insert into public.coach_roadmap_versions(client_id,coach_id,revision,payload,changed_at,actor_id,reason)
  values(old.client_id,old.coach_id,old.revision,old.payload,old.updated_at,null,'Previously saved roadmap; earlier change source not recorded') on conflict do nothing;
 end if;
 if new.payload->'last_goal_change' is not null and (tg_op='INSERT' or new.payload->'last_goal_change' is distinct from old.payload->'last_goal_change') then
  begin eid:=(new.payload->'last_goal_change'->>'event_id')::uuid;exception when others then eid:=null;end;
  if exists(select 1 from public.coaching_recording_events e where e.id=eid and e.client_id=new.client_id and e.coach_id=new.coach_id and e.matching_status='matched' and e.excluded_at is null and private.roadmap_call_hash(e)=new.payload->'last_goal_change'->>'source_hash') then
   why:=left(coalesce(new.payload->'last_goal_change'->>'reason','Call-linked goal review'),2000);
  else eid:=null;end if;
 end if;
 insert into public.coach_roadmap_versions(client_id,coach_id,revision,payload,changed_at,actor_id,reason,source_event_id)
 values(new.client_id,new.coach_id,new.revision,new.payload,new.updated_at,auth.uid(),why,eid) on conflict do nothing;
 return new;
end $$;
revoke all on function private.capture_roadmap_version() from public,anon,authenticated;
create trigger roadmap_version_history after insert or update on public.coach_client_roadmaps for each row execute function private.capture_roadmap_version();

create function private.queue_roadmap_call_review() returns trigger language plpgsql security definer set search_path='' as $$
declare h text;begin
 if new.client_id is null or new.matching_status<>'matched' or new.excluded_at is not null or new.processing_status='failed' then return new;end if;
 if not exists(select 1 from public.clients c join public.profiles p on p.id=c.profile_id where c.id=new.client_id and c.coach_id=new.coach_id and c.deleted_at is null and c.archived_at is null and c.status in('active','ending') and p.role='client' and p.id<>new.coach_id and c.display_name !~* '(demo|test data)') then return new;end if;
 h:=private.roadmap_call_hash(new);
 -- Older imported recordings remain context, not falsely labelled new decisions.
 if exists(select 1 from public.coach_client_roadmaps r where r.client_id=new.client_id and r.coach_id=new.coach_id and r.created_at>new.occurred_at)
  and not exists(select 1 from public.coach_goal_call_reviews q where q.event_id=new.id and q.coach_id=new.coach_id) then return new;end if;
 insert into public.coach_goal_call_reviews(client_id,coach_id,event_id,source_hash) values(new.client_id,new.coach_id,new.id,h)
 on conflict(event_id,coach_id) do update set client_id=excluded.client_id,source_hash=excluded.source_hash,status='pending',reviewed_at=null
 where public.coach_goal_call_reviews.source_hash<>excluded.source_hash;
 return new;
end $$;
revoke all on function private.queue_roadmap_call_review() from public,anon,authenticated;
create trigger recording_roadmap_review after insert or update of client_id,coach_id,source_url,occurred_at,matching_status,processing_status,summary,action_items,analysis,excluded_at on public.coaching_recording_events for each row execute function private.queue_roadmap_call_review();

create function public.roadmap_call_context(p_client uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(private.is_coach(),false) or not exists(select 1 from public.clients c where c.id=p_client and c.coach_id=auth.uid() and c.deleted_at is null and c.status in('active','ending')) then raise exception 'Assigned coach required' using errcode='42501';end if;
 return jsonb_build_object('client_id',p_client,'coach_id',auth.uid(),'events',(select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at desc),'[]') from(
  select e.id,e.client_id,e.coach_id,e.occurred_at,e.source,e.source_url,e.source_title,left(coalesce(e.summary,''),14000) summary,e.action_items,e.analysis->'follow_through'->'decisions' decisions,e.processing_status,
   private.roadmap_call_hash(e) source_hash,coalesce(q.status,'context') review_status,
   exists(select 1 from public.coach_client_roadmaps r where r.client_id=p_client and r.coach_id=auth.uid() and r.created_at>e.occurred_at) historical_context
  from public.coaching_recording_events e left join public.coach_goal_call_reviews q on q.event_id=e.id and q.coach_id=auth.uid()
  where e.client_id=p_client and e.coach_id=auth.uid() and e.matching_status='matched' and e.excluded_at is null order by e.occurred_at desc limit 12)x),
 'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by v.revision desc),'[]') from(select client_id,coach_id,revision,changed_at,reason,source_event_id from public.coach_roadmap_versions where client_id=p_client and coach_id=auth.uid() order by revision desc limit 25)v));
end $$;
revoke all on function public.roadmap_call_context(uuid) from public,anon;
grant execute on function public.roadmap_call_context(uuid) to authenticated;

create function public.roadmap_goal_history(p_client uuid,p_goal text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(private.is_coach(),false) or not exists(select 1 from public.clients where id=p_client and coach_id=auth.uid() and deleted_at is null) then raise exception 'Assigned coach required' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.revision desc),'[]') from(select v.client_id,v.coach_id,v.revision,v.changed_at,v.reason,v.source_event_id,(select g from jsonb_array_elements(v.payload->'goals') g where g->>'id'=p_goal limit 1) goal from public.coach_roadmap_versions v where v.client_id=p_client and v.coach_id=auth.uid() order by v.revision desc limit 25)x);
end $$;
revoke all on function public.roadmap_goal_history(uuid,text) from public,anon;
grant execute on function public.roadmap_goal_history(uuid,text) to authenticated;

create function public.review_roadmap_call_goal(p_client uuid,p_event uuid,p_goal text,p_expected_revision integer,p_source_hash text,p_action text,p_change jsonb,p_reason text,p_confirm boolean default false) returns public.coach_client_roadmaps
language plpgsql security invoker set search_path='' as $$
declare e public.coaching_recording_events;r public.coach_client_roadmaps;before_goal jsonb;after_goal jsonb;payload jsonb;goals jsonb;gid text;k text;review_date date;clean_change jsonb:='{}';begin
 if auth.uid() is null or not coalesce(private.is_coach(),false) then raise exception 'Assigned coach required' using errcode='42501';end if;
 select * into r from public.coach_client_roadmaps where client_id=p_client and coach_id=auth.uid() for update;
 if r.client_id is null or r.revision<>p_expected_revision then raise exception 'Roadmap changed. Keep your draft and refresh before saving.' using errcode='40001';end if;
 -- Recording evidence is read-only for coaches. Compare the captured evidence hash;
 -- provider updates reopen the queue rather than granting coaches recorder writes.
 select * into e from public.coaching_recording_events where id=p_event and client_id=p_client and coach_id=auth.uid() and matching_status='matched' and excluded_at is null;
 if e.id is null or e.processing_status='failed' or (length(coalesce(e.summary,''))=0 and jsonb_array_length(coalesce(e.action_items,'[]'))=0) then raise exception 'Verified call evidence is not available';end if;
 if private.roadmap_call_hash(e) is distinct from p_source_hash then raise exception 'Call evidence changed. Refresh and review it again.' using errcode='40001';end if;
 if exists(select 1 from public.coach_goal_change_receipts where event_id=e.id and coach_id=auth.uid() and goal_id=p_goal and source_hash=p_source_hash) then raise exception 'This goal was already reviewed against this call. Refresh the history before amending it.';end if;
 if p_action is null or p_action not in('continue','progress','simplify','pause','replace','complete') or length(trim(coalesce(p_reason,''))) not between 10 and 2000 or jsonb_typeof(p_change) is distinct from 'object' then raise exception 'Choose a decision and explain the source-based reason';end if;
 select g into before_goal from jsonb_array_elements(r.payload->'goals')g where g->>'id'=p_goal;
 if before_goal is null then raise exception 'Choose a current saved goal';end if;
 foreach k in array array['title','baseline','target','success_measure','weekly_actions','review_on'] loop
  if jsonb_typeof(p_change->k) is distinct from 'string' or length(trim(coalesce(p_change->>k,''))) not between 1 and 1000 or (k='title' and length(p_change->>k)>200) or (k='review_on' and length(p_change->>k)<>10) then raise exception 'Complete the baseline, specific target, actions, measurement and review date';end if;
  clean_change:=clean_change||jsonb_build_object(k,trim(p_change->>k));
 end loop;
 if p_change->>'review_on' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Valid review date required';end if;
 review_date:=(p_change->>'review_on')::date;
 if p_action in('continue','progress','simplify','replace') and review_date<current_date then raise exception 'Choose a current or future review date';end if;
 if before_goal->>'status'='historical' and p_action in('continue','progress','simplify') then raise exception 'Replace a historical goal explicitly; do not silently reactivate it';end if;
 gid:=case when p_action='replace' then gen_random_uuid()::text else p_goal end;
 after_goal:=before_goal||clean_change||jsonb_build_object('id',gid,'target_status',case when p_confirm then 'agreed' else 'proposed' end,'measure_status',case when p_confirm then 'agreed' else 'proposed' end,
  'time_horizon','Review by '||review_date::text,'target_source','call_review','source_event_id',e.id,'source_url',e.source_url,'source_date',e.occurred_at,'source_ref','Reviewed call · '||(e.occurred_at at time zone 'UTC')::date::text||' · '||coalesce(e.source_title,'Coaching call'),
  'last_decision',jsonb_build_object('action',p_action,'reason',trim(p_reason),'recorded_at',now(),'event_id',e.id,'call_date',e.occurred_at));
 if p_action='pause' then after_goal:=after_goal||jsonb_build_object('status','paused');elsif p_action='complete' then
  if not coalesce(p_confirm,false) then raise exception 'Confirm the completed outcome with the client before marking it complete';end if;
  after_goal:=after_goal||jsonb_build_object('status','complete');
 elsif p_action='replace' then after_goal:=after_goal||jsonb_build_object('status',case when p_confirm then 'agreed' else 'proposed' end,'replaces_goal_id',p_goal);
 else after_goal:=after_goal||jsonb_build_object('status',case when p_confirm then 'agreed' else 'proposed' end);end if;
 select jsonb_agg(case when g->>'id'=p_goal then case when p_action='replace' then g||jsonb_build_object('status','historical','superseded_by',gid) else after_goal end else g end order by n) into goals from jsonb_array_elements(r.payload->'goals') with ordinality x(g,n);
 if p_action='replace' then if jsonb_array_length(goals)>=12 then raise exception 'Keep at most 12 goals; archive/reconcile the roadmap first';end if;goals:=goals||jsonb_build_array(after_goal);end if;
 payload:=r.payload||jsonb_build_object('goals',goals,'last_goal_change',jsonb_build_object('event_id',e.id,'source_hash',p_source_hash,'goal_id',gid,'reason',trim(p_reason),'action',p_action,'at',now()));
 r:=public.save_coach_client_roadmap(p_client,p_expected_revision,payload);
 insert into public.coach_goal_change_receipts(client_id,coach_id,event_id,goal_id,source_hash,action,reason,before_goal,after_goal,roadmap_revision)
 values(p_client,auth.uid(),e.id,p_goal,p_source_hash,p_action,trim(p_reason),before_goal,after_goal,r.revision);
 return r;
end $$;
revoke all on function public.review_roadmap_call_goal(uuid,uuid,text,integer,text,text,jsonb,text,boolean) from public,anon;
grant execute on function public.review_roadmap_call_goal(uuid,uuid,text,integer,text,text,jsonb,text,boolean) to authenticated;

create function public.finish_roadmap_call_review(p_client uuid,p_event uuid,p_source_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.coaching_recording_events;begin
 if auth.uid() is null or not coalesce(private.is_coach(),false) then raise exception 'Assigned coach required' using errcode='42501';end if;
 select * into e from public.coaching_recording_events where id=p_event and client_id=p_client and coach_id=auth.uid() and matching_status='matched' and excluded_at is null;
 if e.id is null or e.processing_status='failed' or private.roadmap_call_hash(e) is distinct from p_source_hash then raise exception 'Call evidence changed or is not verified';end if;
 insert into public.coach_goal_call_reviews(client_id,coach_id,event_id,source_hash,status,reviewed_at) values(p_client,auth.uid(),p_event,p_source_hash,'reviewed',now())
 on conflict(event_id,coach_id) do update set source_hash=excluded.source_hash,status='reviewed',reviewed_at=now();
 return jsonb_build_object('client_id',p_client,'coach_id',auth.uid(),'event_id',p_event,'status','reviewed');
end $$;
revoke all on function public.finish_roadmap_call_review(uuid,uuid,text) from public,anon;
grant execute on function public.finish_roadmap_call_review(uuid,uuid,text) to authenticated;

do $$ declare definition text;patched text;begin
 definition:=pg_get_functiondef('private.coaching_recovery_bundle(uuid)'::regprocedure);
 patched:=replace(definition,'''coach_client_roadmaps'')','''coach_client_roadmaps'',''coach_roadmap_versions'',''coach_goal_call_reviews'',''coach_goal_change_receipts'')');
 if patched=definition then raise exception 'Expected private recovery scope not found';end if;execute patched;
end $$;
notify pgrst,'reload schema';

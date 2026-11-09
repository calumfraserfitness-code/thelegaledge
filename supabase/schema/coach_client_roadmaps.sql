-- Private coaching preparation. Deliberately separate from published client goals.
create table public.coach_client_roadmaps (
 client_id uuid not null references public.clients(id) on delete cascade,
 coach_id uuid not null references public.profiles(id),
 revision integer not null check (revision > 0),
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=60000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (client_id,coach_id)
);
alter table public.coach_client_roadmaps enable row level security;
revoke all on public.coach_client_roadmaps from public,anon,authenticated;
grant select,insert,update on public.coach_client_roadmaps to authenticated;
create policy roadmap_assigned_coach on public.coach_client_roadmaps for all to authenticated
 using (coach_id=(select auth.uid()) and (select private.is_coach()) and exists (
  select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null
 ))
 with check (coach_id=(select auth.uid()) and (select private.is_coach()) and exists (
  select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null
  and c.status in ('active','ending') and c.profile_id is distinct from (select auth.uid())
  and c.source_system is distinct from 'coach_health_test'
  and c.display_name !~* '(demo|test data)'
 ));

create or replace function public.save_coach_client_roadmap(p_client uuid,p_expected_revision integer,p_payload jsonb)
 returns public.coach_client_roadmaps language plpgsql security invoker set search_path='' as $$
declare saved public.coach_client_roadmaps; g jsonb; t jsonb;
begin
 if auth.uid() is null or not coalesce(private.is_coach(),false) then raise exception 'Assigned coach access required' using errcode='42501';end if;
 if not exists(select 1 from public.clients c where c.id=p_client and c.coach_id=auth.uid() and c.deleted_at is null
  and c.status in ('active','ending') and c.profile_id is distinct from auth.uid()
  and c.source_system is distinct from 'coach_health_test' and c.display_name !~* '(demo|test data)') then
  raise exception 'An active assigned client is required' using errcode='42501';
 end if;
 if p_expected_revision is null or p_expected_revision<0 or p_payload is null or
  jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>60000 or
  p_payload->>'version' is distinct from '1' or jsonb_typeof(p_payload->'phase') is distinct from 'string' or
  length(trim(p_payload->>'phase')) not between 1 and 500 or
  jsonb_typeof(p_payload->'goals') is distinct from 'array' or jsonb_array_length(p_payload->'goals') not between 1 and 12 or
  jsonb_typeof(p_payload->'trajectory') is distinct from 'array' or jsonb_array_length(p_payload->'trajectory') not between 1 and 6 or
  jsonb_typeof(p_payload->'sources') is distinct from 'array' or jsonb_array_length(p_payload->'sources')>30 then
  raise exception 'Roadmap format is invalid';
 end if;
 foreach g in array array(select value from jsonb_array_elements(p_payload->'goals')) loop
  if jsonb_typeof(g) is distinct from 'object' or length(trim(coalesce(g->>'title',''))) not between 1 and 200 or
   length(coalesce(g->>'detail',''))>4000 or coalesce(g->>'status','') not in ('agreed','proposed','paused','historical','complete') then
   raise exception 'Each goal needs a title and valid agreement status';end if;
 end loop;
 foreach t in array array(select value from jsonb_array_elements(p_payload->'trajectory')) loop
  if jsonb_typeof(t) is distinct from 'object' or length(trim(coalesce(t->>'label',''))) not between 1 and 200 or
   length(coalesce(t->>'detail',''))>5000 then raise exception 'Review horizon is invalid';end if;
 end loop;
 if p_expected_revision=0 then
  insert into public.coach_client_roadmaps(client_id,coach_id,revision,payload) values(p_client,auth.uid(),1,p_payload)
  on conflict (client_id,coach_id) do nothing returning * into saved;
 else
  update public.coach_client_roadmaps set payload=p_payload,revision=revision+1,updated_at=now()
   where client_id=p_client and coach_id=auth.uid() and revision=p_expected_revision returning * into saved;
 end if;
 if saved.client_id is null then raise exception 'Roadmap changed elsewhere. Keep your draft, reload the saved version and reconcile before saving.' using errcode='40001';end if;
 return saved;
end $$;
revoke all on function public.save_coach_client_roadmap(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_coach_client_roadmap(uuid,integer,jsonb) to authenticated;

-- Existing recovery exports enumerate client tables. Private drafts additionally
-- need current record-coach ownership, including after client reassignment.
do $$ declare definition text;patched text;begin
 definition:=pg_get_functiondef('private.coaching_recovery_bundle(uuid)'::regprocedure);
 patched:=replace(definition,'''coach_weekly_recap_drafts'')','''coach_weekly_recap_drafts'',''coach_client_roadmaps'')');
 if patched=definition then raise exception 'Expected private recovery scope was not found';end if;
 execute patched;
end $$;
notify pgrst,'reload schema';

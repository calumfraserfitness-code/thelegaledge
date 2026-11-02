-- Private review drafts; no client-facing publication or notification trigger.
create table public.coach_review_briefs(
 id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id) on delete cascade,
 coach_id uuid not null references public.profiles(id),payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 context jsonb not null check(jsonb_typeof(context)='object'),model text not null,
 status text not null default 'generating' check(status in('generating','draft','failed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index coach_review_brief_client_date on public.coach_review_briefs(client_id,coach_id,created_at desc);
alter table public.coach_review_briefs enable row level security;
revoke all on public.coach_review_briefs from public,anon,authenticated;
grant select,insert,update on public.coach_review_briefs to authenticated;
grant all on public.coach_review_briefs to service_role;
create policy coach_review_brief_owner on public.coach_review_briefs for all to authenticated
 using(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null))
 with check(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()) and c.deleted_at is null));
create function private.stamp_coach_review_brief() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.client_id is distinct from old.client_id or new.coach_id is distinct from old.coach_id or new.context is distinct from old.context or new.model is distinct from old.model or new.created_at is distinct from old.created_at then raise exception 'The source snapshot and draft owner cannot be changed.';end if;
 if old.status<>'generating' and new.status is distinct from old.status then raise exception 'Create a fresh brief to generate again.';end if;
 new.updated_at=now();return new;
end $$;
revoke all on function private.stamp_coach_review_brief() from public,anon,authenticated;
create trigger stamp_coach_review_brief before update on public.coach_review_briefs for each row execute function private.stamp_coach_review_brief();
create function public.reserve_coach_brief(p_client uuid,p_context jsonb,p_model text) returns public.coach_review_briefs language plpgsql security invoker set search_path='' as $$
declare result public.coach_review_briefs;
begin
 if auth.uid() is null or not private.is_coach() or not exists(select 1 from public.clients c where c.id=p_client and c.coach_id=auth.uid() and c.deleted_at is null) then raise exception 'Assigned coach access required.';end if;
 if jsonb_typeof(p_context)<>'object' or octet_length(p_context::text)>100000 or length(p_model) not between 1 and 100 then raise exception 'Invalid private brief context.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_client::text,0));
 if exists(select 1 from public.coach_review_briefs b where b.coach_id=auth.uid() and b.client_id=p_client and b.created_at>now()-interval '60 seconds') then raise exception 'Please wait one minute before generating another brief.';end if;
 insert into public.coach_review_briefs(client_id,coach_id,context,model) values(p_client,auth.uid(),p_context,p_model) returning * into result;return result;
end $$;
revoke all on function public.reserve_coach_brief(uuid,jsonb,text) from public,anon;
grant execute on function public.reserve_coach_brief(uuid,jsonb,text) to authenticated;

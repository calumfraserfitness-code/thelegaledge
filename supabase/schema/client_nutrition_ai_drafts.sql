create table public.client_nutrition_ai_drafts (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id) on delete cascade,
 coach_id uuid not null references public.profiles(id),
 source_onboarding_id uuid not null references public.onboarding_responses(id),
 source_fingerprint text not null,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 requested_targets jsonb not null,
 review_notes jsonb not null default '[]'::jsonb,
 status text not null default 'draft' check(status in ('draft','applied')),
 apply_result jsonb, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), applied_at timestamptz
);
create index nutrition_ai_draft_client on public.client_nutrition_ai_drafts(client_id,created_at desc);
alter table public.client_nutrition_ai_drafts enable row level security;
revoke all on public.client_nutrition_ai_drafts from public,anon,authenticated;
grant select,insert,update on public.client_nutrition_ai_drafts to authenticated;
create policy nutrition_ai_draft_coach on public.client_nutrition_ai_drafts for all to authenticated
 using(coach_id=auth.uid() and private.is_coach() and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=auth.uid() and c.deleted_at is null))
 with check(coach_id=auth.uid() and private.is_coach() and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=auth.uid() and c.deleted_at is null));

create function public.nutrition_ai_intake_fingerprint(p_record uuid) returns text
language sql stable security invoker set search_path='' as $$
 select md5(r.responses::text) from public.onboarding_responses r join public.clients c on c.id=r.client_id
 where r.id=p_record and c.coach_id=auth.uid() and c.deleted_at is null and private.is_coach();
$$;
revoke all on function public.nutrition_ai_intake_fingerprint(uuid) from public,anon;
grant execute on function public.nutrition_ai_intake_fingerprint(uuid) to authenticated;

create function public.apply_client_ai_nutrition_draft(p_draft uuid,p_expected timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d public.client_nutrition_ai_drafts; result jsonb;
begin
 select * into d from public.client_nutrition_ai_drafts where id=p_draft and coach_id=auth.uid() for update;
 if not found or not private.is_coach() then raise exception 'Assigned coach access required' using errcode='42501';end if;
 if d.status='applied' then return d.apply_result;end if;
 if not exists(select 1 from public.onboarding_responses r where r.id=d.source_onboarding_id and r.client_id=d.client_id) then raise exception 'Draft source does not match this client';end if;
 if d.updated_at is distinct from p_expected then raise exception 'This draft changed in another window. Reload it before applying.';end if;
 if public.nutrition_ai_intake_fingerprint(d.source_onboarding_id) is distinct from d.source_fingerprint
 or exists(select 1 from public.onboarding_responses r where r.client_id=d.client_id and r.version>(select version from public.onboarding_responses where id=d.source_onboarding_id)) then
  raise exception 'The onboarding answers changed. Generate a fresh draft before applying.';
 end if;
 if exists(select 1 from public.clients c cross join lateral jsonb_array_elements(c.nutrition_target_ranges) r where c.id=d.client_id and r->>'start_date'<=current_date::text and r->>'end_date'>=current_date::text) and (d.requested_targets->>'calories')::numeric is distinct from (select calorie_goal from public.clients where id=d.client_id) then
  raise exception 'This client has a temporary dated calorie range. Generate the repeatable menu using their base calorie target; review temporary weekday portions separately.';
 end if;
 if exists(select 1 from public.onboarding_journeys j where j.client_id=d.client_id and j.screening_status='needs_review') then
  raise exception 'Record the flagged health-screen review before applying this menu.';
 end if;
 result:=public.import_client_nutrition(d.client_id,d.payload);
 update public.client_nutrition_ai_drafts set status='applied',apply_result=result,applied_at=now(),updated_at=now() where id=d.id;
 return result;
end $$;
revoke all on function public.apply_client_ai_nutrition_draft(uuid,timestamptz) from public,anon;
grant execute on function public.apply_client_ai_nutrition_draft(uuid,timestamptz) to authenticated;

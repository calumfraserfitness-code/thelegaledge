alter table public.clients
  add column if not exists onboarding_status text not null default 'complete'
    check (onboarding_status in ('pending_legal','pending_onboarding','complete')),
  add column if not exists plan_status text not null default 'published'
    check (plan_status in ('awaiting_onboarding','coach_building','published')),
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists plan_published_at timestamptz;

alter table public.legal_consents
  add column if not exists consent_type text,
  add column if not exists document_name text,
  add column if not exists document_version text,
  add column if not exists accepted_at timestamptz,
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists visible_content text;

drop policy if exists legal_access on public.legal_consents;
create policy legal_access on public.legal_consents for select to authenticated
  using ((select private.can_access_client(client_id)));
create policy legal_client_insert on public.legal_consents for insert to authenticated
  with check (exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())));

update public.clients
set onboarding_status='complete', plan_status=case when portal_enabled then 'published' else 'coach_building' end
where source_system is not null;


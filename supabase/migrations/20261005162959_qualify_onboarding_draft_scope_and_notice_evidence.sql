drop policy draft_insert on public.onboarding_drafts;
drop policy draft_update on public.onboarding_drafts;
create policy draft_insert on public.onboarding_drafts for insert to authenticated with check(exists(select 1 from public.clients c join public.onboarding_journeys j on j.client_id=c.id where c.id=onboarding_drafts.client_id and c.profile_id=auth.uid() and j.stage='intake'));
create policy draft_update on public.onboarding_drafts for update to authenticated using(exists(select 1 from public.clients c join public.onboarding_journeys j on j.client_id=c.id where c.id=onboarding_drafts.client_id and c.profile_id=auth.uid() and j.stage='intake')) with check(exists(select 1 from public.clients c join public.onboarding_journeys j on j.client_id=c.id where c.id=onboarding_drafts.client_id and c.profile_id=auth.uid() and j.stage='intake'));
create function private.journey_notice_evidence() returns trigger language plpgsql security definer set search_path='' as $$ declare j public.onboarding_journeys; begin
 select * into j from public.onboarding_journeys where client_id=new.client_id;
 if j.privacy_body is not null then
 if tg_table_name='legal_consents' then
  if new.visible_content is distinct from j.privacy_body or new.document_version is distinct from j.privacy_version or new.details->>'health_data_explicit_consent' is distinct from 'true' then raise exception 'Accept the enrolled privacy notice and explicit health-data consent'; end if;
 else
  if new.version<3 then raise exception 'Complete the current coaching profile'; end if;
 end if;end if;return new;end $$;
revoke all on function private.journey_notice_evidence() from public,anon,authenticated;
create trigger journey_notice_evidence before insert or update on public.legal_consents for each row execute function private.journey_notice_evidence();
create trigger journey_notice_evidence before insert or update on public.onboarding_responses for each row execute function private.journey_notice_evidence();
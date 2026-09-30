create or replace function private.is_firm_participant(target_organization_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists (
 select 1 from public.firm_pilots p join public.firm_participants m on m.pilot_id=p.id join public.clients c on c.id=m.client_id
 where p.organization_id=target_organization_id and c.profile_id=(select auth.uid()) and m.status<>'withdrawn');
$$;
revoke all on function private.is_firm_participant(uuid) from public;
grant execute on function private.is_firm_participant(uuid) to authenticated;
drop policy if exists firm_org_participant_read on public.firm_organizations;
create policy firm_org_participant_read on public.firm_organizations for select to authenticated using ((select private.is_firm_participant(firm_organizations.id)));


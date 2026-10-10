-- DELETE ignores WITH CHECK; the previous ALL policy allowed clients to erase reports.
drop policy if exists diagnostics_access on public.diagnostic_reports;
create policy diagnostics_read on public.diagnostic_reports for select to authenticated
  using ((select private.can_access_client(client_id)));
create policy diagnostics_coach_insert on public.diagnostic_reports for insert to authenticated
  with check ((select private.is_coach()) and (select private.can_access_client(client_id)));
create policy diagnostics_coach_update on public.diagnostic_reports for update to authenticated
  using ((select private.is_coach()) and (select private.can_access_client(client_id)))
  with check ((select private.is_coach()) and (select private.can_access_client(client_id)));
create policy diagnostics_coach_delete on public.diagnostic_reports for delete to authenticated
  using ((select private.is_coach()) and (select private.can_access_client(client_id)));


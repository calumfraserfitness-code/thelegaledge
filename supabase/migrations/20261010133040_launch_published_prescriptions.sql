-- Keep coach drafts editable, but prevent clients reading unpublished prescriptions.
-- Restrictive policies also apply if another permissive SELECT policy is added later.
create policy weeks_published_to_clients on public.program_weeks as restrictive for select to authenticated
  using ((select private.is_coach()) or published);
create policy programs_published_to_clients on public.training_programs as restrictive for select to authenticated
  using ((select private.is_coach()) or status <> 'draft');

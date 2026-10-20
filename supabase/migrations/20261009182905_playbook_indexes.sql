-- Cover Playbook foreign-key and scoped lookup paths.
create index if not exists playbook_bookmarks_resource_id_idx on public.playbook_bookmarks(resource_id);
create index if not exists playbook_feedback_resource_id_idx on public.playbook_feedback(resource_id);
create index if not exists playbook_recommendations_coach_id_idx on public.playbook_recommendations(coach_id);
create index if not exists playbook_recommendations_resource_id_idx on public.playbook_recommendations(resource_id);
create index if not exists playbook_revisions_coach_id_idx on public.playbook_revisions(coach_id);
create index if not exists playbook_revisions_resource_id_idx on public.playbook_revisions(resource_id,created_at desc);
create index if not exists playbook_workout_history_option_id_idx on public.playbook_workout_history(option_id);
create index if not exists playbook_workout_history_session_id_idx on public.playbook_workout_history(session_id,active);
create index if not exists playbook_workout_options_coach_id_idx on public.playbook_workout_options(coach_id);
create index if not exists playbook_collections_coach_id_idx on public.playbook_collections(coach_id);
create index if not exists playbook_collection_assignments_coach_id_idx on public.playbook_collection_assignments(coach_id);
create index if not exists playbook_collection_assignments_pilot_id_idx on public.playbook_collection_assignments(pilot_id);
-- Split ALL policies into write-only policies; use one SELECT policy per table.
do $$declare t text;p text;q text;w text;client_q text;begin
 for t,p in select * from(values('playbook_workout_options','options_manage'),('playbook_collections','collections_manage'),('playbook_collection_assignments','collections_assign_manage'))x loop
 select qual,with_check into q,w from pg_policies where schemaname='public' and tablename=t and policyname=p;
 execute format('drop policy %I on public.%I',p,t);
 execute format('create policy %I on public.%I for insert to authenticated with check(%s)',p||'_insert',t,w);
 execute format('create policy %I on public.%I for update to authenticated using(%s) with check(%s)',p||'_update',t,q,w);
 execute format('create policy %I on public.%I for delete to authenticated using(%s)',p||'_delete',t,q);
 if t<>'playbook_workout_options' then
  p=case when t='playbook_collections' then 'collections_client' else 'collections_assign_client' end;
  select qual into client_q from pg_policies where schemaname='public' and tablename=t and policyname=p;
  execute format('alter policy %I on public.%I using((%s) or (%s))',p,t,q,client_q);
 end if;
 end loop;
end$$;
notify pgrst,'reload schema';

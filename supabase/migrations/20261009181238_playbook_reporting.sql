-- Explicit table privileges: do not rely on project-level default grants.
revoke all on public.playbook_revisions from anon,authenticated;
revoke all on public.playbook_bookmarks from anon,authenticated;
revoke all on public.playbook_feedback from anon,authenticated;
revoke all on public.playbook_events from anon,authenticated;
revoke all on public.playbook_recommendations from anon,authenticated;
revoke all on public.playbook_workout_options from anon,authenticated;
revoke all on public.playbook_workout_history from anon,authenticated;
revoke all on public.playbook_collections from anon,authenticated;
revoke all on public.playbook_collection_assignments from anon,authenticated;
revoke all on public.playbook_cohort_consents from anon,authenticated;
grant select on public.playbook_revisions,public.playbook_workout_history to authenticated;
grant select,insert,delete on public.playbook_bookmarks,public.playbook_cohort_consents to authenticated;
grant select,insert on public.playbook_events,public.playbook_feedback to authenticated;
grant update(helpful,comment) on public.playbook_feedback to authenticated;
grant select,insert,delete on public.playbook_recommendations to authenticated;
grant update(dismissed_at) on public.playbook_recommendations to authenticated;
grant select,insert,update,delete on public.playbook_workout_options,public.playbook_collections,public.playbook_collection_assignments to authenticated;
create function public.playbook_coach_engagement() returns table(resource_id uuid,title text,opens bigint,actions bigint,videos bigint,helpful bigint,responses bigint) language sql stable security invoker set search_path='' as $$
 select r.id,r.title,
 (select count(*) from public.playbook_events e where e.resource_id=r.id and e.kind='open' and e.created_at>=now()-interval '30 days'),
 (select count(*) from public.playbook_events e where e.resource_id=r.id and e.kind='action' and e.created_at>=now()-interval '30 days'),
 (select count(*) from public.playbook_events e where e.resource_id=r.id and e.kind='video' and e.created_at>=now()-interval '30 days'),
 (select count(*) from public.playbook_feedback f where f.resource_id=r.id and f.helpful and f.created_at>=now()-interval '30 days'),
 (select count(*) from public.playbook_feedback f where f.resource_id=r.id and f.created_at>=now()-interval '30 days')
 from public.coaching_start_resources r where r.coach_id=(select auth.uid()) and private.is_coach() and not r.archived order by r.title;
$$;
revoke all on function public.playbook_coach_engagement() from public,anon;
grant execute on function public.playbook_coach_engagement() to authenticated;
-- Bookmarks contain foreign keys; feedback stays immutable apart from helpful/comment.
-- Accepted workout history is writable only by scoped acceptance/restoration functions.
notify pgrst,'reload schema';

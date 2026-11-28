-- Assigned-coach-only metadata. Never return credentials, readings or answers.
create or replace function public.coach_client_activity()
returns table(client_id uuid,last_sign_in_at timestamptz,last_workout_at timestamptz,sets_7d bigint,last_checkin_at timestamptz,checkins_7d bigint,last_food_at timestamptz,food_7d bigint)
language plpgsql stable security definer set search_path='' set statement_timeout='8s'
as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='coach') then
  raise exception 'Coach access required' using errcode='42501';
 end if;
 return query
 select c.id,u.last_sign_in_at,w.latest,w.recent,k.latest,k.recent,f.latest,f.recent
 from public.clients c
 left join auth.users u on u.id=c.profile_id
 cross join lateral(select max(l.created_at) latest,count(*) filter(where l.created_at>=now()-interval '7 days') recent from public.exercise_set_logs l where l.client_id=c.id and coalesce(l.source_system,'') not like 'legacy%') w
 cross join lateral(select max(x.submitted_at) latest,count(*) filter(where x.submitted_at>=now()-interval '7 days') recent from public.checkins x where x.client_id=c.id and x.source_system in ('client_weekly_v2','client_weekly_v3')) k
 cross join lateral(select max(x.created_at) latest,count(*) filter(where x.created_at>=now()-interval '7 days') recent from public.client_food_entries x where x.client_id=c.id) f
 where c.coach_id=auth.uid() and c.deleted_at is null and c.status in ('active','ending')
 order by c.id limit 500;
end $$;
revoke all on function public.coach_client_activity() from public,anon;
grant execute on function public.coach_client_activity() to authenticated;
comment on function public.coach_client_activity() is 'Coach-only assigned-client sign-in and non-legacy saved-activity metadata. Not a page-open tracker or proof of who entered a record.';

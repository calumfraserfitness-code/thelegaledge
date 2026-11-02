-- Dated completion receipts inside the existing owner-scoped session record.
-- No historical dates or actors are inferred or backfilled.
create or replace function public.save_session_completion(p_session uuid,p_complete boolean,p_cardio jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.training_sessions%rowtype; c public.clients%rowtype; w public.program_weeks%rowtype;
 d date; stamp timestamptz:=clock_timestamp(); receipt jsonb; meta jsonb; daily boolean; last_done timestamptz; previous_gate text;
begin
 if auth.uid() is null or p_complete is null then raise exception 'Sign in to save completion'; end if;
 select ts.* into s from public.training_sessions ts where ts.id=p_session for update;
 if not found then raise exception 'Session unavailable'; end if;
 select * into w from public.program_weeks where id=s.week_id;
 select * into c from public.clients where id=w.client_id and deleted_at is null;
 if c.id is null or not ((c.profile_id=auth.uid() and c.portal_enabled) or (c.coach_id=auth.uid() and public.is_coach())) then raise exception 'Session unavailable'; end if;
 d:=(stamp at time zone coalesce(nullif(c.timezone,''),'Europe/Dublin'))::date;
 if not w.published or d<w.week_start or d>w.week_start+6 then raise exception 'Open a published current week to record completion'; end if;
 daily:=s.training_type::text in ('mobility','recovery');
 receipt:=jsonb_build_object('local_date',d,'saved_at',stamp,'completed',p_complete,'actor_id',auth.uid(),'actor_role',case when c.profile_id=auth.uid() then 'client' else 'coach' end,'kind',case when daily then 'practice' else 'session' end);
 meta:=coalesce(s.source_metadata,'{}'::jsonb);
 if p_cardio is not null then
  if s.training_type::text<>'cardio' or not p_complete or jsonb_typeof(p_cardio)<>'object' or coalesce((p_cardio->>'duration_minutes')::numeric,0) not between 1 and 1440 or coalesce((p_cardio->>'distance_km')::numeric,0) not between 0 and 1000 or coalesce((p_cardio->>'heart_rate')::numeric,100) not between 30 and 240 or coalesce((p_cardio->>'rpe')::numeric,5) not between 1 and 10 then raise exception 'Check cardio duration, distance, heart rate and effort'; end if;
  meta:=meta||jsonb_build_object('cardio_log',jsonb_build_object('activity',left(p_cardio->>'activity',80),'duration_minutes',(p_cardio->>'duration_minutes')::numeric,'distance_km',(p_cardio->>'distance_km')::numeric,'heart_rate',(p_cardio->>'heart_rate')::numeric,'rpe',(p_cardio->>'rpe')::numeric,'notes',left(p_cardio->>'notes',2000),'logged_at',stamp));
 end if;
 if daily then
  if not(meta ? 'practice_baseline') then meta:=meta||jsonb_build_object('practice_baseline',jsonb_build_object('status',s.status,'completed_at',s.completed_at)); end if;
  meta:=jsonb_set(meta,'{practice_days}',coalesce(meta->'practice_days','{}'::jsonb)||jsonb_build_object(d::text,receipt),true);
  select max((value->>'saved_at')::timestamptz) into last_done from jsonb_each(meta->'practice_days') where value->>'completed'='true';
  if last_done is null and meta#>>'{practice_baseline,status}'='completed' then last_done:=(meta#>>'{practice_baseline,completed_at}')::timestamptz; end if;
 else last_done:=case when p_complete then stamp else null end;
 end if;
 meta:=meta||jsonb_build_object('completion_receipt',receipt);
 previous_gate:=current_setting('legal_edge.completion_write',true);
 perform set_config('legal_edge.completion_write',s.id::text||':'||auth.uid()::text,true);
 update public.training_sessions set source_metadata=meta,
  status=case when daily and (last_done is not null or meta#>>'{practice_baseline,status}'='completed') then 'completed'::public.item_status when p_complete then 'completed'::public.item_status else 'planned'::public.item_status end,
  completed_at=last_done where id=s.id returning * into s;
 perform set_config('legal_edge.completion_write',coalesce(previous_gate,''),true);
 return jsonb_build_object('session_id',s.id,'client_id',c.id,'status',s.status,'completed_at',s.completed_at,'source_metadata',s.source_metadata,'receipt',receipt);
end $$;
revoke all on function public.save_session_completion(uuid,boolean,jsonb) from public,anon;
grant execute on function public.save_session_completion(uuid,boolean,jsonb) to authenticated;

-- Disable the unused initial prototype without deleting any records.
do $$begin if to_regprocedure('public.log_session_completion(uuid,boolean)') is not null then execute 'revoke all on function public.log_session_completion(uuid,boolean) from authenticated';end if;end$$;

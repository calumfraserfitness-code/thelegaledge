create or replace function public.save_practice_exercise(p_session uuid,p_exercise uuid,p_complete boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.training_sessions%rowtype;c public.clients%rowtype;w public.program_weeks%rowtype;
 meta jsonb; day_record jsonb; exercise_record jsonb; exercise_name text; ids uuid[]; d date; stamp timestamptz:=clock_timestamp(); gate text; all_done boolean; result jsonb;
begin
 if auth.uid() is null or p_complete is null then raise exception 'Sign in to save practice';end if;
 select * into s from public.training_sessions where id=p_session for update;
 if not found or s.training_type::text not in ('mobility','recovery') then raise exception 'Practice session unavailable';end if;
 select * into w from public.program_weeks where id=s.week_id;select * into c from public.clients where id=w.client_id and deleted_at is null;
 if c.id is null or not((c.profile_id=auth.uid() and c.portal_enabled) or(c.coach_id=auth.uid() and public.is_coach())) then raise exception 'Practice session unavailable';end if;
 d:=(stamp at time zone coalesce(nullif(c.timezone,''),'Europe/Dublin'))::date;
 if not w.published or d not between w.week_start and w.week_start+6 then raise exception 'Open your current published week';end if;
 if s.programme_day_id is not null then
  select array_agg(e.id) into ids from public.program_exercises e join public.training_program_days td on td.id=e.program_day_id join public.training_programs tp on tp.id=td.program_id where td.id=s.programme_day_id and tp.client_id=c.id;
  select e.name into exercise_name from public.program_exercises e where e.id=p_exercise and e.id=any(ids);
 else
  select array_agg(e.id) into ids from public.exercises e where e.session_id=s.id;
  select e.name into exercise_name from public.exercises e where e.id=p_exercise and e.id=any(ids);
 end if;
 if exercise_name is null then raise exception 'Exercise is not assigned to this session';end if;
 meta:=coalesce(s.source_metadata,'{}'::jsonb);
 if not(meta?'practice_baseline') then meta:=meta||jsonb_build_object('practice_baseline',jsonb_build_object('status',s.status,'completed_at',s.completed_at));end if;
 exercise_record:=jsonb_build_object('exercise_id',p_exercise,'exercise_name',exercise_name,'local_date',d,'saved_at',stamp,'completed',p_complete,'actor_id',auth.uid(),'actor_role',case when c.profile_id=auth.uid() then 'client' else 'coach' end,'kind','practice_exercise');
 day_record:=coalesce(meta#>array['practice_days',d::text],'{}'::jsonb);
 day_record:=day_record||jsonb_build_object('exercises',coalesce(day_record->'exercises','{}'::jsonb)||jsonb_build_object(p_exercise::text,exercise_record));
 select bool_and(coalesce((day_record#>>array['exercises',e::text,'completed'])::boolean,false)) into all_done from unnest(ids) e;
 meta:=jsonb_set(meta,'{practice_days}',coalesce(meta->'practice_days','{}'::jsonb)||jsonb_build_object(d::text,day_record),true)||jsonb_build_object('completion_receipt',exercise_record);
 gate:=current_setting('legal_edge.completion_write',true);perform set_config('legal_edge.completion_write',s.id::text||':'||auth.uid()::text,true);
 update public.training_sessions set source_metadata=meta where id=s.id;
 perform set_config('legal_edge.completion_write',coalesce(gate,''),true);
 result:=public.save_session_completion(s.id,all_done);
 return result||jsonb_build_object('exercise_receipt',exercise_record);
end $$;
revoke all on function public.save_practice_exercise(uuid,uuid,boolean) from public,anon;
grant execute on function public.save_practice_exercise(uuid,uuid,boolean) to authenticated;

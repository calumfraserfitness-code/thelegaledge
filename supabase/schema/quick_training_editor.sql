create or replace function public.save_training_day_editor(p_day uuid,p_title text,p_exercises jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.training_program_days;p public.training_programs;e jsonb;eid uuid;rows jsonb;
begin
 select * into d from public.training_program_days where id=p_day for update;
 select * into p from public.training_programs where id=d.program_id;
 if not private.is_coach() or not exists(select 1 from public.clients c where c.id=p.client_id and c.coach_id=auth.uid() and c.deleted_at is null) then raise exception 'Assigned coach required' using errcode='42501';end if;
 if coalesce(trim(p_title),'')='' or length(p_title)>160 then raise exception 'Add a short workout title';end if;
 if jsonb_typeof(p_exercises) is distinct from 'array' or jsonb_array_length(p_exercises)>100 then raise exception 'Choose up to 100 exercises';end if;
 for e in select value from jsonb_array_elements(p_exercises) loop
  if coalesce(trim(e->>'name'),'')='' or length(e->>'name')>160 then raise exception 'Each exercise needs a name';end if;
  if (e->>'sets') !~ '^[0-9]+$' or (e->>'sets')::int not between 1 and 20 then raise exception 'Sets must be 1–20';end if;
  if length(coalesce(e->>'reps',''))>100 or coalesce(trim(e->>'reps'),'')='' then raise exception 'Add reps or a duration';end if;
  if (e->>'rest_seconds') !~ '^[0-9]+$' or (e->>'rest_seconds')::int not between 0 and 900 then raise exception 'Rest must be 0–900 seconds';end if;
  eid:=nullif(e->>'id','')::uuid;
  if eid is not null then
   update public.program_exercises set name=trim(e->>'name'),sets=(e->>'sets')::int,reps=e->>'reps',rest_seconds=(e->>'rest_seconds')::int where id=eid and program_day_id=p_day;
   if not found then raise exception 'An exercise changed or belongs to another workout. Refresh';end if;
  else
   insert into public.program_exercises(program_day_id,name,sets,reps,rest_seconds,sort_order) values(p_day,trim(e->>'name'),(e->>'sets')::int,e->>'reps',(e->>'rest_seconds')::int,(select coalesce(max(sort_order),-1)+1 from public.program_exercises where program_day_id=p_day));
  end if;
 end loop;
 update public.training_program_days set title=trim(p_title) where id=p_day returning * into d;
 update public.training_sessions s set title=d.title where s.programme_day_id=p_day and s.status='planned' and not exists(select 1 from public.exercise_set_logs l where l.training_session_id=s.id);
 select jsonb_agg(to_jsonb(x) order by x.sort_order) into rows from public.program_exercises x where x.program_day_id=p_day;
 return jsonb_build_object('day',to_jsonb(d),'exercises',coalesce(rows,'[]'::jsonb));
end $$;
revoke all on function public.save_training_day_editor(uuid,text,jsonb) from public,anon;
grant execute on function public.save_training_day_editor(uuid,text,jsonb) to authenticated;

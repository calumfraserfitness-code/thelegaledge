
create or replace function public.import_client_training(target_client_id uuid,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare program_id uuid; day_id uuid; d jsonb; e jsonb; di int:=0; ei int; weekday int; notes text; kind text;
begin
 if not private.is_coach() or not exists(select 1 from public.clients where id=target_client_id and coach_id=(select auth.uid())) then raise exception 'Only the assigned coach can import this programme' using errcode='42501';end if;
 if octet_length(payload::text)>1048576 then raise exception 'Programme JSON must be under 1 MB';end if;
 if coalesce(trim(payload->>'programme_name'),'')='' or length(payload->>'programme_name')>160 then raise exception 'Programme needs a name of 1–160 characters';end if;
 if jsonb_typeof(payload->'days') is distinct from 'array' then raise exception 'Programme days must be a list';end if;
 if jsonb_array_length(payload->'days') not between 1 and 14 then raise exception 'Programme needs 1–14 days';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_client_id::text||'training-import',0));
 select id into program_id from public.training_programs where client_id=target_client_id and status='draft' and source_system='coach_json' and source_json=payload order by created_at desc limit 1;
 if program_id is not null then return jsonb_build_object('programme_id',program_id,'already_imported',true);end if;
 insert into public.training_programs(client_id,name,status,created_by,source_system,source_json) values(target_client_id,trim(payload->>'programme_name'),'draft',auth.uid(),'coach_json',payload) returning id into program_id;
 for d in select value from jsonb_array_elements(payload->'days') loop
  if coalesce(trim(d->>'title'),'')='' or length(d->>'title')>160 then raise exception 'Each training day needs a title of 1–160 characters';end if;
  kind:=coalesce(d->>'training_type','weights');
  if kind not in('weights','resistance','cardio','mobility','recovery') then raise exception 'Invalid training activity type';end if;
  if d?'weekday' and ((d->>'weekday') !~ '^[0-6]$') then raise exception 'weekday must be a whole number from 0 (Monday) to 6 (Sunday)';end if;
  if d?'day_index' and ((d->>'day_index') !~ '^[0-6]$') then raise exception 'day_index must be a whole number from 0 to 6';end if;
  weekday:=coalesce((d->>'weekday')::int,(d->>'day_index')::int,least(di,6));
  notes:=d->>'coach_notes';if coalesce((d->>'optional')::boolean,false) and coalesce(notes,'') !~ '^OPTIONAL / BACKUP' then notes:='OPTIONAL / BACKUP. '||coalesce(notes,'');end if;
  if d?'exercises' and jsonb_typeof(d->'exercises') not in('array','null') then raise exception 'Exercises must be a list';end if;
  if kind in('weights','resistance') and coalesce(jsonb_array_length(nullif(d->'exercises','null'::jsonb)),0)=0 then raise exception 'Strength days need prescribed exercises';end if;
  if coalesce(jsonb_array_length(nullif(d->'exercises','null'::jsonb)),0)>100 then raise exception 'Each day supports up to 100 exercises';end if;
  insert into public.training_program_days(program_id,title,training_type,day_index,coach_notes) values(program_id,trim(d->>'title'),kind::public.training_type,weekday,notes) returning id into day_id;
  ei:=0;
  for e in select value from jsonb_array_elements(coalesce(nullif(d->'exercises','null'::jsonb),'[]'::jsonb)) loop
   if coalesce(trim(e->>'name'),'')='' or length(e->>'name')>160 then raise exception 'Each exercise needs a name of 1–160 characters';end if;
   if e->>'sets' is not null and ((e->>'sets') !~ '^[0-9]+$' or (e->>'sets')::numeric not between 1 and 100) then raise exception 'Exercise sets must be a whole number from 1 to 100';end if;
   if e->>'rest_seconds' is not null and ((e->>'rest_seconds') !~ '^[0-9]+$' or (e->>'rest_seconds')::numeric not between 0 and 7200) then raise exception 'Rest must be whole seconds from 0 to 7200';end if;
   if e->>'rpe' is not null and (e->>'rpe')::numeric not between 0 and 10 then raise exception 'RPE must be from 0 to 10';end if;
   if e->>'rir' is not null and (e->>'rir')::numeric not between 0 and 10 then raise exception 'RIR must be from 0 to 10';end if;
   if nullif(e->>'video_url','') is not null and e->>'video_url' !~ '^https://' then raise exception 'Exercise video must use HTTPS';end if;
   if nullif(e->>'image_url','') is not null and e->>'image_url' !~ '^https://' then raise exception 'Exercise image must use HTTPS';end if;
   insert into public.program_exercises(program_day_id,name,sets,reps,load,rest_seconds,tempo,rpe,rir,superset_group,video_url,image_url,coach_instructions,sort_order)
    values(day_id,trim(e->>'name'),(e->>'sets')::int,e->>'reps',e->>'load',(e->>'rest_seconds')::int,e->>'tempo',(e->>'rpe')::numeric,(e->>'rir')::numeric,e->>'superset_group',nullif(e->>'video_url',''),nullif(e->>'image_url',''),e->>'coach_instructions',ei);
   ei:=ei+1;
  end loop;
  di:=di+1;
 end loop;
 return jsonb_build_object('programme_id',program_id,'days',di,'status','draft','already_imported',false);
end $$;
revoke all on function public.import_client_training(uuid,jsonb) from public,anon;
grant execute on function public.import_client_training(uuid,jsonb) to authenticated;

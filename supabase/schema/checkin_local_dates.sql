CREATE OR REPLACE FUNCTION public.submit_client_checkin(target_client_id uuid, answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c public.checkins%rowtype; p public.progress_entries%rowtype; period date; display_date date; field text; value numeric; client_zone text;
begin
if answers ? 'original_answers' and (jsonb_typeof(answers->'original_answers')<>'object' or octet_length((answers->'original_answers')::text)>16000) then raise exception 'Check-in details are too large or invalid';end if;
if not coalesce(private.can_access_client(target_client_id),false) then raise exception 'Client access required';end if;
client_zone:=coalesce((select client_row.timezone from public.clients client_row where client_row.id=target_client_id and exists(select 1 from pg_catalog.pg_timezone_names z where z.name=client_row.timezone)),'Europe/Dublin');
for field in select unnest(array['energy','sleep','stress','hunger','cravings','workload']) loop value:=(answers->>field)::numeric;if value is not null and (value<1 or value>10) then raise exception 'Ratings must be 1–10';end if;end loop;
for field in select unnest(array['training_adherence','nutrition_adherence']) loop value:=(answers->>field)::numeric;if value is not null and (value<0 or value>100) then raise exception 'Adherence must be 0–100';end if;end loop;
if (answers->>'weight_kg')::numeric<=0 or (answers->>'average_steps')::numeric<0 then raise exception 'Weight must be positive and steps nonnegative';end if;
period:=(answers->>'period_start')::date;
if period is null or extract(isodow from period)<>1 or period>date_trunc('week',now() at time zone client_zone)::date then raise exception 'Choose a current or past Monday';end if;
perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_client_id::text||period::text,0));
select * into c from public.checkins where client_id=target_client_id and period_start=period;
if found then return jsonb_build_object('checkin',to_jsonb(c),'already_submitted',true);end if;
insert into public.checkins(client_id,submitted_at,period_start,week_number,weight_kg,average_steps,training_adherence,nutrition_adherence,energy,sleep,stress,hunger,cravings,workload,sleep_hours,busy_week,next_week_availability,wins,challenges,support_needed,original_answers,source_system)
values(target_client_id,now(),period,(answers->>'week_number')::int,(answers->>'weight_kg')::numeric,(answers->>'average_steps')::int,(answers->>'training_adherence')::int,(answers->>'nutrition_adherence')::int,(answers->>'energy')::int,(answers->>'sleep')::int,(answers->>'stress')::int,(answers->>'hunger')::int,(answers->>'cravings')::int,(answers->>'workload')::int,(answers->>'sleep_hours')::numeric,answers->>'busy_week',answers->>'next_week_availability',answers->>'wins',answers->>'challenges',answers->>'support_needed',coalesce(answers->'original_answers','{}'::jsonb),'client_weekly_v3')returning * into c;
display_date:=(now() at time zone client_zone)::date;
if c.weight_kg is not null or c.average_steps is not null or c.training_adherence is not null or c.nutrition_adherence is not null then
insert into public.progress_entries(client_id,entry_date,weight_kg,steps,training_adherence,nutrition_adherence)
values(target_client_id,display_date,c.weight_kg,c.average_steps,c.training_adherence,c.nutrition_adherence)
on conflict(client_id,entry_date)do update set weight_kg=coalesce(excluded.weight_kg,progress_entries.weight_kg),steps=coalesce(excluded.steps,progress_entries.steps),training_adherence=coalesce(excluded.training_adherence,progress_entries.training_adherence),nutrition_adherence=coalesce(excluded.nutrition_adherence,progress_entries.nutrition_adherence)
returning * into p;end if;
return jsonb_build_object('checkin',to_jsonb(c),'progress',case when p.id is not null then to_jsonb(p) end,'already_submitted',false);
end $function$


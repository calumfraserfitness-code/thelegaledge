-- Additive employer access; employers never receive raw client tables.
create table public.firm_employer_access (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.firm_organizations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, coach_id uuid not null references public.profiles(id),
 display_name text not null, created_at timestamptz not null default now(), unique(organization_id,user_id)
);
alter table public.firm_employer_access enable row level security;
grant select on public.firm_employer_access to authenticated;
grant all on public.firm_employer_access to service_role;
create policy employer_access_read on public.firm_employer_access for select to authenticated using(user_id=(select auth.uid()) or coach_id=(select auth.uid()));
-- Membership writes occur in provision-employer after assigned-coach verification.
create or replace function private.employer_report(target_pilot uuid,target_week date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.firm_pilots; minimum_n integer; result jsonb; enrolled integer; eligible integer; firm_name text;
begin
 select * into p from public.firm_pilots where id=target_pilot;
 if p.id is null or auth.uid() is null or not (p.coach_id=auth.uid() or exists(select 1 from public.firm_employer_access a where a.organization_id=p.organization_id and a.user_id=auth.uid())) then raise exception 'Assigned firm access required' using errcode='42501'; end if;
 if target_week is null or extract(isodow from target_week)<>1 or target_week<(current_date-370) or target_week>current_date then raise exception 'Choose a Monday in the past year';end if;
 minimum_n:=greatest(5,p.minimum_report_count);
 select name into firm_name from public.firm_organizations where id=p.organization_id;
 select count(*) into enrolled from public.firm_participants where pilot_id=p.id and status<>'withdrawn';
 select count(*) into eligible from public.firm_participants m join public.firm_consents consent on consent.participant_id=m.id where m.pilot_id=p.id and m.status<>'withdrawn' and consent.include_weekly_ratings;
 with latest as (
 select distinct on(c.client_id) c.energy,c.sleep,c.stress,c.workload,c.training_adherence,c.nutrition_adherence
 from public.checkins c join public.firm_participants m on m.client_id=c.client_id join public.firm_consents consent on consent.participant_id=m.id and consent.client_id=c.client_id
 where m.pilot_id=p.id and m.status<>'withdrawn' and consent.include_weekly_ratings and c.submitted_at>=consent.accepted_at and c.submitted_at>=m.joined_at
 and (c.period_start=target_week or (c.period_start is null and (c.submitted_at at time zone 'Europe/Dublin')::date>=target_week and (c.submitted_at at time zone 'Europe/Dublin')::date<target_week+7))
 and (p.start_date is null or (c.submitted_at at time zone 'Europe/Dublin')::date>=p.start_date) and (p.end_date is null or (c.submitted_at at time zone 'Europe/Dublin')::date<=p.end_date)
 order by c.client_id,c.submitted_at desc,c.id desc
 ), metrics as (
 select count(*) n,
 count(energy) filter(where energy between 1 and 10) en,avg(energy) filter(where energy between 1 and 10) ea,
 count(sleep) filter(where sleep between 1 and 10) sn,avg(sleep) filter(where sleep between 1 and 10) sa,
 count(stress) filter(where stress between 1 and 10) stn,avg(stress) filter(where stress between 1 and 10) sta,
 count(workload) filter(where workload between 1 and 10) wn,avg(workload) filter(where workload between 1 and 10) wa,
 count(training_adherence) filter(where training_adherence between 0 and 100) tn,avg(training_adherence) filter(where training_adherence between 0 and 100) ta,
 count(nutrition_adherence) filter(where nutrition_adherence between 0 and 100) nn,avg(nutrition_adherence) filter(where nutrition_adherence between 0 and 100) na from latest
 ) select jsonb_build_object('pilot_id',p.id,'pilot_name',p.name,'firm_name',firm_name,'week_start',target_week,'enrolled',enrolled,'eligible',eligible,'minimum_count',minimum_n,
 'respondents',case when n>=minimum_n then n end,'coverage_pct',case when n>=minimum_n and eligible>0 then round(100.0*n/eligible) end,
 'energy',case when en>=minimum_n then round(ea,1) end,'sleep',case when sn>=minimum_n then round(sa,1) end,'stress',case when stn>=minimum_n then round(sta,1) end,'workload',case when wn>=minimum_n then round(wa,1) end,
 'training_adherence',case when tn>=minimum_n then round(ta) end,'nutrition_adherence',case when nn>=minimum_n then round(na) end,'refreshed_at',now()) into result from metrics;
 return result;
end $$;
revoke all on function private.employer_report(uuid,date) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.employer_report(uuid,date) to authenticated;
create function public.employer_weekly_report(target_pilot uuid,target_week date) returns jsonb language sql stable security invoker set search_path='' as $$ select private.employer_report(target_pilot,target_week); $$;
revoke all on function public.employer_weekly_report(uuid,date) from public,anon;grant execute on function public.employer_weekly_report(uuid,date) to authenticated;
create policy employer_pilot_read on public.firm_pilots for select to authenticated using(exists(select 1 from public.firm_employer_access a where a.organization_id=firm_pilots.organization_id and a.user_id=(select auth.uid())));
-- Protect authorization fields: existing own-profile UPDATE policy must not allow role escalation.
revoke update on public.profiles from authenticated;
grant update(full_name,avatar_url,updated_at) on public.profiles to authenticated;

create table public.client_health_ingest_keys (
 id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),provider text not null check(provider in ('apple_health','health_connect')),
 scopes text[] not null check(scopes <@ array['steps','sleep_minutes','weight_kg','resting_heart_rate','consumed_calories','protein_g','carbs_g','fat_g','water_ml']::text[] and cardinality(scopes)>0),
 expires_at timestamptz not null check(expires_at<=created_at+interval '31 days'),created_at timestamptz not null default now(),revoked_at timestamptz,last_received_at timestamptz
);
alter table public.client_health_ingest_keys enable row level security;
grant select,insert on public.client_health_ingest_keys to authenticated;grant update(revoked_at) on public.client_health_ingest_keys to authenticated;grant all on public.client_health_ingest_keys to service_role;
create policy own_ingest_key_read on public.client_health_ingest_keys for select to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())));
create policy own_ingest_key_create on public.client_health_ingest_keys for insert to authenticated with check(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())) and revoked_at is null and last_received_at is null and created_at between now()-interval '1 minute' and now()+interval '1 minute' and expires_at>now());
create policy own_ingest_key_revoke on public.client_health_ingest_keys for update to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid()))) with check(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())) and revoked_at is not null);
alter table public.client_health_daily add column consumed_calories numeric check(consumed_calories>=0), add column protein_g numeric check(protein_g>=0), add column carbs_g numeric check(carbs_g>=0),add column fat_g numeric check(fat_g>=0),add column water_ml numeric check(water_ml>=0);
create function public.store_device_health_rows(key_id uuid,records jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare k public.client_health_ingest_keys; r jsonb; saved integer:=0;
begin
 select * into k from public.client_health_ingest_keys where id=key_id for update;
 if k.id is null or k.revoked_at is not null or k.expires_at<=now() then raise exception 'Device key expired or revoked';end if;
 if k.last_received_at>now()-interval '10 seconds' then raise exception 'Wait before another upload';end if;
 if jsonb_typeof(records)<>'array' or jsonb_array_length(records)>370 then raise exception 'Invalid daily records';end if;
 for r in select * from jsonb_array_elements(records) loop
 if (r->>'date')::date<current_date-370 or (r->>'date')::date>current_date+1 then raise exception 'Date outside supported range';end if;
 if exists(select 1 from jsonb_object_keys(r) field where field<>'date' and not(field=any(k.scopes))) then raise exception 'Metric not permitted by device consent';end if;
 insert into public.client_health_daily(client_id,date,source,source_priority,steps,sleep_minutes,weight_kg,resting_heart_rate,consumed_calories,protein_g,carbs_g,fat_g,water_ml,last_synced_at)
 values(k.client_id,(r->>'date')::date,k.provider,80,(r->>'steps')::integer,(r->>'sleep_minutes')::integer,(r->>'weight_kg')::numeric,(r->>'resting_heart_rate')::numeric,(r->>'consumed_calories')::numeric,(r->>'protein_g')::numeric,(r->>'carbs_g')::numeric,(r->>'fat_g')::numeric,(r->>'water_ml')::numeric,now())
 on conflict(client_id,date,source) do update set steps=coalesce(excluded.steps,client_health_daily.steps),sleep_minutes=coalesce(excluded.sleep_minutes,client_health_daily.sleep_minutes),weight_kg=coalesce(excluded.weight_kg,client_health_daily.weight_kg),resting_heart_rate=coalesce(excluded.resting_heart_rate,client_health_daily.resting_heart_rate),consumed_calories=coalesce(excluded.consumed_calories,client_health_daily.consumed_calories),protein_g=coalesce(excluded.protein_g,client_health_daily.protein_g),carbs_g=coalesce(excluded.carbs_g,client_health_daily.carbs_g),fat_g=coalesce(excluded.fat_g,client_health_daily.fat_g),water_ml=coalesce(excluded.water_ml,client_health_daily.water_ml),last_synced_at=now();saved:=saved+1;
 end loop;
 if saved=0 then raise exception 'No supported permitted health readings';end if;
 update public.client_health_ingest_keys set last_received_at=now() where id=k.id;
 insert into public.client_health_connections(client_id,provider,status,scopes,last_synced_at,error_message) values(k.client_id,k.provider,'connected',array_append(k.scopes,'device_upload'),now(),null) on conflict(client_id,provider) do update set status='connected',scopes=excluded.scopes,last_synced_at=now(),error_message=null;
 return saved;
end $$;
revoke all on function public.store_device_health_rows(uuid,jsonb) from public,anon,authenticated;grant execute on function public.store_device_health_rows(uuid,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.firm_weekly_summary(target_pilot_id uuid, target_week date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare minimum_count integer; result jsonb;
begin
 if not coalesce(private.is_coach(),false) or not exists(select 1 from public.firm_pilots p where p.id=target_pilot_id and p.coach_id=(select auth.uid())) then raise exception 'Assigned coach access required';end if;
 if target_week is null or extract(isodow from target_week)<>1 then raise exception 'Choose a Monday';end if;
 select greatest(5,minimum_report_count) into minimum_count from public.firm_pilots where id=target_pilot_id;
 with latest as (
 select distinct on (c.client_id) c.energy,c.sleep,c.stress,c.client_id
 from public.checkins c join public.firm_participants m on m.client_id=c.client_id
 join public.firm_consents consent on consent.participant_id=m.id and consent.client_id=c.client_id
 join public.firm_pilots p on p.id=m.pilot_id
 where m.pilot_id=target_pilot_id and m.status<>'withdrawn' and consent.include_weekly_ratings
 and (c.period_start is null or c.period_start=target_week)
 and c.submitted_at>=consent.accepted_at and c.submitted_at>=m.joined_at
 and (c.submitted_at at time zone 'Europe/Dublin')::date>=target_week
 and (c.submitted_at at time zone 'Europe/Dublin')::date<target_week+7
 and (p.start_date is null or (c.submitted_at at time zone 'Europe/Dublin')::date>=p.start_date)
 and (p.end_date is null or (c.submitted_at at time zone 'Europe/Dublin')::date<=p.end_date)
 order by c.client_id,c.submitted_at desc,c.id desc
 ), totals as (
 select count(*) as respondents,
 count(*) filter(where energy between 1 and 10) as energy_n,avg(energy) filter(where energy between 1 and 10) as energy_avg,
 count(*) filter(where sleep between 1 and 10) as sleep_n,avg(sleep) filter(where sleep between 1 and 10) as sleep_avg,
 count(*) filter(where stress between 1 and 10) as stress_n,avg(stress) filter(where stress between 1 and 10) as stress_avg from latest)
 select jsonb_build_object('week_start',target_week,'respondents',respondents,'minimum_count',minimum_count,
 'energy_count',energy_n,'energy',case when energy_n>=minimum_count then round(energy_avg,1) end,
 'sleep_count',sleep_n,'sleep',case when sleep_n>=minimum_count then round(sleep_avg,1) end,
 'stress_count',stress_n,'stress',case when stress_n>=minimum_count then round(stress_avg,1) end) into result from totals;
 return result;
end $function$

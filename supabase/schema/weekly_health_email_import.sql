-- Forwarded weekly summaries stay separate from daily device readings and weigh-ins.
create table public.client_health_report_senders (
 client_id uuid not null references public.clients(id) on delete cascade,
 coach_id uuid not null references public.profiles(id),email text not null check(email=lower(trim(email))),
 primary key(coach_id,email)
);
alter table public.client_health_report_senders enable row level security;
create policy assigned_coach_report_sender on public.client_health_report_senders for all to authenticated using(coach_id=auth.uid() and private.is_coach() and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=auth.uid())) with check(coach_id=auth.uid() and private.is_coach() and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=auth.uid()));
create table public.client_health_email_imports (
 coach_id uuid not null references public.profiles(id),mailbox text not null,message_id text not null,
 client_id uuid not null references public.clients(id),file_id uuid not null references public.client_files(id),
 imported_at timestamptz not null default now(),primary key(coach_id,mailbox,message_id)
);
alter table public.client_health_email_imports enable row level security;
create policy assigned_coach_email_import on public.client_health_email_imports for select to authenticated using(coach_id=auth.uid() and private.is_coach());
grant all on public.client_health_report_senders,public.client_health_email_imports to service_role;
grant select,insert,update,delete on public.client_health_report_senders to authenticated;
grant select on public.client_health_email_imports to authenticated;
create or replace function public.import_weekly_health_email(p_coach uuid,p_mailbox text,p_message_id text,p_sender text,p_report jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare target uuid; saved uuid; prior_notes jsonb; starts date; ends date; field text; value numeric; low numeric; high numeric; data jsonb;
begin
 if p_mailbox is null or length(p_mailbox)>254 or p_message_id is null or length(p_message_id) not between 1 and 200 then raise exception 'Valid mailbox and message ID required';end if;
 select s.client_id into target from public.client_health_report_senders s join public.clients c on c.id=s.client_id join public.profiles p on p.id=p_coach where s.coach_id=p_coach and s.email=lower(trim(p_sender)) and c.coach_id=p_coach and c.deleted_at is null and c.profile_id is not null and c.status='active' and p.role='coach';
 if target is null then raise exception 'No active client matches this verified report sender';end if;
 if jsonb_typeof(p_report)<>'object' or jsonb_typeof(p_report->'metrics') is distinct from 'object' or length(coalesce(p_report->>'report_text','')) not between 1 and 20000 or coalesce(p_report->>'provider','') not in ('Google / Fitbit','Apple Health / Apple Watch','Garmin','Other wearable') then raise exception 'Readable report and provider required';end if;
 starts:=(p_report->>'period_start')::date;ends:=(p_report->>'period_end')::date;
 if starts is null or ends is null or starts>ends or ends>current_date or ends-starts>31 then raise exception 'An explicit completed report period is required';end if;
 for field,value,low,high in select k,(p_report->'metrics'->>k)::numeric,min_v,max_v from (values ('average_steps',0,150000),('sleep_hours',0,24),('resting_heart_rate',20,250),('weight_kg',20,400),('workouts',0,35),('total_steps',0,4650000),('active_zone_minutes',0,10080),('calories_burned',0,15000),('distance_km',0,3000)) v(k,min_v,max_v) loop
  if value is not null and (value<low or value>high or value::text='NaN' or (field='workouts' and value<>trunc(value))) then raise exception 'Invalid weekly metric: %',field;end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_report->'metrics') k where k<>all(array['average_steps','sleep_hours','resting_heart_rate','weight_kg','workouts','total_steps','active_zone_minutes','calories_burned','distance_km'])) then raise exception 'Unknown metric';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target::text||starts::text||ends::text,0));
 select file_id into saved from public.client_health_email_imports where coach_id=p_coach and mailbox=p_mailbox and message_id=p_message_id;
 if saved is not null then return saved;end if;
 select f.id,f.notes::jsonb into saved,prior_notes from public.client_files f where f.client_id=target and f.file_type='health_weekly_report' and f.notes::jsonb->>'provider'=p_report->>'provider' and f.notes::jsonb->>'period_start'=starts::text and f.notes::jsonb->>'period_end'=ends::text limit 1;
 if saved is not null and prior_notes->'metrics' is distinct from p_report->'metrics' then raise exception 'Different figures already exist for this period; coach review required';end if;
 if saved is null then
  data:=jsonb_build_object('version',1,'provider',p_report->>'provider','period_start',starts,'period_end',ends,'checkin_week',date_trunc('week',ends::timestamp)::date,'metrics',p_report->'metrics','report_text',p_report->>'report_text','source_system','forwarded_health_email','review_status','imported','imported_at',now());
  insert into public.client_files(client_id,uploaded_by,file_type,storage_path,original_name,mime_type,notes) values(target,p_coach,'health_weekly_report','','Weekly health report '||starts::text||' to '||ends::text,'text/plain',data::text) returning id into saved;
 end if;
 insert into public.client_health_email_imports(coach_id,mailbox,message_id,client_id,file_id) values(p_coach,p_mailbox,p_message_id,target,saved);
 return saved;
end $$;
revoke all on function public.import_weekly_health_email(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.import_weekly_health_email(uuid,text,text,text,jsonb) to service_role;

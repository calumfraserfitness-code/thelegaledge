alter table public.clients add column if not exists checkin_email_enabled boolean not null default true;
alter table public.clients add column if not exists call_email_enabled boolean not null default true;
create table public.client_email_reminders (
 id uuid primary key default gen_random_uuid(),coach_id uuid not null references public.profiles(id),client_id uuid not null references public.clients(id),
 job_key text not null unique,kind text not null check(kind in ('checkin','call')),recipient text not null,client_name text not null,timezone text not null,
 due_at timestamptz not null,call_id uuid references public.client_coaching_calls(id),status text not null default 'claimed' check(status in ('claimed','sent','failed','uncertain')),
 claimed_at timestamptz not null default now(),sent_at timestamptz,provider_message_id text,last_error text
);
alter table public.client_email_reminders enable row level security;
create policy coach_reminder_read on public.client_email_reminders for select to authenticated using(coach_id=auth.uid() and private.is_coach());
grant select on public.client_email_reminders to authenticated;
grant all on public.client_email_reminders to service_role;
create or replace function public.claim_coaching_email_reminders(p_coach uuid,p_now timestamptz default now())
returns setof public.client_email_reminders language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=p_coach and role='coach') then raise exception 'Coach required';end if;
 return query with eligible as (
 select c.*,p.email recipient_email,p_now at time zone c.timezone local_now from public.clients c join public.profiles p on p.id=c.profile_id and p.role='client' join pg_catalog.pg_timezone_names z on z.name=c.timezone
 where c.coach_id=p_coach and c.status='active' and c.deleted_at is null and c.portal_enabled and c.onboarding_status='complete' and c.source_system is distinct from 'coach_health_test' and c.source_system is distinct from 'coach_test_account' and lower(c.email)=lower(p.email)
 ), candidates as (
 select c.id client_id,'checkin:'||c.id::text||':'||date_trunc('week',c.local_now)::date::text job_key,'checkin' kind,c.recipient_email recipient,c.display_name client_name,c.timezone,(c.local_now::date+time '09:00') at time zone c.timezone due_at,null::uuid call_id
 from eligible c where c.weekly_checkin_enabled and c.checkin_email_enabled and c.checkin_day=extract(dow from c.local_now) and extract(hour from c.local_now)=9 and not exists(select 1 from public.checkins k where k.client_id=c.id and k.period_start=date_trunc('week',c.local_now)::date)
 union all
 select c.id,'call:'||a.id::text||':'||a.scheduled_at::text,'call',c.recipient_email,c.display_name,c.timezone,a.scheduled_at,a.id
 from eligible c join public.client_coaching_calls a on a.client_id=c.id where c.call_email_enabled and a.status='scheduled' and a.scheduled_at>p_now+interval '23 hours' and a.scheduled_at<=p_now+interval '24 hours'
 ) insert into public.client_email_reminders(coach_id,client_id,job_key,kind,recipient,client_name,timezone,due_at,call_id)
 select p_coach,c.client_id,c.job_key,c.kind,c.recipient,c.client_name,c.timezone,c.due_at,c.call_id from candidates c on conflict(job_key) do nothing returning *;
end $$;
revoke all on function public.claim_coaching_email_reminders(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_coaching_email_reminders(uuid,timestamptz) to service_role;

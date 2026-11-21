-- Metadata only. Private definer is required for private backup metadata, never its payload.
create or replace function private.coach_operational_status()
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='8s'
as $$
declare
  owner uuid := auth.uid(); ids uuid[]; result jsonb;
begin
  if owner is null or not exists(select 1 from public.profiles p where p.id=owner and p.role='coach') then
    raise exception 'Coach access required' using errcode='42501';
  end if;
  select coalesce(array_agg(c.id),array[]::uuid[]) into ids from (
    select id from public.clients where coach_id=owner and deleted_at is null
      and status in ('active','ending') order by id limit 2001
  ) c;
  if cardinality(ids)>2000 then raise exception 'Status scope exceeds limit' using errcode='54000'; end if;
  with jobs as materialized (
    select status,attempts,delivered_at from public.coaching_notification_jobs
    where recipient_id=owner and created_at>=now()-interval '7 days'
    order by created_at desc limit 1001
  ), devices as materialized (
    select id from public.coaching_push_subscriptions where user_id=owner and enabled limit 1001
  ), keys as materialized (
    select last_received_at from public.client_health_ingest_keys where client_id=any(ids)
    order by id limit 1001
  ), reports as materialized (
    select client_id,created_at from public.client_files
    where client_id=any(ids) and file_type='health_weekly_report'
    order by created_at desc limit 1001
  ), backup as (
    select backup_date,created_at,payload is not null has_payload,nullif(sha256,'') is not null has_hash
    from app_private.coaching_backup_snapshots where coach_id=owner
    order by created_at desc limit 1
  )
  select jsonb_build_object(
    'format','legal-edge-operational-status','coach_id',owner,'checked_at',now(),
    'alerts',jsonb_build_object(
      'window_days',7,'capped',(select count(*)>1000 from jobs) or (select count(*)>1000 from devices),
      'enabled_devices',(select count(*) from devices),
      'pending',(select count(*) from jobs where status='pending'),
      'pending_unattempted',(select count(*) from jobs where status='pending' and attempts=0),
      'failed',(select count(*) from jobs where status='failed'),
      'provider_accepted',(select count(*) from jobs where delivered_at is not null),
      'last_accepted_at',(select max(delivered_at) from jobs)
    ),
    'backup',coalesce((select to_jsonb(b) from backup b),'null'::jsonb),
    'health',jsonb_build_object(
      'active_clients',cardinality(ids),
      'capped',(select count(*)>1000 from keys) or (select count(*)>1000 from reports),
      'keys_with_receipt',(select count(*) from keys where last_received_at is not null),
      'last_automatic_receipt_at',(select max(last_received_at) from keys),
      'weekly_reports',(select count(*) from reports),
      'report_clients',(select count(distinct client_id) from reports),
      'last_report_at',(select max(created_at) from reports)
    )
  ) into result;
  return result;
end $$;
revoke all on function private.coach_operational_status() from public,anon,authenticated;
grant execute on function private.coach_operational_status() to authenticated;

create or replace function public.coach_operational_status()
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.coach_operational_status();
$$;
revoke all on function public.coach_operational_status() from public,anon;
grant execute on function public.coach_operational_status() to authenticated;
comment on function public.coach_operational_status() is 'Read-only current-coach aggregate status. No answers, health values, credentials, endpoints or backup payload. Provider acceptance is not physical delivery.';

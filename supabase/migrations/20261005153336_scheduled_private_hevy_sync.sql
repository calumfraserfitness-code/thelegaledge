create extension if not exists pg_net with schema extensions;
alter table public.hevy_connections add column last_attempt_at timestamptz, add column last_error_code text, add column next_sync_at timestamptz not null default now();
grant select(last_attempt_at,last_error_code,next_sync_at) on public.hevy_connections to authenticated;
-- Expose status only to the assigned coach, never encrypted credentials.
create policy hevy_coach_metadata on public.hevy_connections for select to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid())));
create table private.health_worker_auth(singleton boolean primary key default true check(singleton), token_hash text not null);
revoke all on private.health_worker_auth from public,anon,authenticated;
grant select on private.health_worker_auth to service_role;
alter table private.health_worker_auth enable row level security;
do $$ declare token text; begin
 token:=encode(extensions.gen_random_bytes(32),'hex');
 perform vault.create_secret(token,'legal_edge_health_worker','Server-only scheduled health worker');
 insert into private.health_worker_auth(token_hash) values(encode(extensions.digest(token,'sha256'),'hex'));
end $$;
create function public.health_worker_authorized(p_token text) returns boolean language sql security invoker set search_path='' as $$ select exists(select 1 from private.health_worker_auth where token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) $$;
revoke all on function public.health_worker_authorized(text) from public,anon,authenticated;
grant execute on function public.health_worker_authorized(text) to service_role;
-- Service-only claim prevents overlapping scheduler runs importing the same account.
create function public.claim_hevy_sync_batch() returns setof public.hevy_connections language sql security invoker set search_path='' as $$
 with due as (select client_id from public.hevy_connections where status='connected' and key_ciphertext is not null and next_sync_at<=now() order by next_sync_at for update skip locked limit 6)
 update public.hevy_connections h set last_attempt_at=now(),next_sync_at=now()+interval '15 minutes' from due where h.client_id=due.client_id returning h.*
$$;
revoke all on function public.claim_hevy_sync_batch() from public,anon,authenticated;
grant execute on function public.claim_hevy_sync_batch() to service_role;
create function private.dispatch_health_sync() returns bigint language plpgsql security definer set search_path='' as $$
declare request_id bigint; begin
 select net.http_post(url:='https://baxvhilvrhshlfizakak.supabase.co/functions/v1/hevy-daily-sync',headers:=jsonb_build_object('Content-Type','application/json','X-Health-Worker',(select decrypted_secret from vault.decrypted_secrets where name='legal_edge_health_worker')),body:='{}'::jsonb,timeout_milliseconds:=100000) into request_id;return request_id;
end $$;
revoke all on function private.dispatch_health_sync() from public,anon,authenticated,service_role;
select cron.schedule('legal-edge-daily-hevy-sync','*/5 * * * *','select private.dispatch_health_sync();');

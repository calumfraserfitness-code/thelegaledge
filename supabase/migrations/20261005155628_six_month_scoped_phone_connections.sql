alter table public.client_health_ingest_keys drop constraint client_health_ingest_keys_check;
alter table public.client_health_ingest_keys add constraint client_health_ingest_keys_max_lifetime check(expires_at <= created_at + interval '183 days');

-- Device subscriptions are private to the signed-in account.
create table public.coaching_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null unique,subscription jsonb not null,enabled boolean not null default true,updated_at timestamptz not null default now(),
 check(length(endpoint)<2000),check(subscription->>'endpoint'=endpoint));
alter table public.coaching_push_subscriptions enable row level security;
revoke all on public.coaching_push_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.coaching_push_subscriptions to authenticated;
grant all on public.coaching_push_subscriptions to service_role;
create policy push_own_account on public.coaching_push_subscriptions for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create table public.coaching_notification_jobs(
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles(id) on delete cascade,
 checkin_id uuid references public.checkins(id) on delete cascade,kind text not null check(kind in('checkin','review')),event_key text not null unique,
 status text not null default 'pending',attempts int not null default 0,next_attempt_at timestamptz not null default now(),lease_until timestamptz,
 delivered_at timestamptz,last_error text,created_at timestamptz not null default now());
create index notification_pending on public.coaching_notification_jobs(next_attempt_at) where status='pending';
alter table public.coaching_notification_jobs enable row level security;
revoke all on public.coaching_notification_jobs from public,anon,authenticated;
grant select on public.coaching_notification_jobs to authenticated;
grant all on public.coaching_notification_jobs to service_role;
create policy notification_recipient on public.coaching_notification_jobs for select to authenticated using(recipient_id=(select auth.uid()));

-- Recover prior check-in versions after accidental edits/deletions. Not a disaster-recovery replacement.
create table app_private.checkin_revisions(id bigint generated always as identity primary key,checkin_id uuid not null,client_id uuid not null,operation text not null,snapshot jsonb not null,recorded_at timestamptz not null default now());
alter table app_private.checkin_revisions enable row level security;
revoke all on app_private.checkin_revisions from public,anon,authenticated;
create index checkin_revision_lookup on app_private.checkin_revisions(client_id,recorded_at desc);
insert into app_private.checkin_revisions(checkin_id,client_id,operation,snapshot) select id,client_id,'BASELINE',to_jsonb(c) from public.checkins c;
create function private.capture_checkin_event() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.clients;begin
 if tg_op='DELETE' then insert into app_private.checkin_revisions(checkin_id,client_id,operation,snapshot) values(old.id,old.client_id,'DELETE',to_jsonb(old));return old;end if;
 if tg_op='UPDATE' then insert into app_private.checkin_revisions(checkin_id,client_id,operation,snapshot) values(old.id,old.client_id,'BEFORE_UPDATE',to_jsonb(old));end if;
 insert into app_private.checkin_revisions(checkin_id,client_id,operation,snapshot) values(new.id,new.client_id,tg_op,to_jsonb(new));
 select * into c from public.clients where id=new.client_id;
 if tg_op='INSERT' and c.coach_id is not null and auth.uid()=c.profile_id then
  insert into public.coaching_notification_jobs(recipient_id,checkin_id,kind,event_key) values(c.coach_id,new.id,'checkin','checkin:'||new.id) on conflict(event_key) do nothing;
 elsif tg_op='UPDATE' and new.reviewed_at is not null and c.profile_id is not null and
  (new.coach_response is distinct from old.coach_response or new.voice_note_url is distinct from old.voice_note_url or old.reviewed_at is null) then
  insert into public.coaching_notification_jobs(recipient_id,checkin_id,kind,event_key)
  values(c.profile_id,new.id,'review','review:'||new.id||':'||md5(coalesce(new.coach_response,'')||coalesce(new.voice_note_url,''))) on conflict(event_key) do nothing;
 end if;return new;end $$;
revoke all on function private.capture_checkin_event() from public,anon,authenticated;
create trigger capture_checkin_event after insert or update or delete on public.checkins for each row execute function private.capture_checkin_event();

-- Secrets remain in Vault and are returned only to the service worker endpoint.
create function private.push_worker_config() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(name,decrypted_secret),'{}') from vault.decrypted_secrets where name in('lec_push_public','lec_push_private','lec_push_worker') $$;
revoke all on function private.push_worker_config() from public,anon,authenticated;
grant execute on function private.push_worker_config() to service_role;
create function public.coaching_push_worker_config() returns jsonb language sql security invoker set search_path='' as $$select private.push_worker_config()$$;
revoke all on function public.coaching_push_worker_config() from public,anon,authenticated;grant execute on function public.coaching_push_worker_config() to service_role;
create function private.initialize_push_config(p_public text,p_private text,p_worker text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(77345009);
 if not exists(select 1 from vault.secrets where name='lec_push_public') then
  perform vault.create_secret(p_public,'lec_push_public');perform vault.create_secret(p_private,'lec_push_private');perform vault.create_secret(p_worker,'lec_push_worker');
 end if;end $$;
revoke all on function private.initialize_push_config(text,text,text) from public,anon,authenticated;grant execute on function private.initialize_push_config(text,text,text) to service_role;
create function public.initialize_coaching_push(p_public text,p_private text,p_worker text) returns void language sql security invoker set search_path='' as $$select private.initialize_push_config(p_public,p_private,p_worker)$$;
revoke all on function public.initialize_coaching_push(text,text,text) from public,anon,authenticated;grant execute on function public.initialize_coaching_push(text,text,text) to service_role;
create function private.claim_push_jobs() returns setof public.coaching_notification_jobs language sql security definer set search_path='' as $$
 with candidates as(select j.id from public.coaching_notification_jobs j where j.status='pending' and j.attempts<5 and j.next_attempt_at<=now() and (j.lease_until is null or j.lease_until<now()) and exists(select 1 from public.coaching_push_subscriptions s where s.user_id=j.recipient_id and s.enabled) order by j.created_at limit 20 for update skip locked)
 update public.coaching_notification_jobs j set lease_until=now()+interval '2 minutes',attempts=attempts+1 from candidates c where j.id=c.id returning j.* $$;
revoke all on function private.claim_push_jobs() from public,anon,authenticated;grant execute on function private.claim_push_jobs() to service_role;
create function public.claim_coaching_push_jobs() returns setof public.coaching_notification_jobs language sql security invoker set search_path='' as $$select * from private.claim_push_jobs()$$;
revoke all on function public.claim_coaching_push_jobs() from public,anon,authenticated;grant execute on function public.claim_coaching_push_jobs() to service_role;
create function private.kick_coaching_push() returns void language plpgsql security definer set search_path='' as $$
declare k text;begin
 if not exists(select 1 from public.coaching_notification_jobs j join public.coaching_push_subscriptions s on s.user_id=j.recipient_id and s.enabled where j.status='pending' and j.attempts<5 and j.next_attempt_at<=now()) then return;end if;
 select decrypted_secret into k from vault.decrypted_secrets where name='lec_push_worker';if k is null then return;end if;
 perform net.http_post(url:='https://baxvhilvrhshlfizakak.supabase.co/functions/v1/coaching-push',headers:=jsonb_build_object('Content-Type','application/json','X-Legal-Push-Worker',k),body:='{}',timeout_milliseconds:=30000);
end $$;
revoke all on function private.kick_coaching_push() from public,anon,authenticated;
select cron.schedule('legal-edge-checkin-push','* * * * *','select private.kick_coaching_push()');
do $$begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='checkins') then alter publication supabase_realtime add table public.checkins;end if;end$$;

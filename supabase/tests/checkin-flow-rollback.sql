-- Synthetic account workflow only. Never commit fixtures or send notifications.
begin;
set local statement_timeout='10s';
create temp table lec_flow_accounts(kind text primary key,id uuid default gen_random_uuid());
insert into lec_flow_accounts(kind) values ('coach'),('client'),('peer');
insert into auth.users(id,email) select id,'lec-flow-'||id||'@example.invalid' from lec_flow_accounts;
insert into public.profiles(id,role,full_name)
select id,case when kind='coach' then 'coach'::public.user_role else 'client'::public.user_role end,'Temporary flow verification' from lec_flow_accounts
on conflict(id) do update set role=excluded.role;
create temp table lec_flow_clients(kind text primary key,id uuid default gen_random_uuid());
insert into lec_flow_clients(kind) values('client'),('peer');
insert into public.clients(id,profile_id,coach_id,display_name,timezone,onboarding_status,portal_enabled)
select c.id,a.id,(select id from lec_flow_accounts where kind='coach'),'Temporary flow verification','America/New_York','complete',true
from lec_flow_clients c join lec_flow_accounts a using(kind);
create temp table lec_flow_result(checkin_id uuid);
grant select on lec_flow_accounts,lec_flow_clients,lec_flow_result to authenticated;
grant insert on lec_flow_result to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from lec_flow_accounts where kind='client'),'role','authenticated')::text,true);
do $$declare c uuid; p date; first_result jsonb; second_result jsonb; begin
select id into c from lec_flow_clients where kind='client';
p:=date_trunc('week',now() at time zone 'America/New_York')::date;
insert into public.client_checkin_drafts(client_id,period_start,answers) values(c,p,'{"wins":"Synthetic draft only","energy":"8"}');
if not exists(select 1 from public.client_checkin_drafts where client_id=c and period_start=p and answers->>'wins'='Synthetic draft only') then raise exception 'Draft reload failed';end if;
first_result:=public.submit_client_checkin(c,jsonb_build_object('period_start',p,'weight_kg',80,'average_steps',5000,'energy',8,'wins','Synthetic submission only'));
if (first_result->>'already_submitted')::boolean then raise exception 'First submit flagged duplicate';end if;
second_result:=public.submit_client_checkin(c,jsonb_build_object('period_start',p,'weight_kg',81,'wins','Must not replace'));
if not (second_result->>'already_submitted')::boolean or first_result->'checkin'->>'id'<>second_result->'checkin'->>'id' then raise exception 'Duplicate protection failed';end if;
if not exists(select 1 from public.checkins where id=(first_result->'checkin'->>'id')::uuid and weight_kg=80 and wins='Synthetic submission only' and submitted_at is not null) then raise exception 'Submission reload failed';end if;
if not exists(select 1 from public.progress_entries where client_id=c and entry_date=(now() at time zone 'America/New_York')::date and weight_kg=80) then raise exception 'Dated progress save failed';end if;
insert into lec_flow_result values((first_result->'checkin'->>'id')::uuid);
delete from public.client_checkin_drafts where client_id=c and period_start=p;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from lec_flow_accounts where kind='peer'),'role','authenticated')::text,true);
do $$begin
if exists(select 1 from public.checkins where client_id=(select id from lec_flow_clients where kind='client')) then raise exception 'Peer can read check-in';end if;
begin
perform public.submit_client_checkin((select id from lec_flow_clients where kind='client'),jsonb_build_object('period_start',date_trunc('week',now() at time zone 'America/New_York')::date));
raise exception 'Peer submit allowed';
exception when raise_exception then if sqlerrm='Peer submit allowed' then raise;end if;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from lec_flow_accounts where kind='coach'),'role','authenticated')::text,true);
do $$declare r public.checkins; begin
if not exists(select 1 from public.coaching_notification_jobs where checkin_id=(select checkin_id from lec_flow_result) and kind='checkin' and status='pending') then raise exception 'Coach notification not queued';end if;
r:=public.save_checkin_review((select checkin_id from lec_flow_result),'Synthetic review only','https://www.loom.com/share/0123456789abcdef0123456789abcdef','Synthetic action',true);
if r.reviewed_at is null then raise exception 'Review save failed';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from lec_flow_accounts where kind='client'),'role','authenticated')::text,true);
do $$begin
if not exists(select 1 from public.checkins where id=(select checkin_id from lec_flow_result) and coach_response='Synthetic review only' and voice_note_url='https://www.loom.com/share/0123456789abcdef0123456789abcdef' and reviewed_at is not null) then raise exception 'Client review reload failed';end if;
if not exists(select 1 from public.coaching_notification_jobs where checkin_id=(select checkin_id from lec_flow_result) and kind='review' and status='pending') then raise exception 'Client review notification not queued';end if;
end $$;
reset role;
select 'PASS: draft reload; check-in and dated progress persistence; duplicate protection; peer denial; coach review and client-visible video link; both notification jobs queued. Synthetic transaction rolled back; no phone message sent.' as result;
rollback;

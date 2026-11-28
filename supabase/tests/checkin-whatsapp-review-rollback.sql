-- Synthetic fixtures only. The whole transaction is rolled back; no notifications can commit.
begin;
set local statement_timeout='15s';
create temp table wa_accounts(kind text primary key,id uuid default gen_random_uuid());
insert into wa_accounts(kind) values('coach'),('peer_coach'),('client'),('peer_client');
insert into auth.users(id,email) select id,'wa-review-'||id||'@example.invalid' from wa_accounts;
insert into public.profiles(id,role,full_name)
select id,case when kind like '%coach' then 'coach'::public.user_role else 'client'::public.user_role end,'WhatsApp rollback fixture' from wa_accounts
on conflict(id) do update set role=excluded.role;
create temp table wa_clients(kind text primary key,id uuid default gen_random_uuid());
insert into wa_clients(kind) values('own'),('peer');
insert into public.clients(id,profile_id,coach_id,display_name)
select id,(select id from wa_accounts where kind=case when c.kind='own' then 'client' else 'peer_client' end),
(select id from wa_accounts where kind=case when c.kind='own' then 'coach' else 'peer_coach' end),'WhatsApp rollback fixture' from wa_clients c;
create temp table wa_checkins(kind text primary key,id uuid default gen_random_uuid());
insert into wa_checkins(kind) values('blank'),('draft'),('app'),('peer');
insert into public.checkins(id,client_id,wins,coach_response,voice_note_url,focus_next_week,reviewed_at,review_channel)
select f.id,(select id from wa_clients where kind=case when f.kind='peer' then 'peer' else 'own' end),'Fixture client answer',
case when f.kind='draft' then 'Preserve unpublished response' end,
case when f.kind='draft' then 'https://example.invalid/preserved-video' end,
case when f.kind='draft' then 'Preserve unpublished actions' end,
case when f.kind='app' then now()-interval '1 day' end,
case when f.kind='app' then 'app' end from wa_checkins f;
grant select on wa_accounts,wa_clients,wa_checkins to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from wa_accounts where kind='coach'),'role','authenticated')::text,true);
do $$ declare r public.checkins; stamp timestamptz; begin
 r:=public.set_checkin_whatsapp_review((select id from wa_checkins where kind='blank'),true);
 if r.reviewed_at is null or r.review_channel<>'whatsapp' or r.coach_response is not null or r.voice_note_url is not null or r.focus_next_week is not null or r.wins<>'Fixture client answer' then raise exception 'Blank WhatsApp completion failed';end if;
 stamp:=r.reviewed_at;r:=public.set_checkin_whatsapp_review(r.id,true);if r.reviewed_at<>stamp then raise exception 'Repeat confirmation changed review timestamp';end if;
 r:=public.set_checkin_whatsapp_review((select id from wa_checkins where kind='draft'),true);
 if r.coach_response<>'Preserve unpublished response' or r.voice_note_url<>'https://example.invalid/preserved-video' or r.focus_next_week<>'Preserve unpublished actions' or r.review_channel<>'whatsapp' then raise exception 'Existing draft content was overwritten';end if;
 r:=public.set_checkin_whatsapp_review((select id from wa_checkins where kind='blank'),false);
 if r.reviewed_at is not null or r.review_channel is not null then raise exception 'WhatsApp undo did not reopen review';end if;
 r:=public.set_checkin_whatsapp_review((select id from wa_checkins where kind='app'),false);
 if r.reviewed_at is null or r.review_channel<>'app' then raise exception 'External undo changed an app review';end if;
 begin
  perform public.save_checkin_review((select id from wa_checkins where kind='blank'),null,null,null,true);
  raise exception 'Empty in-app review was accepted';
 exception when raise_exception then if sqlerrm='Empty in-app review was accepted' then raise;end if;end;
 begin
  perform public.set_checkin_whatsapp_review((select id from wa_checkins where kind='peer'),true);
  raise exception 'Peer check-in was changed';
 exception when raise_exception then if sqlerrm='Peer check-in was changed' then raise;end if;end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.coaching_notification_jobs where checkin_id in(select id from wa_checkins)) then raise exception 'WhatsApp confirmation queued a notification';end if;
 if not exists(select 1 from app_private.checkin_revisions where checkin_id=(select id from wa_checkins where kind='draft') and operation='UPDATE' and snapshot->>'review_channel'='whatsapp') then raise exception 'Review recovery snapshot missing';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from wa_accounts where kind='coach'),'role','authenticated')::text,true);
do $$ declare r public.checkins;begin
 r:=public.save_checkin_review((select id from wa_checkins where kind='draft'),'Explicit in-app feedback',null,'Approved action',true);
 if r.review_channel<>'app' or r.coach_response<>'Explicit in-app feedback' or r.reviewed_at is null then raise exception 'Normal in-app review no longer works';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from wa_accounts where kind='client'),'role','authenticated')::text,true);
do $$ begin
 if not exists(select 1 from public.checkins where id=(select id from wa_checkins where kind='app')) then raise exception 'Client lost own check-in read';end if;
 begin
  perform public.set_checkin_whatsapp_review((select id from wa_checkins where kind='blank'),true);
  raise exception 'Client reviewed own check-in';
 exception when raise_exception then if sqlerrm='Client reviewed own check-in' then raise;end if;end;
 begin
  insert into public.checkins(client_id,review_channel) values((select id from wa_clients where kind='own'),'whatsapp');
  raise exception 'Client manufactured review channel';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from wa_accounts where kind='peer_coach'),'role','authenticated')::text,true);
do $$ begin
 begin
  perform public.set_checkin_whatsapp_review((select id from wa_checkins where kind='blank'),true);
  raise exception 'Peer coach reviewed another coach check-in';
 exception when raise_exception then if sqlerrm='Peer coach reviewed another coach check-in' then raise;end if;end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.set_checkin_whatsapp_review(uuid,boolean)','EXECUTE') then raise exception 'Anonymous caller has review privilege';end if;
 if (select count(*) from public.coaching_notification_jobs where checkin_id in(select id from wa_checkins))<>1 or
 not exists(select 1 from public.coaching_notification_jobs where checkin_id=(select id from wa_checkins where kind='draft') and kind='review') then raise exception 'Normal in-app review notification behavior changed';end if;
end $$;
select 'PASS: own coach WhatsApp complete/undo with no message jobs; preserved response/video/actions; idempotent timestamp; audit snapshots; normal app review; peer/client/anon denial. All synthetic fixtures rolled back.' result;
rollback;

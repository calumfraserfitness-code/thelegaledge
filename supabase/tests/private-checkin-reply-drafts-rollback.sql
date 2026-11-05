-- No Auth/account writes. Existing identities exercise normal RLS; all new data is synthetic and rolled back.
begin;
set local statement_timeout='20s';
create temp table reply_scope as
select c.id client_id,c.coach_id,c.profile_id client_user,
 (select p.id from public.profiles p where p.role='coach' and p.id<>c.coach_id order by p.id limit 1) peer_coach,
 (select q.id from public.clients q where q.coach_id<>c.coach_id and q.coach_id in(select id from public.profiles where role='coach') and q.deleted_at is null order by q.id limit 1) peer_client,
 (select q.id from public.clients q where q.coach_id=c.coach_id and q.id<>c.id and q.deleted_at is null order by q.id limit 1) second_own_client
from public.clients c join public.profiles p on p.id=c.profile_id and p.role='client'
join public.profiles coach on coach.id=c.coach_id and coach.role='coach'
where c.deleted_at is null and exists(select 1 from public.clients q where q.coach_id=c.coach_id and q.id<>c.id and q.deleted_at is null) order by c.id limit 1;
do $$ begin if not exists(select 1 from reply_scope where client_user is not null and peer_coach is not null and peer_client is not null and second_own_client is not null) then raise exception 'Need existing linked client and two coach identities for rollback verification';end if;end $$;
create temp table reply_ids(kind text primary key,id uuid default gen_random_uuid());
insert into reply_ids(kind) values('draft'),('raw_insert'),('raw_update'),('peer'),('link'),('client_insert'),('status_move');
grant select on reply_scope,reply_ids to authenticated,anon;
create function pg_temp.reply_jobs(p_checkin uuid) returns integer language sql security definer set search_path='' as $$ select count(*)::integer from public.coaching_notification_jobs where checkin_id=p_checkin and p_checkin in(select id from pg_temp.reply_ids) $$;
grant execute on function pg_temp.reply_jobs(uuid) to authenticated;

insert into public.checkins(id,client_id,source_system) select i.id,case when i.kind='peer' then s.peer_client else s.client_id end,'reply_privacy_rollback_fixture' from reply_ids i cross join reply_scope s where i.kind not in('raw_insert','client_insert');

-- Model retained work from a former coach: current owner's backup must not include it.
insert into public.coach_checkin_reply_drafts(checkin_id,client_id,coach_id,response_text)
select (select id from reply_ids where kind='link'),client_id,peer_coach,'FORMER COACH PRIVATE' from reply_scope;

select set_config('request.jwt.claims',(select jsonb_build_object('sub',coach_id,'role','authenticated')::text from reply_scope),true);
set local role authenticated;
do $$ declare k uuid;row public.checkins;jobs integer;blocked boolean;bundle jsonb;begin
 select id into k from reply_ids where kind='draft';
 select pg_temp.reply_jobs(k) into jobs;
 row:=public.save_checkin_review(k,'PRIVATE draft sentinel','unfinished video URL','PRIVATE action',false);
 if row.coach_response is not null or row.voice_note_url is not null or row.focus_next_week is not null or row.reviewed_at is not null then raise exception 'Draft data escaped into public row/RPC result';end if;
 if not exists(select 1 from public.coach_checkin_reply_drafts where checkin_id=k and response_text='PRIVATE draft sentinel' and video_url='unfinished video URL') then raise exception 'Own coach could not reload draft';end if;
 if pg_temp.reply_jobs(k)<>jobs then raise exception 'Private draft created a notification';end if;
 blocked:=false;begin perform public.save_checkin_review(k,'','unfinished URL','',true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Invalid publish was accepted';end if;
 row:=public.save_checkin_review(k,'Published response','https://www.loom.com/share/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Published action',true);
 if row.coach_response<>'Published response' or row.reviewed_at is null or row.review_channel<>'app' then raise exception 'Explicit publication failed';end if;
 if exists(select 1 from public.coach_checkin_reply_drafts where checkin_id=k) then raise exception 'Consumed private draft was retained as pending';end if;
 select pg_temp.reply_jobs(k) into jobs;
 if jobs<>1 then raise exception 'Explicit publish notification behavior changed';end if;
 row:=public.save_checkin_review(k,'NEWER PRIVATE draft','unfinished second URL','NEWER PRIVATE action',false);
 if row.coach_response<>'Published response' or row.reviewed_at is null or row.review_channel<>'app' then raise exception 'Saving new private work changed approved feedback/status';end if;
 if pg_temp.reply_jobs(k)<>jobs then raise exception 'Editing a private draft notified the client';end if;
 -- An old raw response editor writes only privately, retaining its approved public predecessor.
 update public.checkins set coach_response='LEGACY RAW private rewrite' where id=k returning * into row;
 if row.coach_response<>'Published response' then raise exception 'Legacy raw UPDATE published an unfinished edit';end if;
 if not exists(select 1 from public.coach_checkin_reply_drafts where checkin_id=k and response_text='LEGACY RAW private rewrite') then raise exception 'Legacy raw UPDATE was not retained privately';end if;
 -- Status-only demotion cannot overwrite a newer draft with unchanged old published content.
 perform public.save_checkin_review(k,'NEWEST PRIVATE keep','unfinished retained URL','NEWEST action',false);
 update public.checkins set reviewed_at=null where id=k returning * into row;
 if row.coach_response is not null or row.voice_note_url is not null or row.focus_next_week is not null then raise exception 'Raw status demotion retained public reply';end if;
 if not exists(select 1 from public.coach_checkin_reply_drafts where checkin_id=k and response_text='NEWEST PRIVATE keep') then raise exception 'Raw demotion overwrote newer private work';end if;
 -- Draft-safe WhatsApp completion and undo never release private fields or queue a message.
 row:=public.set_checkin_whatsapp_review(k,true);
 if row.reviewed_at is null or row.review_channel<>'whatsapp' or row.coach_response is not null or row.voice_note_url is not null or row.focus_next_week is not null then raise exception 'WhatsApp review published draft fields';end if;
 row:=public.set_checkin_whatsapp_review(k,false);
 if row.reviewed_at is not null or row.review_channel is not null then raise exception 'WhatsApp undo failed';end if;
 if not exists(select 1 from public.coach_checkin_reply_drafts where checkin_id=k and response_text='NEWEST PRIVATE keep') then raise exception 'WhatsApp action lost the private draft';end if;
 if pg_temp.reply_jobs(k)<>jobs then raise exception 'WhatsApp/undo/demotion created review notifications';end if;
 -- Explicit reopen withdraws an approved response while preserving newer private edits.
 row:=public.save_checkin_review(k,'Second published response','','Second published action',true);
 perform public.save_checkin_review(k,'Retained on reopen','partial video','Retained action',false);
 row:=public.reopen_checkin_review(k);
 if row.reviewed_at is not null or row.coach_response is not null or row.voice_note_url is not null or row.focus_next_week is not null then raise exception 'Explicit reopen did not withdraw public reply';end if;
 if not exists(select 1 from public.coach_checkin_reply_drafts where checkin_id=k and response_text='Retained on reopen') then raise exception 'Reopen clobbered newer private work';end if;
 -- BEFORE INSERT must sanitize RETURNING as well as the stored/WAL tuple.
 select id into k from reply_ids where kind='raw_insert';
 insert into public.checkins(id,client_id,source_system,coach_response,voice_note_url,focus_next_week)
 select k,client_id,'reply_privacy_rollback_fixture','RAW INSERT PRIVATE','partial URL','RAW INSERT ACTION' from reply_scope returning * into row;
 if row.coach_response is not null or row.voice_note_url is not null or row.focus_next_week is not null then raise exception 'Raw INSERT RETURNING leaked a private reply';end if;
 if not exists(select 1 from public.coach_checkin_reply_drafts where checkin_id=k and response_text='RAW INSERT PRIVATE') then raise exception 'Raw INSERT private copy missing';end if;
 select id into k from reply_ids where kind='raw_update';update public.checkins set coach_response='RAW UPDATE PRIVATE',focus_next_week='RAW UPDATE ACTION' where id=k returning * into row;
 if row.coach_response is not null or row.focus_next_week is not null then raise exception 'Raw unreviewed UPDATE leaked reply';end if;
 bundle:=public.export_coaching_backup();
 if bundle->>'format'<>'legal-edge-coaching-backup' or not(bundle->'tables'?'coach_checkin_reply_drafts') then raise exception 'Private draft backup coverage missing';end if;
 if not exists(select 1 from jsonb_array_elements(bundle->'tables'->'coach_checkin_reply_drafts') d where d->>'response_text'='Retained on reopen') then raise exception 'Own private draft omitted from coaching backup';end if;
 if exists(select 1 from jsonb_array_elements(bundle->'tables'->'coach_checkin_reply_drafts') d where d->>'response_text'='FORMER COACH PRIVATE') then raise exception 'Backup exposed another coach private work';end if;
 -- Qualified parent ownership prevents attaching a draft to another owned client.
 blocked:=false;begin insert into public.coach_checkin_reply_drafts(checkin_id,client_id,coach_id,response_text) select (select id from reply_ids where kind='link'),second_own_client,coach_id,'MISMATCHED' from reply_scope;exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Draft parent/client mismatch was accepted';end if;
 blocked:=false;begin perform public.save_checkin_review((select id from reply_ids where kind='peer'),'PEER','','',false);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Assigned coach could edit a peer client';end if;
end $$;
reset role;

select set_config('request.jwt.claims',(select jsonb_build_object('sub',client_user,'role','authenticated')::text from reply_scope),true);
set local role authenticated;
do $$ declare blocked boolean;row public.checkins;begin
 if exists(select 1 from public.coach_checkin_reply_drafts) then raise exception 'Client could read a private reply draft';end if;
 if exists(select 1 from public.checkins where id in(select id from reply_ids where kind<>'peer') and (coach_response is not null or voice_note_url is not null or focus_next_week is not null)) then raise exception 'Client check-in projection exposed unfinished content';end if;
 blocked:=false;begin perform public.save_checkin_review((select id from reply_ids where kind='draft'),'CLIENT SPOOF','','',true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Client invoked coach publish API';end if;
 blocked:=false;begin perform public.set_checkin_whatsapp_review((select id from reply_ids where kind='draft'),true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Client invoked coach WhatsApp API';end if;
 blocked:=false;begin perform public.export_coaching_backup();exception when others then blocked:=true;end;
 if not blocked then raise exception 'Client invoked coach backup API';end if;
 blocked:=false;begin insert into public.checkins(client_id,focus_next_week) select client_id,'CLIENT COACH ACTION SPOOF' from reply_scope;exception when others then blocked:=true;end;
 if not blocked then raise exception 'Client could insert coach action text';end if;
 blocked:=false;begin insert into public.coach_checkin_reply_drafts(checkin_id,client_id,coach_id,response_text) select (select id from reply_ids where kind='link'),client_id,coach_id,'CLIENT PRIVATE TABLE SPOOF' from reply_scope;exception when others then blocked:=true;end;
 if not blocked then raise exception 'Client could insert a coach draft';end if;
 insert into public.checkins(id,client_id,source_system,wins) select (select id from reply_ids where kind='client_insert'),client_id,'reply_privacy_rollback_fixture','Client answer retained' from reply_scope returning * into row;
 if row.coach_response is not null or row.voice_note_url is not null or row.focus_next_week is not null then raise exception 'Normal client insert exposed coach fields';end if;
end $$;
reset role;

select set_config('request.jwt.claims',(select jsonb_build_object('sub',peer_coach,'role','authenticated')::text from reply_scope),true);
set local role authenticated;
do $$ declare blocked boolean;begin
 if exists(select 1 from public.coach_checkin_reply_drafts where checkin_id in(select id from reply_ids where kind<>'peer')) then raise exception 'Peer coach could read another coach draft';end if;
 blocked:=false;begin perform public.reopen_checkin_review((select id from reply_ids where kind='draft'));exception when others then blocked:=true;end;
 if not blocked then raise exception 'Peer coach could reopen another coach review';end if;
 -- Establish this is a genuine coach identity with an independently owned client.
 perform public.save_checkin_review((select id from reply_ids where kind='peer'),'PEER OWN PRIVATE','','',false);
 if not exists(select 1 from public.coach_checkin_reply_drafts where checkin_id=(select id from reply_ids where kind='peer')) then raise exception 'Peer fixture coach ownership is invalid';end if;
end $$;
reset role;

select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ declare blocked boolean;begin
 blocked:=false;begin perform count(*) from public.coach_checkin_reply_drafts;exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Anonymous private-draft grant remains';end if;
 blocked:=false;begin perform public.reopen_checkin_review((select id from reply_ids where kind='draft'));exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Anonymous coach RPC grant remains';end if;
end $$;
reset role;
set constraints all immediate;
select 'PASS private drafts, publication, preserved approvals, explicit reopen, raw BEFORE sanitization, no private/WhatsApp notifications, owner/client/peer/anon isolation and unchanged client submissions' as verification;
rollback;

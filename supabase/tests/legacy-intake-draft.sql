begin;
select set_config('test.client',(select id::text from public.clients where display_name='johnny' order by created_at desc limit 1),true);
select set_config('test.user',(select profile_id::text from public.clients where id=current_setting('test.client')::uuid),true);
delete from public.onboarding_drafts where client_id=current_setting('test.client')::uuid;
update public.clients set onboarding_status='pending_legal' where id=current_setting('test.client')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.user'),true);
set local role authenticated;
do $$ begin
 begin insert into public.onboarding_drafts(client_id,responses,step) values(current_setting('test.client')::uuid,'{}',0);raise exception 'Pre-consent draft allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.legal_consents(client_id,consent_type,document_name,document_version,accepted_at,signed_at,signature_name,details) values(current_setting('test.client')::uuid,'coaching_privacy_health','QA rollback only','QA-DRAFT-TEST',now(),now(),'QA only','{"health_confirmed":true,"privacy_accepted":true}');
update public.clients set onboarding_status='pending_onboarding' where id=current_setting('test.client')::uuid;
set local role authenticated;
insert into public.onboarding_drafts(client_id,responses,step) values(current_setting('test.client')::uuid,'{"goals":"QA only"}',1);
update public.onboarding_drafts set step=2 where client_id=current_setting('test.client')::uuid;
do $$ begin if not exists(select 1 from public.onboarding_drafts where client_id=current_setting('test.client')::uuid and step=2) then raise exception 'Own draft missing';end if;end $$;
reset role;
select set_config('request.jwt.claim.sub',(select profile_id::text from public.clients where profile_id in (select id from public.profiles where role='client') and profile_id<>current_setting('test.user')::uuid limit 1),true);
set local role authenticated;
do $$ declare changed integer;begin
 if exists(select 1 from public.onboarding_drafts where client_id=current_setting('test.client')::uuid) then raise exception 'Peer read leak';end if;
 update public.onboarding_drafts set step=3 where client_id=current_setting('test.client')::uuid;get diagnostics changed=row_count;if changed<>0 then raise exception 'Peer update leak';end if;
end $$;
reset role;
select 'PASS: pre-consent denial, own draft save/restore/update, peer read/update denial; all rolled back' as result;
rollback;

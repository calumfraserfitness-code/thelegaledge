-- Reversible checks using existing linked records; all writes roll back.
begin;
select set_config('test.owner_client',(select id::text from public.clients where display_name='johnny' order by created_at desc limit 1),true);
select set_config('test.owner_user',(select profile_id::text from public.clients where id=current_setting('test.owner_client')::uuid),true);
select set_config('request.jwt.claim.sub',current_setting('test.owner_user'),true);
delete from public.client_welcome_receipts where client_id=current_setting('test.owner_client')::uuid;
set local role authenticated;
insert into public.client_welcome_receipts(client_id) values(current_setting('test.owner_client')::uuid);
do $$ begin
 if not exists(select 1 from public.client_welcome_receipts where client_id=current_setting('test.owner_client')::uuid) then raise exception 'Owner receipt missing';end if;
end $$;
reset role;
insert into public.coaching_start_resources(coach_id,title,body,published) select coach_id,'QA published start','QA only',true from public.clients where id=current_setting('test.owner_client')::uuid;
insert into public.coaching_start_resources(coach_id,title,body,published) select coach_id,'QA draft start','QA only',false from public.clients where id=current_setting('test.owner_client')::uuid;
update public.clients set onboarding_status='complete' where id=current_setting('test.owner_client')::uuid;
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.coaching_start_resources where title='QA published start') then raise exception 'Legacy completed client cannot read published library';end if;
 if exists(select 1 from public.coaching_start_resources where title='QA draft start') then raise exception 'Draft leaked';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select profile_id::text from public.clients where profile_id in (select id from public.profiles where role='client') and profile_id<>current_setting('test.owner_user')::uuid limit 1),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.client_welcome_receipts where client_id=current_setting('test.owner_client')::uuid) then raise exception 'Peer read leaked';end if;
 begin insert into public.client_welcome_receipts(client_id) values(current_setting('test.owner_client')::uuid);raise exception 'Peer insert allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: own welcome acknowledgement, peer read/write denial, published library for legacy completed client, draft denial. All writes rolled back.' as result;
rollback;

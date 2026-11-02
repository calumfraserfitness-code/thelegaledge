-- All fixture changes roll back; no client-facing feedback or messages.
begin;
do $$ declare c public.clients;begin
 select * into c from public.clients where coach_id in(select id from public.profiles where role='coach') and profile_id is not null and deleted_at is null limit 1;
 if c.id is null then raise exception 'A linked client is needed for the private brief RLS test';end if;
 perform set_config('app.brief_test_client',c.id::text,true);perform set_config('app.brief_test_profile',c.profile_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c.coach_id,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare b public.coach_review_briefs;begin
 insert into public.coach_review_briefs(client_id,coach_id,context,model) values(current_setting('app.brief_test_client')::uuid,auth.uid(),'{"sources":[]}', 'qa-rollback-only') returning * into b;
 perform set_config('app.brief_test_row',b.id::text,true);
 update public.coach_review_briefs set status='draft',payload='{"suggested_response":"Private QA"}' where id=b.id;
 if not found then raise exception 'Coach private save failed';end if;
 begin update public.coach_review_briefs set context='{"changed":true}' where id=b.id;raise exception 'Source freeze failed';exception when others then if sqlerrm='Source freeze failed' then raise;end if;end;
 begin update public.coach_review_briefs set coach_id=gen_random_uuid() where id=b.id;raise exception 'Owner freeze failed';exception when others then if sqlerrm='Owner freeze failed' then raise;end if;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.brief_test_profile'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.coach_review_briefs where id=current_setting('app.brief_test_row')::uuid) then raise exception 'Client could read coach brief';end if;
 update public.coach_review_briefs set payload='{"bad":true}' where id=current_setting('app.brief_test_row')::uuid;
 if found then raise exception 'Client could update coach brief';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
do $$ begin if exists(select 1 from public.coach_review_briefs where id=current_setting('app.brief_test_row')::uuid) then raise exception 'Peer could read coach brief';end if;end $$;
select 'PASS: coach draft save, source/owner freeze, client and peer isolation; all fixtures rolled back' result;
rollback;

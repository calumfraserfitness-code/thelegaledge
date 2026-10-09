begin;
select set_config('coaching_test.client',(select client_id::text from public.coaching_recording_events where source='fathom' and matching_status='matched' order by occurred_at desc limit 1),true);
select set_config('coaching_test.coach',(select coach_id::text from public.clients where id=current_setting('coaching_test.client')::uuid),true);
select set_config('coaching_test.owner',(select profile_id::text from public.clients where id=current_setting('coaching_test.client')::uuid),true);
select set_config('coaching_test.other',(select profile_id::text from public.clients where id<>current_setting('coaching_test.client')::uuid and profile_id is not null limit 1),true);
select set_config('coaching_test.calories',(select calorie_goal::text from public.clients where id=current_setting('coaching_test.client')::uuid),true);
select set_config('coaching_test.steps',(select daily_steps_goal::text from public.clients where id=current_setting('coaching_test.client')::uuid),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('coaching_test.coach'),true);
do $$declare p uuid; conflicts uuid; r jsonb;begin
 if (select count(*) from public.coaching_recording_events where client_id=current_setting('coaching_test.client')::uuid)<>2 then raise exception 'Coach cannot see source history';end if;
 select id into conflicts from public.coaching_change_proposals where client_id=current_setting('coaching_test.client')::uuid and change_type='nutrition_target' limit 1;
 begin
   perform public.review_coaching_proposal(conflicts,'approved','Unreconciled target',current_date,current_date+7,false);
   raise exception 'Conflict guard failed';
 exception when raise_exception then if sqlerrm<>'Reconcile the conflicting prescription first' then raise;end if;end;
 select id into p from public.coaching_change_proposals where client_id=current_setting('coaching_test.client')::uuid and change_type='commitment' limit 1;
 r:=public.review_coaching_proposal(p,'approved','Temporary rollback-only test item',current_date,current_date+7,false);
 if r->>'status'<>'approved' or r->>'prescriptions_changed'<>'false' then raise exception 'Approval failed';end if;
 r:=public.review_coaching_proposal(p,'approved','Duplicate temporary item',current_date,current_date+7,false);
 if r->>'already_reviewed'<>'true' then raise exception 'Duplicate review failed';end if;
 if (select count(*) from public.client_weekly_focus where proposal_id=p)<>1 then raise exception 'Duplicate publication';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('coaching_test.owner'),true);
do $$declare f uuid;r jsonb;begin
 if (select count(*) from public.coaching_recording_events)<>0 or (select count(*) from public.coaching_change_proposals)<>0 then raise exception 'Private source exposed to client';end if;
 if (select count(*) from public.coaching_review_audit)<>0 then raise exception 'Internal audit exposed to client';end if;
 select id into f from public.client_weekly_focus where description='Temporary rollback-only test item';
 if f is null then raise exception 'Owner cannot see approved focus';end if;
 r:=public.complete_coaching_focus(f,true);
 if r->>'completed_at' is null then raise exception 'Completion failed';end if;
 begin
   perform public.review_coaching_proposal((r->>'proposal_id')::uuid,'rejected');
   raise exception 'Client approval guard failed';
 exception when raise_exception then if sqlerrm<>'Coach access required' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('coaching_test.other'),true);
do $$begin
 if exists(select 1 from public.client_weekly_focus where client_id=current_setting('coaching_test.client')::uuid) then raise exception 'Other client can see focus';end if;
 if exists(select 1 from public.coaching_recording_events) then raise exception 'Other client can see raw history';end if;
end $$;
reset role;
do $$begin
 if (select calorie_goal from public.clients where id=current_setting('coaching_test.client')::uuid)<>current_setting('coaching_test.calories')::integer then raise exception 'Calorie target changed';end if;
 if (select daily_steps_goal from public.clients where id=current_setting('coaching_test.client')::uuid)<>current_setting('coaching_test.steps')::integer then raise exception 'Step target changed';end if;
end $$;
rollback;
select 'PASS: coach review, conflict guard, approval idempotency, client completion, raw-source privacy and other-client isolation; all test writes rolled back' as result;

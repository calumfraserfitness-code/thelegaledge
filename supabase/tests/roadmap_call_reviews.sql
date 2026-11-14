-- Operator supplies legal_edge.test_coach. All synthetic changes are rolled back.
begin;
set local statement_timeout='20s';
create temp table goal_test as select r.client_id,r.coach_id,r.revision,r.payload,c.profile_id,gen_random_uuid() event_id
from public.coach_client_roadmaps r join public.clients c on c.id=r.client_id and c.coach_id=r.coach_id
where r.coach_id=nullif(current_setting('legal_edge.test_coach',true),'')::uuid and c.status='active' and c.deleted_at is null
order by r.client_id limit 1;
do $$ begin if (select count(*) from goal_test)<>1 then raise exception 'Supply a test coach with a private roadmap';end if;end $$;
insert into public.coaching_recording_events(id,client_id,coach_id,source,source_event_id,source_url,source_title,occurred_at,matching_status,processing_status,summary,action_items)
select event_id,client_id,coach_id,'fathom','rollback-goal-test-'||event_id,'https://fathom.video/calls/123','Synthetic rollback evidence',now(),'matched','received','Synthetic call evidence. No real client agreement.', '[{"description":"Review the synthetic goal"}]'::jsonb from goal_test;
grant select on goal_test to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select coach_id from goal_test),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare t record;ctx jsonb;h text;r public.coach_client_roadmaps;g text;change jsonb;n integer;begin
 select * into t from goal_test;g:=t.payload->'goals'->0->>'id';
 ctx:=public.roadmap_call_context(t.client_id);
 if ctx->>'client_id'<>t.client_id::text or not exists(select 1 from jsonb_array_elements(ctx->'events') e where e->>'id'=t.event_id::text and e->>'review_status'='pending') then raise exception 'New received call was not queued';end if;
 select source_hash into h from public.coach_goal_call_reviews where event_id=t.event_id;
 change:=jsonb_build_object('title','Synthetic target','baseline','Synthetic dated starting point','target','Complete one synthetic review','weekly_actions','Review once','success_measure','Review receipt recorded','review_on',(current_date+7)::text,'status','complete','id','spoofed');
 begin perform public.review_roadmap_call_goal(t.client_id,t.event_id,g,t.revision,'wrong', 'simplify',change,'Synthetic test decision',false);raise exception 'Stale hash accepted';exception when serialization_failure then null;end;
 begin perform public.review_roadmap_call_goal(t.client_id,t.event_id,g,t.revision-1,h,'simplify',change,'Synthetic test decision',false);raise exception 'Stale roadmap accepted';exception when serialization_failure then null;end;
 r:=public.review_roadmap_call_goal(t.client_id,t.event_id,g,t.revision,h,'replace',change,'Synthetic replacement review',false);
 if r.revision<>t.revision+1 or jsonb_array_length(r.payload->'goals')<>jsonb_array_length(t.payload->'goals')+1 then raise exception 'Replacement did not preserve the old goal';end if;
 if r.payload->'goals'->0->>'status'<>'historical' or r.payload->'goals'->-1->>'status'<>'proposed' or r.payload->'goals'->-1->>'id'='spoofed' then raise exception 'Confirmation/whitelist guard failed';end if;
 select count(*) into n from public.coach_roadmap_versions where client_id=t.client_id and revision in(t.revision,t.revision+1);if n<>2 then raise exception 'Before and after versions not retained';end if;
 if (select jsonb_array_length(public.roadmap_goal_history(t.client_id,g)))<2 then raise exception 'Private history unavailable';end if;
 begin perform public.review_roadmap_call_goal(t.client_id,t.event_id,g,r.revision,h,'replace',change,'Duplicate synthetic review',false);raise exception 'Duplicate goal/call accepted';exception when raise_exception then if sqlerrm not like 'This goal was already reviewed%' then raise;end if;end;
 if (public.finish_roadmap_call_review(t.client_id,t.event_id,h)->>'status')<>'reviewed' then raise exception 'Call review not finished';end if;
 begin update public.coach_client_roadmaps set payload=payload||'{"synthetic_bypass":true}' where client_id=t.client_id;raise exception 'Unversioned update accepted';exception when raise_exception then if sqlerrm not like 'Roadmap identity is fixed%' then raise;end if;end;
end $$;
reset role;
update public.coaching_recording_events set summary='Changed synthetic evidence' where id=(select event_id from goal_test);
do $$ begin if not exists(select 1 from public.coach_goal_call_reviews where event_id=(select event_id from goal_test) and status='pending' and reviewed_at is null) then raise exception 'Changed source did not reopen review';end if;end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select profile_id from goal_test),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare t record;begin select * into t from goal_test;
 if exists(select 1 from public.coach_client_roadmaps where client_id=t.client_id) or exists(select 1 from public.coach_roadmap_versions where client_id=t.client_id) or exists(select 1 from public.coach_goal_call_reviews where client_id=t.client_id) or exists(select 1 from public.coach_goal_change_receipts where client_id=t.client_id) then raise exception 'Client read private coach evidence';end if;
 begin perform public.roadmap_call_context(t.client_id);raise exception 'Client called coach context';exception when insufficient_privilege then null;end;
 begin perform public.roadmap_goal_history(t.client_id,'any');raise exception 'Client called coach history';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS received-call queue, revision/hash conflicts, replacement history, duplicate guard, whitelist, source invalidation and client denial; synthetic writes rolled back' result;
rollback;

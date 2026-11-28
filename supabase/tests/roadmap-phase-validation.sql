-- Pure validation checks: no client records, fixtures or prescriptions changed.
begin read only;
set local statement_timeout='8s';
do $$ declare p jsonb;t jsonb;k text;begin
 p:=jsonb_build_object('goals',jsonb_build_array(jsonb_build_object('title','Synthetic goal','status','agreed','detail','Original agreement')),'trajectory',jsonb_build_array(jsonb_build_object('label','Synthetic phase','detail','Original phase')));
 if not private.valid_roadmap_phase_plan(p) then raise exception 'Legacy roadmap rejected';end if;
 p:=jsonb_set(p,'{trajectory,0,plan_status}','"ready"');
 if private.valid_roadmap_phase_plan(p) then raise exception 'Incomplete reviewed phase accepted';end if;
 t:=p->'trajectory'->0;foreach k in array array['purpose','training','nutrition','activity','recovery','progress_when','hold_when'] loop t:=t||jsonb_build_object(k,'Synthetic recorded decision');end loop;
 t:=t||jsonb_build_object('review_on','2026-11-23');p:=jsonb_set(p,'{trajectory,0}',t);
 if not private.valid_roadmap_phase_plan(p) then raise exception 'Complete reviewed planning rejected';end if;
 if private.valid_roadmap_phase_plan(jsonb_set(p,'{trajectory,0,review_on}','"2026-02-30"')) then raise exception 'Impossible date accepted';end if;
 if private.valid_roadmap_phase_plan(jsonb_set(p,'{goals,0,measure_status}','"invented"')) then raise exception 'Invalid agreement status accepted';end if;
 if private.valid_roadmap_phase_plan(jsonb_set(p,'{trajectory,0,training}','null')) then raise exception 'Null decision accepted';end if;
 if private.valid_roadmap_phase_plan(jsonb_set(p,'{trajectory,0,training}',to_jsonb(repeat('x',1201)))) then raise exception 'Oversized decision accepted';end if;
end $$;
select 'PASS: optional legacy support, complete coach-reviewed fields, valid dates, agreement states, null/type/length rejection; no data writes' result;
rollback;

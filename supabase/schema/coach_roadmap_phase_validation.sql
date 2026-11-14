-- Validate optional private decision fields without changing client prescriptions.
create or replace function private.valid_roadmap_phase_plan(p jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare g jsonb;t jsonb;k text;d date;keys text[]:=array['purpose','training','nutrition','activity','recovery','progress_when','hold_when'];
begin
 if jsonb_typeof(p->'goals') is distinct from 'array' or jsonb_typeof(p->'trajectory') is distinct from 'array' then return false;end if;
 for g in select value from jsonb_array_elements(p->'goals') loop
  foreach k in array array['success_measure','time_horizon'] loop
   if g?k and (jsonb_typeof(g->k) is distinct from 'string' or length(g->>k)>case when k='success_measure' then 1000 else 200 end) then return false;end if;
  end loop;
  if g?'measure_status' and coalesce(g->>'measure_status','') not in ('proposed','agreed') then return false;end if;
 end loop;
 for t in select value from jsonb_array_elements(p->'trajectory') loop
  foreach k in array keys loop if t?k and (jsonb_typeof(t->k) is distinct from 'string' or length(t->>k)>1200) then return false;end if;end loop;
  if t?'plan_status' and coalesce(t->>'plan_status','') not in ('proposed','ready','paused','complete') then return false;end if;
  if t?'kind' and coalesce(t->>'kind','') not in ('review','foundation','build','deload','maintenance') then return false;end if;
  if t?'review_on' and (jsonb_typeof(t->'review_on') is distinct from 'string') then return false;end if;
  if coalesce(t->>'review_on','')<>'' then
   if t->>'review_on' !~ '^\d{4}-\d{2}-\d{2}$' then return false;end if;
   begin d:=(t->>'review_on')::date;exception when others then return false;end;
  end if;
  if t->>'plan_status'='ready' then
   if coalesce(t->>'review_on','')='' then return false;end if;
   foreach k in array keys loop if length(trim(coalesce(t->>k,'')))=0 then return false;end if;end loop;
  end if;
 end loop;return true;
end $$;
revoke all on function private.valid_roadmap_phase_plan(jsonb) from public,anon;
grant execute on function private.valid_roadmap_phase_plan(jsonb) to authenticated;
alter table public.coach_client_roadmaps add constraint private_phase_plan_complete check(private.valid_roadmap_phase_plan(payload)) not valid;
alter table public.coach_client_roadmaps validate constraint private_phase_plan_complete;
notify pgrst,'reload schema';

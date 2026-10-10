begin;
create temp table launch_accounts as
 select c.id,c.profile_id,c.coach_id,c.display_name from public.clients c
 join public.profiles p on p.id=c.profile_id
 where c.status in ('active','ending') and p.role='client';
create temp table launch_tables as
 select distinct c.table_name from information_schema.columns c
 join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
 where c.table_schema='public' and c.column_name='client_id' and t.table_type='BASE TABLE';
create temp table launch_results(client_name text,checks int);
grant select on launch_accounts,launch_tables to authenticated;
grant insert on launch_results to authenticated;
set local role authenticated;
do $$ declare a record; t record; n int; checks int; begin
 for a in select * from launch_accounts loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a.profile_id,'role','authenticated')::text,true);
  checks:=0;
  for t in select * from launch_tables loop
   if has_table_privilege('authenticated','public.'||quote_ident(t.table_name),'SELECT') then
    execute format('select count(*) from public.%I where client_id<>$1',t.table_name) into n using a.id;
    if n<>0 then raise exception 'Peer data visible: % / %',a.display_name,t.table_name;end if;
    checks:=checks+1;
   end if;
  end loop;
  select count(*) into n from public.clients where id<>a.id;
  if n<>0 then raise exception 'Peer client profile visible';end if;
  select count(*) into n from public.profiles where id<>a.profile_id;
  if n<>0 then raise exception 'Peer or coach account visible';end if;
  select count(*) into n from public.coach_notes;
  if n<>0 then raise exception 'Private coach notes visible';end if;
  select count(*) into n from public.program_weeks where not published;
  if n<>0 then raise exception 'Unpublished week visible';end if;
  select count(*) into n from public.training_programs where status='draft';
  if n<>0 then raise exception 'Draft training visible';end if;
  insert into launch_results values(a.display_name,checks+5);
 end loop;
end $$;
reset role;
do $$ declare t record; r text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  foreach r in array array['anon','authenticated'] loop
   if has_table_privilege(r,'public.'||quote_ident(t.tablename),'TRUNCATE') or
      has_table_privilege(r,'public.'||quote_ident(t.tablename),'TRIGGER') then
     raise exception 'Unnecessary bulk privilege: % / %',r,t.tablename;
   end if;
  end loop;
 end loop;
end $$;
select client_name,checks,'PASS: scoped reads, private notes, draft visibility and bulk privileges' result from launch_results order by client_name;
rollback;

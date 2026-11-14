-- Run in an explicit transaction with SET LOCAL legal_edge.recovery_coach = '<assigned coach UUID>'.
-- Replays the latest snapshot into temporary tables only. The final ROLLBACK removes them.
-- Auth identities, credentials, uploaded file bytes and platform recovery are outside this drill.
set local statement_timeout = '45s';
create temporary table recovery_drill_result(result jsonb) on commit drop;
do $$
declare
 coach uuid := nullif(current_setting('legal_edge.recovery_coach',true),'')::uuid;
 bundle jsonb; stored_hash text; item record; original regclass; original_schema text;
 columns text; expected jsonb; actual jsonb; recovered_rows bigint := 0; recovered_tables int := 0;
 fk record; join_clause text; nonnull_clause text; missing bigint; checked_fks int := 0;
begin
 if coach is null then raise exception 'Explicit assigned coach scope required'; end if;
 select payload,sha256 into bundle,stored_hash from app_private.coaching_backup_snapshots
 where coach_id=coach order by backup_date desc limit 1;
 if bundle is null or bundle->>'coach_id'<>coach::text then raise exception 'Scoped snapshot unavailable'; end if;
 if encode(extensions.digest(bundle::text,'sha256'),'hex') is distinct from stored_hash then raise exception 'Snapshot hash mismatch'; end if;
 for item in select key,value from jsonb_each(bundle->'tables') loop
  original_schema := case when item.key='checkin_revisions' then 'app_private' else 'public' end;
  original := to_regclass(format('%I.%I',original_schema,item.key));
  if original is null or jsonb_typeof(item.value)<>'array' then raise exception 'Unsupported snapshot collection %',item.key; end if;
  execute format('create temporary table %I (like %s including all) on commit drop','recover_'||item.key,original);
  select string_agg(format('%I',attname),',' order by attnum) into columns from pg_attribute
  where attrelid=original and attnum>0 and not attisdropped and attgenerated='';
  execute format('insert into pg_temp.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::%s,$1)',
    'recover_'||item.key,columns,columns,original) using item.value;
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]'') from pg_temp.%I r','recover_'||item.key) into actual;
  select coalesce(jsonb_agg(value order by value::text),'[]') into expected from jsonb_array_elements(item.value);
  if actual is distinct from expected then raise exception 'Recovery round-trip mismatch in %',item.key; end if;
  recovered_rows := recovered_rows+jsonb_array_length(actual); recovered_tables := recovered_tables+1;
 end loop;
 -- LIKE copies checks and unique indexes, but not foreign keys. Verify all references between included collections explicitly.
 for fk in select con.conkey,con.confkey,con.conrelid,con.confrelid,child.relname child_name,parent.relname parent_name
  from pg_constraint con join pg_class child on child.oid=con.conrelid join pg_class parent on parent.oid=con.confrelid
  where con.contype='f' and con.conrelid in(select to_regclass(format('%I.%I',case when key='checkin_revisions' then 'app_private' else 'public' end,key)) from jsonb_each(bundle->'tables'))
   and con.confrelid in(select to_regclass(format('%I.%I',case when key='checkin_revisions' then 'app_private' else 'public' end,key)) from jsonb_each(bundle->'tables')) loop
  select string_agg(format('c.%I=p.%I',c.attname,p.attname),' and ' order by k.ord),
         string_agg(format('c.%I is not null',c.attname),' and ' order by k.ord)
   into join_clause,nonnull_clause from unnest(fk.conkey,fk.confkey) with ordinality as k(cnum,pnum,ord)
   join pg_attribute c on c.attrelid=fk.conrelid and c.attnum=k.cnum
   join pg_attribute p on p.attrelid=fk.confrelid and p.attnum=k.pnum;
  execute format('select count(*) from pg_temp.%I c where %s and not exists(select 1 from pg_temp.%I p where %s)',
   'recover_'||fk.child_name,nonnull_clause,'recover_'||fk.parent_name,join_clause) into missing;
  if missing>0 then raise exception 'Missing recovery references between % and % (% rows)',fk.child_name,fk.parent_name,missing; end if;
  checked_fks := checked_fks+1;
 end loop;
 insert into recovery_drill_result values(jsonb_build_object('hash_verified',true,'tables_recovered',recovered_tables,
  'rows_recovered',recovered_rows,'included_foreign_keys_checked',checked_fks,'production_records_changed',0));
end $$;
select result from recovery_drill_result;
rollback;

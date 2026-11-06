-- Notify the existing authenticated channel about saved reports and received health data.
-- Existing row-level policies continue to restrict which records each account can read.
do $$
declare target_table text;
begin
  foreach target_table in array array['client_files','client_health_daily','client_health_imports'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = target_table and c.relrowsecurity
    ) or not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = target_table and p.cmd in ('ALL','SELECT')
    ) then
      raise exception 'Table % must have row-level security and a read policy before Realtime is enabled', target_table;
    end if;
    if not exists (
      select 1 from pg_publication_tables p
      where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end;
$$;

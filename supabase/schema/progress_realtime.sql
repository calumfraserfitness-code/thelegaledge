-- Deliver saved weigh-in changes through the existing authenticated Realtime channel.
-- Existing progress_access RLS remains the authorization boundary.
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'progress_entries' and c.relrowsecurity
  ) then
    raise exception 'Progress entries must have row-level security before Realtime is enabled';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'progress_entries'
  ) then
    alter publication supabase_realtime add table public.progress_entries;
  end if;
end;
$$;

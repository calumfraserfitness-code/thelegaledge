-- RLS does not filter TRUNCATE. Client-facing roles only need row CRUD.
revoke truncate, trigger, references on all tables in schema public from public, anon, authenticated;

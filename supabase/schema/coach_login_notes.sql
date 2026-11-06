-- Historical supplied passwords only. This never changes or reads Auth passwords.
create table if not exists private.coach_login_note_audit (
 id bigint generated always as identity primary key,
 coach_id uuid not null, client_id uuid not null, action text not null,
 created_at timestamptz not null default now()
);
alter table private.coach_login_note_audit enable row level security;
revoke all on private.coach_login_note_audit from public,anon,authenticated;
create or replace function private.coach_login_note(p_client uuid,p_action text,p_password text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.clients; sid uuid; secret_name text; result jsonb;
begin
 if auth.uid() is null or not private.is_coach() then raise exception 'Coach access required' using errcode='42501'; end if;
 select * into c from public.clients where id=p_client and coach_id=auth.uid() and status='active' and deleted_at is null and portal_enabled=true;
 if c.id is null or c.profile_id is null or not exists(select 1 from public.profiles p where p.id=c.profile_id and p.role='client' and lower(p.email)=lower(c.email)) then raise exception 'Verified assigned client required' using errcode='42501'; end if;
 secret_name := 'coach_login_note_'||auth.uid()::text||'_'||c.id::text;
 perform pg_advisory_xact_lock(hashtextextended(secret_name,0));
 select id into sid from vault.secrets where name=secret_name;
 if p_action='status' then return jsonb_build_object('saved',sid is not null,'verification','unverified'); end if;
 if p_action='save' then
  if p_password is null or length(p_password)<1 or length(p_password)>256 then raise exception 'Enter a supplied password of up to 256 characters'; end if;
  if sid is null then perform vault.create_secret(p_password,secret_name,'Coach-supplied login note; unverified; not an Auth credential lookup');
  else perform vault.update_secret(sid,p_password); end if;
  result:=jsonb_build_object('saved',true,'verification','unverified');
 elsif p_action='reveal' then
  select jsonb_build_object('saved',true,'password',decrypted_secret,'verification','unverified') into result from vault.decrypted_secrets where id=sid;
  result:=coalesce(result,jsonb_build_object('saved',false,'verification','unverified'));
 else raise exception 'Unsupported login note action'; end if;
 insert into private.coach_login_note_audit(coach_id,client_id,action) values(auth.uid(),c.id,p_action);
 return result;
end $$;
revoke all on function private.coach_login_note(uuid,text,text) from public,anon,authenticated;
grant execute on function private.coach_login_note(uuid,text,text) to authenticated;
create or replace function public.coach_login_note(p_client uuid,p_action text,p_password text default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.coach_login_note(p_client,p_action,p_password) $$;
revoke all on function public.coach_login_note(uuid,text,text) from public,anon;
grant execute on function public.coach_login_note(uuid,text,text) to authenticated;

-- Recoverable removal: detach the login so existing JWTs cannot access client RLS rows.
alter table public.clients add column if not exists deleted_at timestamptz;
create table if not exists private.removed_client_accounts (
 client_id uuid primary key references public.clients(id) on delete cascade,
 profile_id uuid, previous_status text, previous_archived_at timestamptz,
 previous_portal_enabled boolean, removed_by uuid not null, removed_at timestamptz not null default now()
);
revoke all on private.removed_client_accounts from public, anon, authenticated;
alter table public.clients add constraint removed_client_has_no_portal check (deleted_at is null or (profile_id is null and portal_enabled=false));
create or replace function public.manage_client_account(p_client uuid, p_action text, p_confirmation text)
returns public.clients language plpgsql security definer set search_path='' as $$
declare c public.clients; saved private.removed_client_accounts;
begin
 if auth.uid() is null or not private.is_coach() then raise exception 'Coach access required' using errcode='42501'; end if;
 select * into c from public.clients where id=p_client and coach_id=auth.uid() for update;
 if not found then raise exception 'Client not found for this coach' using errcode='42501'; end if;
 if p_confirmation is distinct from c.display_name then raise exception 'Type the client name exactly to confirm'; end if;
 if p_action='remove' then
  if c.deleted_at is not null then return c; end if;
  if c.profile_id=auth.uid() or exists(select 1 from public.profiles p where p.id=c.profile_id and p.role<>'client') then raise exception 'Only client accounts can be removed'; end if;
  insert into private.removed_client_accounts(client_id,profile_id,previous_status,previous_archived_at,previous_portal_enabled,removed_by)
   values(c.id,c.profile_id,c.status,c.archived_at,c.portal_enabled,auth.uid());
  update public.clients set profile_id=null,portal_enabled=false,status='archived',archived_at=now(),deleted_at=now() where id=c.id returning * into c;
 elsif p_action='restore' then
  select * into saved from private.removed_client_accounts where client_id=c.id;
  if not found or c.deleted_at is null then raise exception 'This account is not removed'; end if;
  if saved.profile_id is not null and not exists(select 1 from public.profiles where id=saved.profile_id and role='client') then raise exception 'Original login is unavailable. Contact support before restoring'; end if;
  update public.clients set profile_id=saved.profile_id,portal_enabled=coalesce(saved.previous_portal_enabled,false),status=saved.previous_status,archived_at=saved.previous_archived_at,deleted_at=null where id=c.id returning * into c;
  delete from private.removed_client_accounts where client_id=c.id;
 else raise exception 'Unsupported account action'; end if;
 return c;
end $$;
revoke all on function public.manage_client_account(uuid,text,text) from public,anon;
grant execute on function public.manage_client_account(uuid,text,text) to authenticated;

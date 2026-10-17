-- Preserve existing notes outside the client-readable profile row.
create table public.client_private_details (
 client_id uuid primary key references public.clients(id) on delete cascade,
 coach_notes text,
 updated_at timestamptz not null default now()
);
alter table public.client_private_details enable row level security;
revoke all on public.client_private_details from public,anon,authenticated;
grant select,insert,update,delete on public.client_private_details to authenticated;
grant all on public.client_private_details to service_role;
create policy private_details_coach on public.client_private_details for all to authenticated
 using ((select private.is_coach()) and (select private.can_access_client(client_id)))
 with check ((select private.is_coach()) and (select private.can_access_client(client_id)));
insert into public.client_private_details(client_id,coach_notes)
 select id,coach_notes from public.clients where coach_notes is not null;
update public.clients set coach_notes=null where coach_notes is not null;

-- Keep the existing coach save atomic while ensuring its returned profile is safe.
create function private.route_client_profile_notes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.coach_notes is not null then
  if auth.uid() is not null and not (private.is_coach() and private.can_access_client(old.id)) then
   raise exception 'Assigned coach required';
  end if;
  insert into public.client_private_details(client_id,coach_notes,updated_at)
   values(old.id,new.coach_notes,now())
   on conflict(client_id) do update set coach_notes=excluded.coach_notes,updated_at=excluded.updated_at;
  new.coach_notes:=null;
 end if;
 return new;
end $$;
revoke all on function private.route_client_profile_notes() from public,anon,authenticated;
create trigger route_client_profile_notes before update on public.clients
 for each row execute function private.route_client_profile_notes();
alter table public.clients add constraint client_notes_are_private check(coach_notes is null);

create or replace function public.guard_firm_participant_capacity() returns trigger language plpgsql security invoker set search_path='' as $$
declare pilot public.firm_pilots; occupied integer;
begin
 select * into pilot from public.firm_pilots where id=new.pilot_id for update;
 if not found then raise exception 'Pilot not available'; end if;
 if not exists(select 1 from public.clients where id=new.client_id and coach_id=pilot.coach_id) then raise exception 'Participant must belong to the pilot coach'; end if;
 if new.status <> 'withdrawn' then
  if pilot.status='complete' then raise exception 'This pilot is complete'; end if;
  select count(*) into occupied from public.firm_participants where pilot_id=new.pilot_id and status<>'withdrawn' and id<>new.id;
  if occupied>=pilot.capacity then raise exception 'Pilot is full'; end if;
 end if;
 return new;
end $$;
drop trigger if exists guard_firm_participant_capacity on public.firm_participants;
create trigger guard_firm_participant_capacity before insert or update on public.firm_participants for each row execute function public.guard_firm_participant_capacity();
create or replace function public.guard_firm_pilot_capacity() returns trigger language plpgsql security invoker set search_path='' as $$
declare employees integer;
begin
 select employee_count into employees from public.firm_organizations where id=new.organization_id;
 if employees is not null and new.capacity>employees then raise exception 'Pilot places cannot exceed firm employees'; end if;
 if new.capacity<(select count(*) from public.firm_participants where pilot_id=new.id and status<>'withdrawn') then raise exception 'Capacity cannot be below the active roster'; end if;
 return new;
end $$;
drop trigger if exists guard_firm_pilot_capacity on public.firm_pilots;
create trigger guard_firm_pilot_capacity before insert or update on public.firm_pilots for each row execute function public.guard_firm_pilot_capacity();


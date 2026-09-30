create or replace function public.guard_firm_assessment_window() returns trigger language plpgsql security invoker set search_path='' as $$
declare launch date; finish date; member_status text;
begin
 select p.start_date,p.end_date,m.status into launch,finish,member_status
 from public.firm_participants m join public.firm_pilots p on p.id=m.pilot_id
 where m.id=new.participant_id and m.client_id=new.client_id;
 if not found or member_status='withdrawn' then raise exception 'Participant not available'; end if;
 if new.phase='midpoint' and (launch is null or current_date<launch+35) then raise exception 'Midpoint assessment opens in week six'; end if;
 if new.phase='endline' and (coalesce(finish,launch+84) is null or current_date<coalesce(finish,launch+84)-7) then raise exception 'Endline assessment opens in the final week'; end if;
 return new;
end $$;
drop trigger if exists guard_firm_assessment_window on public.firm_assessments;
create trigger guard_firm_assessment_window before insert or update on public.firm_assessments for each row execute function public.guard_firm_assessment_window();


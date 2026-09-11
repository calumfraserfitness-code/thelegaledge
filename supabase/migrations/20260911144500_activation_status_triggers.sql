create or replace function private.advance_client_activation()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_table_name='legal_consents' then
    update public.clients set onboarding_status='pending_onboarding', updated_at=now()
    where id=new.client_id and onboarding_status='pending_legal';
  elsif tg_table_name='onboarding_responses' then
    update public.clients set onboarding_status='complete', onboarding_completed_at=coalesce(new.completed_at,new.submitted_at,now()), plan_status='coach_building', updated_at=now()
    where id=new.client_id;
  end if;
  return new;
end $$;
revoke all on function private.advance_client_activation() from public, anon, authenticated;
drop trigger if exists legal_advances_activation on public.legal_consents;
create trigger legal_advances_activation after insert on public.legal_consents for each row execute function private.advance_client_activation();
drop trigger if exists onboarding_advances_activation on public.onboarding_responses;
create trigger onboarding_advances_activation after insert on public.onboarding_responses for each row execute function private.advance_client_activation();

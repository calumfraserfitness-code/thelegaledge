create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    case when lower(new.email) = 'calumfraserfitness@gmail.com' then 'coach'::public.user_role else 'client'::public.user_role end,
    case when lower(new.email) = 'calumfraserfitness@gmail.com' then 'Calum Fraser' else coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) end,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

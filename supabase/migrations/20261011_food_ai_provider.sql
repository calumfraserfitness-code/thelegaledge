create or replace function public.food_ai_secret(p_coach uuid,p_secret text default null) returns text
language plpgsql security definer set search_path='' as $$
declare secret_id uuid; value text;
begin
 select id into secret_id from vault.secrets where name='food_ai_'||p_coach::text;
 if p_secret is not null then
  if length(p_secret)<20 or length(p_secret)>512 then raise exception 'Invalid provider key'; end if;
  if secret_id is null then perform vault.create_secret(p_secret,'food_ai_'||p_coach::text,'Food Anywhere provider key');
  else perform vault.update_secret(secret_id,p_secret); end if;
  return null;
 end if;
 select decrypted_secret into value from vault.decrypted_secrets where id=secret_id;
 return value;
end $$;
revoke all on function public.food_ai_secret(uuid,text) from public,anon,authenticated;
grant execute on function public.food_ai_secret(uuid,text) to service_role;

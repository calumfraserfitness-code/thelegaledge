create table public.coach_payment_links(id text primary key,coach_id uuid not null references public.profiles(id),label text not null,url text not null check(url ~ '^https://buy\.stripe\.com/'),active boolean not null default true);
alter table public.coach_payment_links enable row level security;
revoke all on public.coach_payment_links from anon,authenticated;
grant select on public.coach_payment_links to authenticated;
create policy coach_payment_links_read on public.coach_payment_links for select to authenticated using(coach_id=auth.uid());
insert into public.coach_payment_links(id,coach_id,label,url)
select v.id,p.id,v.label,v.url from public.profiles p cross join (values
('plink_1UI64QAE4s3jsuNA5mUW5YL0','The Legal Edge Coaching — USD 400 / month','https://buy.stripe.com/cNifZgchR9lXajI6th73G0j'),
('plink_1U4P5gAE4s3jsuNAGMrUJ5KR','Legal Edge — USD 1,000 one-time','https://buy.stripe.com/dRmcN495FgOp2Rg5pd73G0i'),
('plink_1TRFQ7AE4s3jsuNAHKhfRWEs','The Legal Edge Coaching — USD 1,500 one-time','https://buy.stripe.com/5kQ6oG6Xx0Pr9fE5pd73G0h'),
('plink_1TMAGjAE4s3jsuNAtcpWTb6a','The Legal Edge Coaching — USD 500 one-time','https://buy.stripe.com/5kQ4gychRaq1bnM9Ft73G0g')
) v(id,label,url) where p.role='coach' and (select count(*) from public.profiles where role='coach')=1;
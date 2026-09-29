alter table public.firm_organizations
  add column employee_count integer check (employee_count between 1 and 100000);

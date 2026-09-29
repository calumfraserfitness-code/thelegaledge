-- The report runs with coach RLS as well as its explicit owner check.
alter function public.firm_pilot_summary(uuid) security invoker;

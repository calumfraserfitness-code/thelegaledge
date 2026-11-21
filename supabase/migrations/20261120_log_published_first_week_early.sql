-- A completed first-week lift or ride can be recorded before the booked start.
-- Keep normal date gates for future phases and daily mobility/recovery.
do $$
declare
 definition text := pg_get_functiondef('public.save_session_completion(uuid,boolean,jsonb)'::regprocedure);
 old_guard constant text := $old$if not w.published or d<w.week_start or d>w.week_start+6 then raise exception 'Open a published current week to record completion'; end if;$old$;
 new_guard constant text := $new$if not w.published or d>w.week_start+6 or (d<w.week_start and not coalesce(
   c.start_date between w.week_start and w.week_start+6
   and s.training_type::text in ('weights','resistance','cardio'), false)) then
  raise exception 'Open a published current or first week to record completion';
 end if;$new$;
begin
 if position(new_guard in definition)>0 then return; end if;
 if position(old_guard in definition)=0 then raise exception 'Expected session date guard was not found'; end if;
 execute replace(definition,old_guard,new_guard);
end $$;

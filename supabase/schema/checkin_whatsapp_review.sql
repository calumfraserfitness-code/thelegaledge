-- A coach's external WhatsApp reply can complete a review without invented in-app feedback.
alter table public.checkins add column if not exists review_channel text;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.checkins'::regclass and conname='checkins_review_channel_check') then
  alter table public.checkins add constraint checkins_review_channel_check check(review_channel in ('app','whatsapp'));
 end if;
end $$;
comment on column public.checkins.review_channel is 'Coach-confirmed review route. WhatsApp is a manual confirmation, never an app-sent message; NULL leaves historical route unknown.';

-- Clients cannot manufacture coach-review metadata on insertion. Existing coach ownership stays intact.
alter policy checkins_authorized_insert on public.checkins with check (
 (client_id=public.my_client_id() and coach_response is null and voice_note_url is null and reviewed_at is null and review_channel is null)
 or (private.is_coach() and private.can_access_client(client_id))
);

create or replace function public.set_checkin_whatsapp_review(p_checkin uuid,p_reviewed boolean default true)
returns public.checkins language plpgsql security invoker set search_path='' as $$
declare result public.checkins;
begin
 if auth.uid() is null or not private.is_coach() then raise exception 'Only the assigned coach can review a check-in'; end if;
 if p_reviewed is null then raise exception 'Choose whether the WhatsApp review is complete'; end if;
 select * into result from public.checkins where id=p_checkin and private.can_access_client(client_id) for update;
 if result.id is null then raise exception 'Check-in is unavailable for this coach'; end if;
 -- Undo is scoped to an external confirmation; it cannot undo an app review accidentally.
 if not p_reviewed and result.review_channel is distinct from 'whatsapp' then return result; end if;
 update public.checkins set reviewed_at=case when p_reviewed then coalesce(reviewed_at,now()) else null end,
 review_channel=case when p_reviewed then 'whatsapp' else null end
 where id=result.id returning * into result;
 return result;
end $$;
revoke all on function public.set_checkin_whatsapp_review(uuid,boolean) from public,anon;
grant execute on function public.set_checkin_whatsapp_review(uuid,boolean) to authenticated;

-- The existing in-app review API retains its signature and validation.
create or replace function public.save_checkin_review(target_checkin_id uuid,response_text text,video_url text,action_points text,mark_reviewed boolean default false)
returns public.checkins language plpgsql security invoker set search_path='' as $$
declare result public.checkins;
begin
 if not private.is_coach() then raise exception 'Only the assigned coach can review a check-in'; end if;
 if length(coalesce(response_text,''))>20000 or length(coalesce(action_points,''))>10000 then raise exception 'Review is too long'; end if;
 if nullif(trim(video_url),'') is not null and video_url !~ '^https://' then raise exception 'Use a secure HTTPS video link'; end if;
 if mark_reviewed and nullif(trim(response_text),'') is null and nullif(trim(video_url),'') is null then raise exception 'Add a coach response or video before completing the review'; end if;
 update public.checkins set coach_response=nullif(trim(response_text),''),voice_note_url=nullif(trim(video_url),''),focus_next_week=nullif(trim(action_points),''),
 reviewed_at=case when mark_reviewed then now() else null end,review_channel=case when mark_reviewed then 'app' else null end
 where id=target_checkin_id and private.can_access_client(client_id) returning * into result;
 if result.id is null then raise exception 'Check-in is unavailable for this coach'; end if;
 return result;
end $$;
revoke all on function public.save_checkin_review(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.save_checkin_review(uuid,text,text,text,boolean) to authenticated;

-- Keep recovery snapshots. An external confirmation creates no app notification job.
create or replace function private.capture_checkin_event() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.clients;begin
 if tg_op='DELETE' then insert into app_private.checkin_revisions(checkin_id,client_id,operation,snapshot) values(old.id,old.client_id,'DELETE',to_jsonb(old));return old;end if;
 if tg_op='UPDATE' then insert into app_private.checkin_revisions(checkin_id,client_id,operation,snapshot) values(old.id,old.client_id,'BEFORE_UPDATE',to_jsonb(old));end if;
 insert into app_private.checkin_revisions(checkin_id,client_id,operation,snapshot) values(new.id,new.client_id,tg_op,to_jsonb(new));
 select * into c from public.clients where id=new.client_id;
 if tg_op='INSERT' and c.coach_id is not null and auth.uid()=c.profile_id then
  insert into public.coaching_notification_jobs(recipient_id,checkin_id,kind,event_key) values(c.coach_id,new.id,'checkin','checkin:'||new.id) on conflict(event_key) do nothing;
 elsif tg_op='UPDATE' and new.reviewed_at is not null and new.review_channel is distinct from 'whatsapp' and c.profile_id is not null and
  (new.coach_response is distinct from old.coach_response or new.voice_note_url is distinct from old.voice_note_url or old.reviewed_at is null) then
  insert into public.coaching_notification_jobs(recipient_id,checkin_id,kind,event_key)
  values(c.profile_id,new.id,'review','review:'||new.id||':'||md5(coalesce(new.coach_response,'')||coalesce(new.voice_note_url,''))) on conflict(event_key) do nothing;
 end if;return new;end $$;
revoke all on function private.capture_checkin_event() from public,anon,authenticated;

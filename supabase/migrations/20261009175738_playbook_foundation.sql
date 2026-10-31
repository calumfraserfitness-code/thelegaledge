-- Additive Playbook: existing coaching content, private client activity, explicit coach options.
alter table public.coaching_start_resources
 add column slug text,
 add column description text not null default '',
 add column category text not null default 'Consistency',
 add column quick_answer text not null default '',
 add column action_kind text not null default 'bookmark' check(action_kind in ('bookmark','workout','meal','training','nutrition','planner','support','travel','health','progress')),
 add column video_script text not null default '',
 add column slide_outline jsonb not null default '[]',
 add column evidence jsonb not null default '[]',
 add column safety text not null default '',
 add column related_slugs text[] not null default '{}',
 add column keywords text not null default '',
 add column review_status text not null default 'draft' check(review_status in ('draft','reviewed')),
 add column reviewed_at timestamptz,
 add column video_path text,
 add column slides_path text,
 add column pdf_path text,
 add column thumbnail_path text,
 add column captions_path text,
 add column transcript text not null default '',
 add column archived boolean not null default false,
 add column updated_at timestamptz not null default now(),
 add column search_document tsvector generated always as (to_tsvector('english',coalesce(title,'')||' '||coalesce(description,'')||' '||coalesce(quick_answer,'')||' '||coalesce(keywords,''))) stored;
create unique index coaching_resource_slug on public.coaching_start_resources(coach_id,slug) where slug is not null;
create index coaching_resource_search on public.coaching_start_resources using gin(search_document);
create index coaching_resource_visibility on public.coaching_start_resources(coach_id,published,archived,category);
create table public.playbook_revisions(id uuid primary key default gen_random_uuid(),resource_id uuid not null references public.coaching_start_resources(id),coach_id uuid not null references public.profiles(id),snapshot jsonb not null,created_at timestamptz not null default now());
alter table public.playbook_revisions enable row level security;
grant select on public.playbook_revisions to authenticated;
create policy revisions_coach on public.playbook_revisions for select to authenticated using(coach_id=(select auth.uid()) and private.is_coach());
create function private.playbook_revision() returns trigger language plpgsql security definer set search_path='' as $$begin
 new.updated_at=now();
 if TG_OP='UPDATE' then insert into public.playbook_revisions(resource_id,coach_id,snapshot) values(old.id,old.coach_id,to_jsonb(old)-'search_document'); end if;
 if exists(select 1 from unnest(array[new.video_path,new.pdf_path,new.slides_path,new.thumbnail_path,new.captions_path]) path where path is not null and path not like new.coach_id::text||'/'||new.id::text||'/%') then raise exception 'Media must belong to this resource';end if;
 if new.published and new.quick_answer<>'' and new.review_status<>'reviewed' then raise exception 'Review the resource before publishing'; end if;
 return new;end$$;
create trigger playbook_resource_revision before insert or update on public.coaching_start_resources for each row execute function private.playbook_revision();

create table public.playbook_bookmarks(client_id uuid not null references public.clients(id),resource_id uuid not null references public.coaching_start_resources(id),created_at timestamptz not null default now(),primary key(client_id,resource_id));
create table public.playbook_feedback(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id),resource_id uuid not null references public.coaching_start_resources(id),helpful boolean not null,comment text not null default '' check(length(comment)<=2000),created_at timestamptz not null default now(),unique(client_id,resource_id));
create table public.playbook_events(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id),resource_id uuid references public.coaching_start_resources(id),kind text not null check(kind in ('open','action','search','video')),query text check(length(query)<=200),created_at timestamptz not null default now());
create table public.playbook_recommendations(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id),resource_id uuid not null references public.coaching_start_resources(id),coach_id uuid not null references public.profiles(id),reason text not null default '' check(length(reason)<=500),dismissed_at timestamptz,created_at timestamptz not null default now(),unique(client_id,resource_id));
create index playbook_events_client_date on public.playbook_events(client_id,created_at desc);
create index playbook_events_resource_date on public.playbook_events(resource_id,created_at desc);
create index playbook_feedback_client on public.playbook_feedback(client_id);
create index playbook_recs_client on public.playbook_recommendations(client_id);
alter table public.playbook_bookmarks enable row level security;
grant select,insert on public.playbook_bookmarks to authenticated;
create policy playbook_bookmarks_read on public.playbook_bookmarks for select to authenticated using(private.can_access_client(client_id));
create policy playbook_bookmarks_write on public.playbook_bookmarks for insert to authenticated with check(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())) and (resource_id is null or exists(select 1 from public.coaching_start_resources r where r.id=resource_id and r.published and not r.archived)));
alter table public.playbook_feedback enable row level security;
grant select,insert on public.playbook_feedback to authenticated;
create policy playbook_feedback_read on public.playbook_feedback for select to authenticated using(private.can_access_client(client_id));
create policy playbook_feedback_write on public.playbook_feedback for insert to authenticated with check(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())) and (resource_id is null or exists(select 1 from public.coaching_start_resources r where r.id=resource_id and r.published and not r.archived)));
alter table public.playbook_events enable row level security;
grant select,insert on public.playbook_events to authenticated;
create policy playbook_events_read on public.playbook_events for select to authenticated using(private.can_access_client(client_id));
create policy playbook_events_write on public.playbook_events for insert to authenticated with check(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())) and (resource_id is null or exists(select 1 from public.coaching_start_resources r where r.id=resource_id and r.published and not r.archived)));
grant delete on public.playbook_bookmarks to authenticated;
create policy bookmarks_delete on public.playbook_bookmarks for delete to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())));
grant update(helpful,comment) on public.playbook_feedback to authenticated;
create policy feedback_update on public.playbook_feedback for update to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid()))) with check(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())));
alter table public.playbook_recommendations enable row level security;
grant select,insert,delete on public.playbook_recommendations to authenticated;
grant update(dismissed_at) on public.playbook_recommendations to authenticated;
create policy rec_read on public.playbook_recommendations for select to authenticated using(private.can_access_client(client_id));
create policy rec_write on public.playbook_recommendations for insert to authenticated with check(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid())) and exists(select 1 from public.coaching_start_resources r where r.id=resource_id and r.coach_id=(select auth.uid()) and r.published and not r.archived));
create policy rec_dismiss on public.playbook_recommendations for update to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid()))) with check(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())));
create policy rec_delete on public.playbook_recommendations for delete to authenticated using(coach_id=(select auth.uid()) and private.is_coach());

create function private.playbook_prescription(p_session uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce((select jsonb_agg(to_jsonb(e) order by e.sort_order,e.id) from public.program_exercises e join public.training_sessions s on s.programme_day_id=e.program_day_id where s.id=p_session), (select jsonb_agg(to_jsonb(e) order by e.sort_order,e.id) from public.exercises e where e.session_id=p_session),'[]'::jsonb)
$$;
grant execute on function private.playbook_prescription(uuid) to authenticated;
create table public.playbook_workout_options(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id),coach_id uuid not null references public.profiles(id),session_id uuid not null references public.training_sessions(id),minutes integer not null check(minutes in (10,20,30,60)),location text not null check(location in ('gym','home','hotel')),energy text not null check(energy in ('good','tired')),exercises jsonb not null check(jsonb_typeof(exercises)='array'),note text not null default '',source_digest text not null default '',approved boolean not null default true,created_at timestamptz not null default now(),unique(session_id,minutes,location,energy));
create index playbook_options_client on public.playbook_workout_options(client_id,session_id);
alter table public.playbook_workout_options enable row level security;
grant select,insert,update,delete on public.playbook_workout_options to authenticated;
create policy options_read on public.playbook_workout_options for select to authenticated using(private.can_access_client(client_id));
create policy options_manage on public.playbook_workout_options for all to authenticated using(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.clients c where c.id=client_id and c.coach_id=(select auth.uid()))) with check(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.clients c join public.program_weeks w on w.client_id=c.id join public.training_sessions s on s.week_id=w.id where c.id=playbook_workout_options.client_id and c.coach_id=(select auth.uid()) and s.id=playbook_workout_options.session_id));
create function private.validate_playbook_option() returns trigger language plpgsql security invoker set search_path='' as $$declare baseline jsonb; chosen jsonb; original jsonb;begin
 baseline=private.playbook_prescription(new.session_id);
 if jsonb_array_length(new.exercises)=0 then raise exception 'Select at least one assigned exercise'; end if;
 if (select count(*) from jsonb_array_elements(new.exercises))<>(select count(distinct x->>'id') from jsonb_array_elements(new.exercises)x) then raise exception 'Duplicate exercise';end if;
 for chosen in select value from jsonb_array_elements(new.exercises) loop
 select value into original from jsonb_array_elements(baseline) where value->>'id'=chosen->>'id';
 if original is null or (chosen->>'sets')::int<1 or (chosen->>'sets')::int>coalesce((original->>'sets')::int,1) then raise exception 'Option must use assigned exercises and no additional sets';end if;
 end loop;
 new.source_digest=md5(baseline::text); return new;end$$;
create trigger playbook_option_validate before insert or update on public.playbook_workout_options for each row execute function private.validate_playbook_option();
create table public.playbook_workout_history(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id),session_id uuid not null references public.training_sessions(id),option_id uuid references public.playbook_workout_options(id),original jsonb not null,adjusted jsonb not null,note text not null default '',active boolean not null default true,created_at timestamptz not null default now(),restored_at timestamptz);
create index playbook_history_client on public.playbook_workout_history(client_id,created_at desc);
alter table public.playbook_workout_history enable row level security;
grant select on public.playbook_workout_history to authenticated;
create policy history_read on public.playbook_workout_history for select to authenticated using(private.can_access_client(client_id));
-- Privileged insert is deliberately confined to a scoped RPC: clients cannot write prescriptions directly.
create function private.accept_playbook_workout(p_option uuid) returns uuid language plpgsql security definer set search_path='' as $$declare opt public.playbook_workout_options;baseline jsonb;adjusted jsonb;result uuid;begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select o.* into opt from public.playbook_workout_options o join public.clients c on c.id=o.client_id join public.training_sessions s on s.id=o.session_id join public.program_weeks w on w.id=s.week_id where o.id=p_option and o.approved and c.profile_id=auth.uid() and w.client_id=c.id and w.published and s.status<>'completed' for update of o;
 if opt.id is null then raise exception 'This option is not available';end if;
 baseline=private.playbook_prescription(opt.session_id);
 if md5(baseline::text)<>opt.source_digest then raise exception 'Your coach changed this session. Ask for a refreshed option.'; end if;
 select jsonb_agg(b.value||jsonb_build_object('sets',(x.value->>'sets')::int) order by b.ord) into adjusted from jsonb_array_elements(baseline) with ordinality b(value,ord) join jsonb_array_elements(opt.exercises) x on x.value->>'id'=b.value->>'id';
 update public.playbook_workout_history set active=false,restored_at=now() where session_id=opt.session_id and client_id=opt.client_id and active;
 insert into public.playbook_workout_history(client_id,session_id,option_id,original,adjusted,note) values(opt.client_id,opt.session_id,opt.id,baseline,adjusted,opt.note) returning id into result;
 return result;end$$;
create function public.accept_playbook_workout(p_option uuid) returns uuid language sql security invoker set search_path='' as $$select private.accept_playbook_workout(p_option)$$;
revoke all on function private.accept_playbook_workout(uuid),public.accept_playbook_workout(uuid) from public,anon;
grant execute on function private.accept_playbook_workout(uuid),public.accept_playbook_workout(uuid) to authenticated;
create function private.restore_playbook_workout(p_history uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 update public.playbook_workout_history h set active=false,restored_at=now() where h.id=p_history and exists(select 1 from public.clients c where c.id=h.client_id and c.profile_id=auth.uid());
 return found;end$$;
create function public.restore_playbook_workout(p_history uuid) returns boolean language sql security invoker set search_path='' as $$select private.restore_playbook_workout(p_history)$$;
revoke all on function private.restore_playbook_workout(uuid),public.restore_playbook_workout(uuid) from public,anon;
grant execute on function private.restore_playbook_workout(uuid),public.restore_playbook_workout(uuid) to authenticated;

create table public.playbook_collections(id uuid primary key default gen_random_uuid(),coach_id uuid not null references public.profiles(id),title text not null,description text not null default '',resource_slugs text[] not null default '{}',published boolean not null default false);
create table public.playbook_collection_assignments(collection_id uuid not null references public.playbook_collections(id),pilot_id uuid not null references public.firm_pilots(id),coach_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),primary key(collection_id,pilot_id));
create table public.playbook_cohort_consents(client_id uuid primary key references public.clients(id),accepted_at timestamptz not null default now());
alter table public.playbook_collections enable row level security;
alter table public.playbook_collection_assignments enable row level security;
alter table public.playbook_cohort_consents enable row level security;
grant select,insert,update,delete on public.playbook_collections,public.playbook_collection_assignments to authenticated;
grant select,insert,delete on public.playbook_cohort_consents to authenticated;
create policy collections_manage on public.playbook_collections for all to authenticated using(coach_id=(select auth.uid()) and private.is_coach()) with check(coach_id=(select auth.uid()) and private.is_coach());
create policy collections_client on public.playbook_collections for select to authenticated using(published and exists(select 1 from public.clients c where c.coach_id=playbook_collections.coach_id and c.profile_id=(select auth.uid())));
create policy collections_assign_manage on public.playbook_collection_assignments for all to authenticated using(coach_id=(select auth.uid()) and private.is_coach()) with check(coach_id=(select auth.uid()) and private.is_coach() and exists(select 1 from public.firm_pilots p where p.id=pilot_id and p.coach_id=(select auth.uid())) and exists(select 1 from public.playbook_collections c where c.id=collection_id and c.coach_id=(select auth.uid())));
create policy collections_assign_client on public.playbook_collection_assignments for select to authenticated using(exists(select 1 from public.firm_participants p join public.clients c on c.id=p.client_id where p.pilot_id=playbook_collection_assignments.pilot_id and c.profile_id=(select auth.uid()) and p.status='active'));
create policy cohort_consent_read on public.playbook_cohort_consents for select to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())));
create policy cohort_consent_insert on public.playbook_cohort_consents for insert to authenticated with check(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())));
create policy cohort_consent_delete on public.playbook_cohort_consents for delete to authenticated using(exists(select 1 from public.clients c where c.id=client_id and c.profile_id=(select auth.uid())));
-- Fixed current-month aggregate only; no client identities, search text or health data leaves this RPC.
create function private.playbook_firm_report(p_pilot uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare p public.firm_pilots;n int;engaged int;helpful int;feedback int;topics jsonb;begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into p from public.firm_pilots where id=p_pilot;
 if p.id is null or not(p.coach_id=auth.uid() and private.is_coach() or exists(select 1 from public.firm_employer_access a where a.organization_id=p.organization_id and a.user_id=auth.uid())) then raise exception 'Access denied';end if;
 select count(distinct f.client_id) into n from public.firm_participants f join public.playbook_cohort_consents cc on cc.client_id=f.client_id where f.pilot_id=p.id and f.status='active';
 if n<greatest(5,coalesce(p.minimum_report_count,5)) then return jsonb_build_object('suppressed',true,'message','Not enough consenting participants to report safely.');end if;
 select count(distinct e.client_id) into engaged from public.playbook_events e join public.firm_participants f on f.client_id=e.client_id join public.playbook_cohort_consents cc on cc.client_id=f.client_id where f.pilot_id=p.id and f.status='active' and e.created_at>=greatest(date_trunc('month',now()),cc.accepted_at,f.joined_at);
 select count(distinct ff.client_id) filter(where ff.helpful),count(distinct ff.client_id) into helpful,feedback from public.playbook_feedback ff join public.firm_participants f on f.client_id=ff.client_id join public.playbook_cohort_consents cc on cc.client_id=f.client_id where f.pilot_id=p.id and f.status='active' and ff.created_at>=greatest(date_trunc('month',now()),cc.accepted_at,f.joined_at);
 select coalesce(jsonb_agg(jsonb_build_object('topic',q.category,'participation_band',q.band)),'[]') into topics from(select r.category,(count(distinct e.client_id)/5)*5 as band from public.playbook_events e join public.coaching_start_resources r on r.id=e.resource_id join public.firm_participants f on f.client_id=e.client_id join public.playbook_cohort_consents cc on cc.client_id=f.client_id where f.pilot_id=p.id and f.status='active' and e.created_at>=greatest(date_trunc('month',now()),cc.accepted_at,f.joined_at) group by r.category having count(distinct e.client_id)>=5)q;
 return jsonb_build_object('suppressed',false,'period',to_char(now(),'YYYY-MM'),'participation_band',case when engaged>=5 and n-engaged>=5 then (engaged/5)*5 else null end,'helpful_band',case when helpful>=5 and feedback-helpful>=5 then (helpful/5)*5 else null end,'topics',topics);end$$;
create function public.playbook_firm_report(p_pilot uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.playbook_firm_report(p_pilot)$$;
revoke all on function private.playbook_firm_report(uuid),public.playbook_firm_report(uuid) from public,anon;
grant execute on function private.playbook_firm_report(uuid),public.playbook_firm_report(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('playbook-media','playbook-media',false,52428800,array['video/mp4','video/quicktime','application/pdf','image/jpeg','image/png','image/webp','text/vtt']) on conflict(id) do nothing;
create policy playbook_media_upload on storage.objects for insert to authenticated with check(bucket_id='playbook-media' and (storage.foldername(name))[1]=(select auth.uid())::text and private.is_coach());
create policy playbook_media_coach_read on storage.objects for select to authenticated using(bucket_id='playbook-media' and (storage.foldername(name))[1]=(select auth.uid())::text and private.is_coach());
create policy playbook_media_coach_delete on storage.objects for delete to authenticated using(bucket_id='playbook-media' and (storage.foldername(name))[1]=(select auth.uid())::text and private.is_coach());
create policy playbook_media_client_read on storage.objects for select to authenticated using(bucket_id='playbook-media' and exists(select 1 from public.coaching_start_resources r where r.published and not r.archived and name in(r.video_path,r.slides_path,r.pdf_path,r.thumbnail_path,r.captions_path)));
notify pgrst,'reload schema';

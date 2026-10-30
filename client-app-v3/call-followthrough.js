/* Private call evidence for coach; only explicitly approved actions for clients. */
(function(){
 'use strict';
 const safeSource=v=>{try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='fathom.video'?u.href:null;}catch{return null;}};
 const stamp=v=>window.CheckinStatus.stamp(v,state.client?.timezone||'Europe/Dublin');
 function clientMount(){
  if(!state.client||!['client','coach'].includes(state.role)||!['today','support'].includes(state.clientView)||state.preview)return;
  const host=$('#clientMain');if(!host)return;const id=state.client.id,user=state.user?.id,role=state.role,view=state.clientView;
  host.querySelector('#cfClient')?.remove();host.querySelector('#cuFocus')?.remove();const box=document.createElement('section');box.id='cfClient';box.className='panel cf-followup';box.innerHTML='<span class="eyebrow">FROM OUR LATEST CALL</span><h2>Your agreed next steps</h2><p role="status">Loading your saved actions…</p>';
  const anchor=host.querySelector('.priority-grid');if(anchor)anchor.before(box);else if(view==='support'&&host.querySelector('#coachContact'))host.querySelector('#coachContact').after(box);else host.append(box);
  const active=()=>box.isConnected&&state.user?.id===user&&state.role===role&&state.client?.id===id&&state.clientView===view;
  const recap=(state.data.coachingGuidance||[]).filter(r=>r.client_id===id&&r.published&&/^Call recap · \d{4}-\d{2}-\d{2}$/.test(r.title)).sort((a,b)=>b.title.localeCompare(a.title))[0];
  async function load(){try{
   let date;try{date=window.CheckinStatus.localDate(new Date(),state.client.timezone||'Europe/Dublin');}catch{throw Error('Your timezone needs coach setup.');}
   const rows=await query('Agreed call actions',db.from('client_weekly_focus').select('id,client_id,description,starts_on,expires_on,completed_at,approved_at').eq('client_id',id).is('archived_at',null).lte('starts_on',date).gte('expires_on',date).order('approved_at',{ascending:false}).limit(100));if(!active())return;
   if(rows.some(r=>r.client_id!==id))throw Error('Action ownership could not be verified.');
   const canComplete=state.role==='client'&&state.client.profile_id===user;
   if(view==='today'){
    box.innerHTML='<span class="eyebrow">YOUR COACHING</span><h2>'+rows.filter(r=>!r.completed_at).length+' agreed actions open</h2><p>'+(recap?'Latest call · '+esc(recap.title.slice(13)):'See your saved feedback and next steps in Coach.')+'</p><button type="button" class="btn primary" data-cf-open-coach>Open Coach</button>';
    box.querySelector('[data-cf-open-coach]').onclick=()=>{if(!active())return;state.clientView='support';renderClient();};return;
   }
   host.querySelectorAll('.cw-guidance article').forEach(article=>{if(/^Call recap · /.test(article.querySelector('h3')?.textContent||''))article.remove();});
   box.innerHTML='<div class="panel-head"><div><span class="eyebrow">FROM OUR LATEST CALL</span><h2>Your agreed next steps</h2></div><button type="button" class="btn ghost small" data-cf-refresh>Refresh</button></div>'+(recap?'<p class="cf-date">Call · '+esc(recap.title.slice(13))+'</p><p class="cw-lines">'+esc(recap.body)+'</p>':'')+(rows.length?'<div class="cf-actions">'+rows.map(r=>'<label><input type="checkbox" data-cf-action="'+esc(r.id)+'" '+(r.completed_at?'checked ':'')+(!canComplete?'disabled':'')+'><span>'+esc(r.description)+'<small>'+ (r.completed_at?'Marked complete':'Agreed action')+' · review period ends '+esc(r.expires_on)+'</small></span></label>').join('')+'</div>':'<p>No current actions have been published. This does not mean your call was missed or your plan changed.</p>')+(rows.length===100?'<p>Showing up to 100 actions. Ask your coach if anything appears missing.</p>':'')+'<p class="cf-status" role="status"></p><div class="cf-links"><button type="button" class="btn ghost" data-cf-route="training">Training</button><button type="button" class="btn ghost" data-cf-route="nutrition">Meals & food choices</button><button type="button" class="btn ghost" data-cf-route="progress">Progress</button></div>';
   box.querySelector('[data-cf-refresh]').onclick=load;
   box.querySelectorAll('[data-cf-route]').forEach(b=>b.onclick=()=>{if(!active())return;state.clientView=b.dataset.cfRoute;renderClient();});
   box.querySelectorAll('[data-cf-action]').forEach(input=>input.onchange=async()=>{
    if(!active()||!canComplete)return;const checked=input.checked;input.disabled=true;const status=box.querySelector('[role=status]');status.textContent='Saving…';
    try{const r=await query('Save agreed action',db.rpc('complete_coaching_focus',{p_id:input.dataset.cfAction,p_complete:checked}));if(!active())return;if(r?.id!==input.dataset.cfAction||r.client_id!==id||Boolean(r.completed_at)!==checked)throw Error('The saved action was not confirmed. Refresh before retrying.');await load();}
    catch(e){if(active()){input.checked=!checked;status.textContent=e.message||'Could not save. Try again.';}}finally{if(active()&&input.isConnected)input.disabled=false;}
   });
  }catch(e){if(active())box.innerHTML='<span class="eyebrow">AGREED NEXT STEPS</span><h2>Actions unavailable</h2><p role="status">'+esc(e.message||'Could not load your saved actions. Missing evidence is not an empty checklist.')+'</p><button type="button" class="btn ghost" data-cf-retry>Retry</button>';if(active())box.querySelector('[data-cf-retry]')?.addEventListener('click',load);}}
  load();
 }
 async function coachMount(){
  if(state.role!=='coach'||!state.client||state.clientTab!=='overview'||state.preview)return;const host=$('#clientWorkspaceBody');if(!host)return;
  host.querySelector('#cfCoach')?.remove();const box=document.createElement('section');box.id='cfCoach';box.className='panel cf-followup cf-coach';box.innerHTML='<span class="eyebrow">CALL → ACTIONS</span><h2>Latest call & follow-through</h2><p role="status">Checking saved follow-up…</p>';host.prepend(box);
  const id=state.client.id,user=state.user?.id,active=()=>box.isConnected&&state.role==='coach'&&state.user?.id===user&&state.client?.id===id&&state.clientTab==='overview';
  try{
   const events=await query('Client call follow-through',db.from('coaching_recording_events').select('id,client_id,coach_id,source_url,occurred_at,matching_status,processing_status,analysis').eq('coach_id',user).eq('client_id',id).eq('matching_status','matched').order('occurred_at',{ascending:false}).limit(1));if(!active())return;
   const e=events[0];if(!e){box.innerHTML='<h2>Latest call & follow-through</h2><p>No verified call is linked to this client yet.</p>';return;}if(e.client_id!==id||e.coach_id!==user)throw Error('Call ownership could not be verified.');
   const [proposals,receipts]=await Promise.all([
    query('Call actions',db.from('coaching_change_proposals').select('id,client_id,description,status').eq('client_id',id).eq('recording_event_id',e.id).limit(100)),
    query('Applied call changes',db.from('fathom_training_update_receipts').select('status,client_id,created_at').eq('client_id',id).eq('event_id',e.id).limit(1))
   ]);if(!active())return;if(proposals.some(r=>r.client_id!==id)||receipts.some(r=>r.client_id!==id))throw Error('Follow-up ownership could not be verified.');
   const f=e.analysis?.follow_through||{},link=safeSource(e.source_url),approved=proposals.filter(p=>p.status==='approved').length;
   box.innerHTML='<div class="panel-head"><div><span class="eyebrow">CALL → ACTIONS</span><h2>Latest call & follow-through</h2><p>'+esc(stamp(e.occurred_at))+'</p></div><button type="button" class="btn ghost small" data-cf-coach-refresh>Refresh</button></div><div class="cf-badges"><span>Identity verified</span><span>'+approved+' client actions published</span><span>'+esc(receipts[0]?.status==='applied'?'Training update recorded':receipts[0]?'Training draft—not applied':'No training prescription change recorded')+'</span></div><h3>Decisions from this call</h3>'+(Array.isArray(f.decisions)&&f.decisions.length?'<ul>'+f.decisions.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':'<p>The recording is linked; its decisions still need review.</p>')+'<h3>Your tasks</h3>'+(Array.isArray(f.coach_tasks)&&f.coach_tasks.length?'<ul class="cf-coach-tasks">'+f.coach_tasks.map(t=>'<li><strong>'+esc(t.description)+'</strong><small>'+esc(t.status==='complete'?'Recorded complete':'Still open—not marked done')+'</small></li>').join('')+'</ul>':'<p>No coach task has been saved from this call.</p>')+'<h3>Client actions</h3>'+(proposals.length?'<ul>'+proposals.map(p=>'<li>'+esc(p.description)+' <small>('+esc(p.status)+')</small></li>').join('')+'</ul>':'<p>No actions published yet.</p>')+'<p class="muted">Published checklist items do not change calories, macros, supplements or exercise prescriptions. Coach tasks are private.</p><div class="cf-links"><button type="button" class="btn primary" data-cf-recording>Review call & actions</button>'+(link?'<a class="btn ghost" href="'+esc(link)+'" target="_blank" rel="noopener">Original recording ↗</a>':'')+'</div>';
   box.querySelector('[data-cf-coach-refresh]').onclick=coachMount;box.querySelector('[data-cf-recording]').onclick=()=>{if(!active())return;state.coachingReviewClientId=id;state.client=null;state.coachView='coaching-updates';renderCoach();};
  }catch(e){if(active())box.innerHTML='<h2>Follow-up unavailable</h2><p role="status">'+esc(e.message||'Could not load the saved call.')+'</p><button class="btn ghost" type="button" data-cf-coach-retry>Retry</button>';if(active())box.querySelector('[data-cf-coach-retry]')?.addEventListener('click',coachMount);}
 }
 const today=clientToday;clientToday=function(){const r=today();clientMount();return r;};
 const support=clientCoachingSupport;clientCoachingSupport=function(){const r=support();clientMount();return r;};
 if(window.LegalEdgePriorities){const home=window.LegalEdgePriorities.home;window.LegalEdgePriorities.home=function(){const r=home();clientMount();return r;};}
 const overview=coachOverview;coachOverview=function(){const r=overview();coachMount();return r;};
 window.CoachingFollowThrough={clientMount,coachMount};
})();

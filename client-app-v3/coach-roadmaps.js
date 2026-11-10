/* Coach-private, versioned roadmaps; never published into client prescriptions. */
(function(){
 'use strict';
 const statuses={agreed:'Agreed',proposed:'Needs confirmation',paused:'Paused',historical:'Historical—not current',complete:'Complete'};
 const fields={phase:'Current phase',destination:'Long-term direction & original agreements',evidence:'Latest dated evidence',scorecard:'Weekly scorecard',coach:'Your coaching actions',next_call:'Questions for the next call',review:'Next review / unresolved decisions'};
 const safeSource=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['fathom.video','www.loom.com','loom.com'].includes(u.hostname)?u.href:null;}catch{return null;}};
 function realClient(c){return c&&c.coach_id===state.user?.id&&!c.deleted_at&&['active','ending'].includes(c.status)&&!c.archived_at&&c.profile_id!==state.user?.id&&c.source_system!=='coach_health_test'&&!/demo|test data/i.test(c.display_name||'');}
 function eligible(){return state.role==='coach'&&!state.preview&&state.user?.id&&realClient(state.client);}
 function validate(p){
  if(!p||p.version!==1||!Array.isArray(p.goals)||p.goals.length<1||p.goals.length>12||!Array.isArray(p.trajectory)||p.trajectory.length<1||p.trajectory.length>6||!Array.isArray(p.sources)||p.sources.length>30)throw Error('Saved roadmap format needs review.');
  for(const k of Object.keys(fields))if(typeof p[k]!=='string'||p[k].length>(k==='phase'?500:5000))throw Error('Roadmap text needs review.');
  if(!p.phase.trim())throw Error('Add the current phase.');
  for(const g of p.goals)if(!g||typeof g.title!=='string'||!g.title.trim()||g.title.length>200||typeof g.detail!=='string'||g.detail.length>4000||!Object.hasOwn(statuses,g.status))throw Error('Each goal needs a title, details and agreement status.');
  for(const t of p.trajectory)if(!t||typeof t.label!=='string'||!t.label.trim()||t.label.length>200||typeof t.detail!=='string'||t.detail.length>5000)throw Error('Each review horizon needs a label and details.');
  for(const s of p.sources)if(!s||typeof s.label!=='string'||s.label.length>200||typeof s.url!=='string'||s.url.length>1500||(s.url&&!safeSource(s.url)))throw Error('A source link needs review.');
  return window.CoachingPhasePlan?window.CoachingPhasePlan.validate(p):p;
 }
 const blank=()=>({version:1,phase:'Set the current priority',destination:'',evidence:'',goals:[{id:'goal-'+Date.now().toString(36),title:'Agree the next useful goal',status:'proposed',detail:''}],trajectory:[{label:'Next two weeks',detail:''},{label:'Following two weeks',detail:''},{label:'Next review',detail:''}],scorecard:'',coach:'',next_call:'',review:'',sources:[]});
 function brief(value,max=260){const s=String(value||'').trim();if(s.length<=max)return s;const prefix=s.slice(0,max),end=prefix.lastIndexOf(' ');return prefix.slice(0,end>max/2?end:max).trimEnd()+'…';}
 function focusGoals(p){return p.goals.filter(g=>['agreed','proposed'].includes(g.status));}
 function reviewDate(p){const dates=focusGoals(p).map(g=>g.review_on).filter(v=>window.CoachingPhasePlan?.date(v));if(!dates.length)dates.push(...p.trajectory.filter(t=>!['complete','paused'].includes(t.plan_status)).map(t=>t.review_on).filter(v=>window.CoachingPhasePlan?.date(v)));return dates.sort()[0]||'';}
 function dateLabel(value){return value?new Date(value+'T12:00:00Z').toLocaleDateString('en-IE',{timeZone:'Europe/Dublin',day:'numeric',month:'short',year:'numeric'}):'Date to agree';}
 function quickView(p){
  const goals=focusGoals(p),date=reviewDate(p),proposed=goals.some(g=>g.target_status!=='agreed');
  return '<div class="cr-quick-plan"><article class="cr-quick-goal"><span class="cr-step">01 · MAIN GOAL</span><h2>What we’re working towards</h2><p class="cr-lead">'+esc(brief(p.destination||'Agree the main outcome with this client.',320))+'</p></article><article class="cr-current cr-quick-phase"><span class="cr-step">02 · CURRENT PHASE</span><h3>'+esc(p.phase)+'</h3><p class="muted">The focus now. The full phased plan is in View details.</p></article><article class="cr-quick-week"><span class="cr-step">03 · THIS WEEK</span><h3>Keep the next steps clear</h3><div class="cr-week-columns"><div><h4>Client focus</h4>'+(goals.length?'<ul>'+goals.slice(0,3).map(g=>'<li><strong>'+esc(g.title)+'</strong><p>'+esc(brief(g.target||'Specific next step still needs agreeing.',180))+'</p></li>').join('')+'</ul>'+(goals.length>3?'<p class="muted">'+(goals.length-3)+' more current goals in View details.</p>':''):'<p>No current goal is agreed or proposed. Review the paused or historical goals before restarting them.</p>')+'</div><div class="cr-coach-next"><h4>Your next step</h4><p>'+esc(brief(p.coach||'Agree one useful next step with the client.',320))+'</p></div></div>'+(proposed?'<p class="cr-confirm-note">Confirm the proposed target details with the client before treating them as agreed.</p>':'')+'</article><article class="cr-quick-review"><span class="cr-step">04 · NEXT REVIEW</span><h3>'+esc(dateLabel(date))+'</h3><p class="cr-date-note">'+(date?'Saved review target—not a booked call.':'No review date has been recorded.')+'</p><h4>What to check</h4><p>'+esc(brief(p.scorecard||'Agree how progress will be measured before changing the plan.',280))+'</p><details class="cr-review-note"><summary>Review notes</summary><p>'+esc(p.review||'No further review notes saved.')+'</p></details></article></div>';
 }
 function detailedMarkup(p,compact){
  const goal=g=>'<article class="cr-goal"><span class="cr-badge cr-'+g.status+'">'+esc(statuses[g.status])+'</span><h3>'+esc(g.title)+'</h3><p>'+esc(g.detail)+'</p>'+(window.CoachingPhasePlan?.goal(g,esc,compact)||'')+'</article>';
  const direction='<div class="cr-north-star"><span class="eyebrow">THE BIGGER PICTURE</span><h2>Long-term goals & coaching plan</h2><p class="cr-lead">'+esc(p.destination||'The long-term outcome still needs agreeing.')+'</p></div><div class="cr-current"><span class="eyebrow">CURRENT PHASE</span><h3>'+esc(p.phase)+'</h3></div>';
  const goals='<h3>Goals we keep coming back to</h3><div class="cr-goals">'+p.goals.map(goal).join('')+'</div>';
  const timeline='<h3>The plan from here</h3><p class="muted">Each phase has a purpose, review criteria and explicit training, nutrition, activity and recovery decisions. These are private coaching plans—not automatic client changes or guaranteed results.</p><ol class="cr-timeline cp-timeline">'+p.trajectory.map((t,i)=>window.CoachingPhasePlan?window.CoachingPhasePlan.phase(t,i,esc):'<li><strong>'+esc(t.label)+'</strong><p>'+esc(t.detail)+'</p></li>').join('')+'</ol>'+(window.CoachingPhasePlan?.guidance()||'');
  if(compact)return direction+goals+'<div class="cr-review"><strong>Next review</strong><p>'+esc(p.review)+'</p></div>';
  return direction+goals+timeline+'<div class="cr-grid">'+['scorecard','coach','next_call','review'].map(k=>'<article><h3>'+fields[k]+'</h3><p>'+esc(p[k]||'Not agreed yet.')+'</p></article>').join('')+'</div><details class="cr-sources"><summary>What this is based on · '+p.sources.length+' references</summary><div class="cr-evidence"><h3>Latest dated evidence</h3><p>'+esc(p.evidence)+'</p></div><ul>'+p.sources.map(s=>'<li>'+(safeSource(s.url)?'<a href="'+esc(safeSource(s.url))+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+' ↗</a>':esc(s.label))+'</li>').join('')+'</ul><p>Older targets stay historical until you explicitly agree a new one. No unsupported long-term deadline or outcome has been invented.</p></details>';
 }
 function markup(p,compact){return quickView(p)+'<details class="cr-details"><summary><strong>View details</strong><span>'+(compact?'All saved goals & original direction':'All goals, phases, call notes & history')+'</span></summary><div data-cr-all-details>'+detailedMarkup(p,compact)+'</div></details>';}
 function editor(p){
  const area=(key,label,value,max=5000)=>'<label>'+esc(label)+'<textarea name="'+key+'" maxlength="'+max+'" rows="3">'+esc(value)+'</textarea></label>';
  return '<details class="cr-editor"><summary>Edit private roadmap</summary><form data-cr-form><p>Private to you. Saving does not publish goals, change a plan, send a message or book a call.</p>'+Object.entries(fields).map(([k,label])=>area(k,label,p[k],k==='phase'?500:5000)).join('')+'<h3>Goals & agreement status</h3><div data-cr-goals>'+p.goals.map((g,i)=>'<fieldset><legend>Goal '+(i+1)+'</legend><label>Title<input name="goal-title-'+i+'" maxlength="200" value="'+esc(g.title)+'" required></label><label>Agreement status<select name="goal-status-'+i+'">'+Object.entries(statuses).map(([k,v])=>'<option value="'+k+'" '+(g.status===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+area('goal-detail-'+i,'Details / evidence',g.detail,4000)+(window.CoachingPhasePlan?.goalEditor(g,i,esc)||'')+'</fieldset>').join('')+'</div><button type="button" class="btn ghost" data-cr-add-goal>Add goal</button><h3>Review horizons</h3>'+p.trajectory.map((t,i)=>'<fieldset><legend>Review '+(i+1)+'</legend><label>Horizon<input name="horizon-'+i+'" maxlength="200" value="'+esc(t.label)+'" required></label>'+area('trajectory-'+i,'Next steps',t.detail)+(window.CoachingPhasePlan?.phaseEditor(t,i,esc)||'')+'</fieldset>').join('')+'<button class="btn primary" type="submit">Save private roadmap</button><p role="status" data-cr-save-status></p></form></details>';
 }
 function mount(compact=false){
  if(!eligible())return;const host=$('#clientWorkspaceBody');if(!host)return;
  host.querySelector('#coachRoadmap')?.remove();const box=document.createElement('section');box.id='coachRoadmap';box.className='panel cr-roadmap';host.prepend(box);
  const id=state.client.id,owner=state.user.id,tab=state.clientTab,published=host.querySelector('.cr-published');let serial=0,revision=0,payload=null,dirty=false,busy=false,detailsOpen=false;
  const active=()=>box.isConnected&&eligible()&&state.user.id===owner&&state.client.id===id&&state.clientTab===tab;
  const header=()=>'<div class="panel-head"><div><span class="eyebrow">YOUR CLIENT PLAN</span><p class="muted">Goal. Focus. Next steps. Review. Private to you.</p></div><button type="button" class="btn ghost small" data-cr-refresh>Refresh plan</button></div>';
  function bind(){
   box.querySelector('[data-cr-refresh]')?.addEventListener('click',()=>{if(!active()||busy)return;if((dirty||window.RoadmapCallReview?.hasDraft(box))&&!window.confirm('Discard unsaved edits and reload the saved roadmap?'))return;window.RoadmapCallReview?.clearDraft(box);load();});
   box.querySelector('[data-cr-open]')?.addEventListener('click',()=>{if(!active())return;state.clientTab='goals';renderClientWorkspace();});
   box.querySelector('[data-cr-edit]')?.addEventListener('click',()=>{if(!active()||busy)return;box.querySelector('.cr-details').open=true;box.querySelector('.cr-editor').open=true;box.querySelector('.cr-editor').scrollIntoView?.({behavior:'smooth',block:'start'});box.querySelector('[name=phase]')?.focus({preventScroll:true});});
   const form=box.querySelector('[data-cr-form]');if(!form)return;
   form.addEventListener('input',()=>{dirty=true;form.querySelector('[data-cr-save-status]').textContent='Unsaved private changes';});
   form.querySelector('[data-cr-add-goal]').onclick=()=>{if(!active()||busy)return;if(window.RoadmapCallReview?.hasDraft(box)){form.querySelector('[data-cr-save-status]').textContent='Save or discard the call-review draft first.';return;}const next=read(form);if(next.goals.length>=12)return;next.goals.push({id:'goal-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),title:'New goal',status:'proposed',detail:''});payload=next;paint();box.querySelector('.cr-editor').open=true;dirty=true;};
   form.onsubmit=async event=>{
    event.preventDefault();if(!active()||busy)return;const status=form.querySelector('[data-cr-save-status]'),button=form.querySelector('[type=submit]');let submitted;
    try{if(window.RoadmapCallReview?.hasDraft(box))throw Error('Save or discard the call-review draft first.');submitted=validate(read(form));}catch(e){status.textContent=e.message;return;}
    busy=true;button.disabled=true;form.querySelector('[data-cr-add-goal]').disabled=true;status.textContent='Saving privately…';
    const sent=JSON.stringify(submitted),request=++serial;
    try{
     const row=await query('Save private coaching roadmap',db.rpc('save_coach_client_roadmap',{p_client:id,p_expected_revision:revision,p_payload:submitted}));
     if(!active()||request!==serial)return;
     if(!row||row.client_id!==id||row.coach_id!==owner||row.revision!==revision+1)throw Error('The save was not confirmed. Reload the saved version before retrying.');
     validate(row.payload);const unchanged=JSON.stringify(read(form))===sent;revision=row.revision;payload=row.payload;
     if(unchanged){dirty=false;paint();box.querySelector('.cr-editor').open=true;box.querySelector('[data-cr-save-status]').textContent='Saved privately · revision '+revision+'. No client plan changed.';}
     else status.textContent='Earlier edits saved. Your newer edits are still unsaved.';
    }catch(e){if(active()&&request===serial)status.textContent=(e.message||'Could not save.')+' Your draft is still here.';}
    finally{busy=false;if(active()&&form.isConnected){button.disabled=false;form.querySelector('[data-cr-add-goal]').disabled=false;}}
   };
  }
  function read(form){const next=JSON.parse(JSON.stringify(payload));for(const k of Object.keys(fields))next[k]=form.elements.namedItem(k).value;next.goals=next.goals.map((g,i)=>({...g,title:form.elements.namedItem('goal-title-'+i).value,status:form.elements.namedItem('goal-status-'+i).value,detail:form.elements.namedItem('goal-detail-'+i).value}));next.trajectory=next.trajectory.map((t,i)=>({...t,label:form.elements.namedItem('horizon-'+i).value,detail:form.elements.namedItem('trajectory-'+i).value}));return window.CoachingPhasePlan?window.CoachingPhasePlan.read(form,next):next;}
  function paint(){
   const wasOpen=box.querySelector('.cr-details')?.open??detailsOpen;box.innerHTML=header()+markup(payload,compact)+(compact?'<button class="btn primary" type="button" data-cr-open>Open client plan</button>':'<button class="btn ghost" type="button" data-cr-edit>Edit plan</button>');
   const details=box.querySelector('.cr-details'),body=details.querySelector('[data-cr-all-details]');if(!compact){body.insertAdjacentHTML('beforeend','<p class="cr-saved">'+(revision?'Saved private roadmap · revision '+revision:'Not saved yet')+'</p>'+editor(payload));if(published)body.append(published);}details.open=!!wasOpen;bind();
   let mounted=false;const mountCalls=()=>{if(!details.isConnected)return;detailsOpen=details.open;if(mounted||!details.open||compact||!revision||!active())return;mounted=true;window.RoadmapCallReview?.mount(box,{id,owner,active,get:()=>({revision,payload}),lock:()=>{if(busy||dirty)throw Error('Save or discard the private-roadmap edits first.');busy=true;const inputs=[...box.querySelectorAll('[data-cr-form] input,[data-cr-form] select,[data-cr-form] textarea,[data-cr-form] button')];inputs.forEach(x=>x.disabled=true);return()=>{busy=false;inputs.forEach(x=>x.disabled=false);};},accept:(row,message)=>{if(!active())return;revision=row.revision;payload=validate(row.payload);dirty=false;paint();box.querySelector('[data-cr-save-status]').textContent=message;}});};details.addEventListener('toggle',mountCalls);mountCalls();
  }
  async function load(){
   detailsOpen=box.querySelector('.cr-details')?.open??detailsOpen;const request=++serial;box.innerHTML=header()+'<p role="status">Loading saved roadmap…</p>';bind();
   try{
    const rows=await query('Private coaching roadmap',db.from('coach_client_roadmaps').select('client_id,coach_id,revision,payload,updated_at').eq('client_id',id).eq('coach_id',owner).limit(2));
    if(!active()||request!==serial)return;
    if(!Array.isArray(rows)||rows.length>1||rows.some(r=>r.client_id!==id||r.coach_id!==owner||!Number.isInteger(r.revision)||r.revision<1))throw Error('Roadmap ownership or saved revision could not be verified.');
    revision=rows[0]?.revision||0;payload=rows[0]?validate(rows[0].payload):blank();dirty=false;paint();
   }catch(e){if(active()&&request===serial){box.innerHTML=header()+'<h2>Roadmap unavailable</h2><p role="status">'+esc(e.message||'Could not read the saved roadmap. This is not an empty plan.')+'</p>';bind();}}
  }
  load();
 }
 const overview=coachOverview;coachOverview=function(){const result=overview();mount(true);return result;};
 const goals=coachCoachingGoals;coachCoachingGoals=function(){
  const result=goals();if(!eligible())return result;const host=$('#clientWorkspaceBody');if(!host)return result;
  const disclosure=document.createElement('details');disclosure.className='panel cr-published';disclosure.innerHTML='<summary>Client-visible targets · existing editor</summary><p>Separate from your private roadmap. Changes here affect the goals clients see.</p>';
  while(host.firstChild)disclosure.append(host.firstChild);host.append(disclosure);mount(false);return result;
 };
 const workspace=renderClientWorkspace;renderClientWorkspace=function(){const result=workspace();if(state.role==='coach'){const tabs=document.querySelector('#clientTabs');tabs?.querySelectorAll('[data-client-tab="goals"]').forEach(b=>{if(b.textContent!=='Goals & long-term plan')b.textContent='Goals & long-term plan';if(b.parentElement!==tabs)tabs.querySelector('[data-client-tab="overview"]')?.after(b);b.classList.add('cr-primary-tab');});window.CoachMobile?.sync?.();}return result;};
 let hubSequence=0,openSequence=0;
 function hubAllowed(){return state.role==='coach'&&!state.preview&&state.user?.id&&!state.client&&state.coachView==='roadmaps';}
 function goHub(){if(state.role!=='coach'||state.preview)return;state.client=null;state.coachView='roadmaps';renderCoach();}
 function entries(){
  if(state.role!=='coach'||state.preview)return;const owner=state.user?.id,nav=document.querySelector('#coachNav');
  if(nav){let b=nav.querySelector('[data-coach-view="roadmaps"]');if(!b){b=document.createElement('button');b.type='button';b.className='side-link';b.dataset.coachView='roadmaps';b.innerHTML='<span>◎</span>Goals & plans';nav.querySelector('[data-coach-view="clients"]')?.after(b);}b.onclick=()=>{if(b.isConnected&&state.role==='coach'&&state.user?.id===owner)goHub();};}
  const anchor=!state.client&&state.coachView==='dashboard'?document.querySelector('#coachHomeFocus .home-focus-heading > div'):!state.client&&state.coachView==='clients'?document.querySelector('#coachMain .page-head'):null;
  if(anchor&&!anchor.querySelector('[data-cr-hub]')){const b=document.createElement('button');b.type='button';b.className='btn primary cr-hub-entry';b.dataset.crHub='';b.textContent='Goals & long-term plans';b.onclick=()=>{if(b.isConnected&&state.user?.id===owner&&state.role==='coach')goHub();};anchor.prepend(b);}
 }
 async function openRoadmap(id,button){
  if(!hubAllowed())return;const c=(state.clients||[]).find(c=>c.id===id&&realClient(c));if(!c)return;
  const owner=state.user.id,seq=++openSequence;button.disabled=true;
  state.client=c;state.clientTab='goals';if(typeof emptyData==='function')state.data=emptyData();
  const active=()=>seq===openSequence&&state.role==='coach'&&state.user?.id===owner&&state.client?.id===id&&state.coachView==='roadmaps';
  const host=document.querySelector('#coachMain');host.innerHTML='<section class="panel" role="status">Opening this client’s goals and saved plan…</section>';
  try{if(await loadClientData(id)===false||!active())return;renderCoach();}
  catch(e){if(active()){state.client=null;renderHub(e.message||'The workspace could not open. Retry.');}}
 }
 async function renderHub(message=''){
  if(!hubAllowed())return;const host=document.querySelector('#coachMain');if(!host)return;const owner=state.user.id,request=++hubSequence,clients=(state.clients||[]).filter(realClient);
  host.innerHTML='<section class="cr-hub"><header class="cr-hub-head"><span class="eyebrow">PRIVATE COACH WORKSPACE</span><h1>Goals & long-term plans</h1><p>Why they started. Where they are going. What you are working on next.</p><p class="muted">Active real clients only. Agreed goals stay separate from proposals and historical targets. These notes are not client prescriptions.</p><button type="button" class="btn ghost" data-cr-hub-refresh>Refresh saved plans</button></header><p role="status" data-cr-hub-status></p><div class="cr-client-grid"></div></section>';
  const box=host.querySelector('.cr-hub'),active=()=>box.isConnected&&hubAllowed()&&state.user.id===owner&&request===hubSequence&&clients.every(c=>(state.clients||[]).some(current=>current.id===c.id&&realClient(current)));
  box.querySelector('[data-cr-hub-refresh]').onclick=()=>{if(active())renderHub();};entries();window.CoachMobile?.sync?.();
  const status=box.querySelector('[data-cr-hub-status]');status.textContent=message||'Reading saved coaching plans…';
  if(clients.length>200){status.textContent='Client scope is too large. Use the individual workspace.';return;}
  if(!clients.length){status.textContent='No active real clients are available in this account.';return;}
  try{
   const rows=await query('Active client long-term plans',db.from('coach_client_roadmaps').select('client_id,coach_id,revision,payload,updated_at').eq('coach_id',owner).in('client_id',clients.map(c=>c.id)).limit(201));if(!active())return;
   if(!Array.isArray(rows)||rows.length>200||new Set(rows.map(r=>r.client_id)).size!==rows.length||rows.some(r=>r.coach_id!==owner||!clients.some(c=>c.id===r.client_id)||!Number.isInteger(r.revision)||r.revision<1))throw Error('Saved plan ownership or completeness could not be verified.');
   rows.forEach(r=>validate(r.payload));const byId=new Map(rows.map(r=>[r.client_id,r]));status.textContent=clients.length+' active clients · '+rows.length+' saved private plans';
   box.querySelector('.cr-client-grid').innerHTML=clients.map(c=>{const row=byId.get(c.id),p=row?.payload;return '<article class="cr-client-card"><header><span class="eyebrow">ACTIVE CLIENT</span><h2>'+esc(c.display_name)+'</h2></header>'+(p?'<dl class="cr-hub-simple"><div><dt>Main goal</dt><dd>'+esc(brief(p.destination||'Main outcome to agree.',210))+'</dd></div><div><dt>Current phase</dt><dd>'+esc(brief(p.phase,170))+'</dd></div><div><dt>This week</dt><dd>'+esc(focusGoals(p).map(g=>g.title).slice(0,3).join(' · ')||'Agree the current focus.')+(focusGoals(p).length>3?' · +'+(focusGoals(p).length-3)+' more in the client plan':'')+'</dd></div><div><dt>Next review</dt><dd>'+esc(dateLabel(reviewDate(p)))+'<small>Review target, not a booked call</small></dd></div></dl><details class="cr-hub-full"><summary>View goal list · '+p.goals.length+'</summary><ul class="cr-hub-goals">'+p.goals.map(g=>'<li><span class="cr-badge cr-'+g.status+'">'+esc(statuses[g.status])+'</span><strong>'+esc(g.title)+'</strong></li>').join('')+'</ul></details>':'<p>No private roadmap saved yet. Open this client to agree their direction; missing data is not a completed plan.</p>')+'<button class="btn primary" type="button" data-cr-client="'+esc(c.id)+'">Open client plan</button></article>';}).join('');
   box.querySelectorAll('[data-cr-client]').forEach(b=>b.onclick=()=>{if(active())openRoadmap(b.dataset.crClient,b);});
  }catch(e){if(active())status.textContent='Plans unavailable. '+(e.message||'Refresh to retry. No empty or completed status is inferred.');}
 }
 if(typeof renderCoach==='function'){const coach=renderCoach;renderCoach=function(){if(hubAllowed()){document.querySelectorAll('#coachNav [data-coach-view]').forEach(b=>b.classList.toggle('active',b.dataset.coachView==='roadmaps'));return renderHub();}const result=coach();entries();return result;};}
 window.CoachRoadmaps={mount,validate,markup,safeSource,eligible,blank,renderHub,goHub,realClient,brief,focusGoals,reviewDate,quickView};
})();

/* Coach-private, versioned roadmaps; never published into client prescriptions. */
(function(){
 'use strict';
 const statuses={agreed:'Agreed',proposed:'Needs confirmation',paused:'Paused',historical:'Historical—not current',complete:'Complete'};
 const fields={phase:'Current phase',destination:'Long-term direction & original agreements',evidence:'Latest dated evidence',scorecard:'Weekly scorecard',coach:'Your coaching actions',next_call:'Questions for the next call',review:'Next review / unresolved decisions'};
 const safeSource=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['fathom.video','www.loom.com','loom.com'].includes(u.hostname)?u.href:null;}catch{return null;}};
 function eligible(){const c=state.client;return state.role==='coach'&&!state.preview&&state.user?.id&&c&&c.coach_id===state.user.id&&!c.deleted_at&&['active','ending'].includes(c.status)&&c.profile_id!==state.user.id&&c.source_system!=='coach_health_test'&&!/demo|test data/i.test(c.display_name||'');}
 function validate(p){
  if(!p||p.version!==1||!Array.isArray(p.goals)||p.goals.length<1||p.goals.length>12||!Array.isArray(p.trajectory)||p.trajectory.length<1||p.trajectory.length>6||!Array.isArray(p.sources)||p.sources.length>30)throw Error('Saved roadmap format needs review.');
  for(const k of Object.keys(fields))if(typeof p[k]!=='string'||p[k].length>(k==='phase'?500:5000))throw Error('Roadmap text needs review.');
  if(!p.phase.trim())throw Error('Add the current phase.');
  for(const g of p.goals)if(!g||typeof g.title!=='string'||!g.title.trim()||g.title.length>200||typeof g.detail!=='string'||g.detail.length>4000||!Object.hasOwn(statuses,g.status))throw Error('Each goal needs a title, details and agreement status.');
  for(const t of p.trajectory)if(!t||typeof t.label!=='string'||!t.label.trim()||t.label.length>200||typeof t.detail!=='string'||t.detail.length>5000)throw Error('Each review horizon needs a label and details.');
  for(const s of p.sources)if(!s||typeof s.label!=='string'||s.label.length>200||typeof s.url!=='string'||s.url.length>1500||(s.url&&!safeSource(s.url)))throw Error('A source link needs review.');
  return p;
 }
 const blank=()=>({version:1,phase:'Set the current priority',destination:'',evidence:'',goals:[{title:'Agree the next useful goal',status:'proposed',detail:''}],trajectory:[{label:'Next two weeks',detail:''},{label:'Following two weeks',detail:''},{label:'Next review',detail:''}],scorecard:'',coach:'',next_call:'',review:'',sources:[]});
 function markup(p,compact){
  const goal=g=>'<article class="cr-goal"><span class="cr-badge cr-'+g.status+'">'+esc(statuses[g.status])+'</span><h3>'+esc(g.title)+'</h3><p>'+esc(g.detail)+'</p></article>';
  if(compact)return '<h2>'+esc(p.phase)+'</h2><p>'+esc(p.destination)+'</p><div class="cr-goals">'+p.goals.slice(0,3).map(goal).join('')+'</div><p class="cr-review">'+esc(p.review)+'</p>';
  return '<h2>'+esc(p.phase)+'</h2><p class="cr-lead">'+esc(p.destination)+'</p><div class="cr-evidence"><h3>What the latest evidence says</h3><p>'+esc(p.evidence)+'</p></div><h3>Persistent goals</h3><div class="cr-goals">'+p.goals.map(goal).join('')+'</div><h3>Proposed roadmap</h3><p class="muted">Review horizons—not booked calls or promised outcomes. Progress depends on the next agreed review.</p><ol class="cr-timeline">'+p.trajectory.map(t=>'<li><strong>'+esc(t.label)+'</strong><p>'+esc(t.detail)+'</p></li>').join('')+'</ol><div class="cr-grid">'+['scorecard','coach','next_call','review'].map(k=>'<article><h3>'+fields[k]+'</h3><p>'+esc(p[k]||'Not agreed yet.')+'</p></article>').join('')+'</div><details class="cr-sources"><summary>Evidence & original agreements · '+p.sources.length+' references</summary><ul>'+p.sources.map(s=>'<li>'+(safeSource(s.url)?'<a href="'+esc(safeSource(s.url))+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+' ↗</a>':esc(s.label))+'</li>').join('')+'</ul><p>Recordings and saved check-ins are evidence. Older targets stay historical until you explicitly agree a new one.</p></details>';
 }
 function editor(p){
  const area=(key,label,value,max=5000)=>'<label>'+esc(label)+'<textarea name="'+key+'" maxlength="'+max+'" rows="3">'+esc(value)+'</textarea></label>';
  return '<details class="cr-editor"><summary>Edit private roadmap</summary><form data-cr-form><p>Private to you. Saving does not publish goals, change a plan, send a message or book a call.</p>'+Object.entries(fields).map(([k,label])=>area(k,label,p[k],k==='phase'?500:5000)).join('')+'<h3>Goals & agreement status</h3><div data-cr-goals>'+p.goals.map((g,i)=>'<fieldset><legend>Goal '+(i+1)+'</legend><label>Title<input name="goal-title-'+i+'" maxlength="200" value="'+esc(g.title)+'" required></label><label>Agreement status<select name="goal-status-'+i+'">'+Object.entries(statuses).map(([k,v])=>'<option value="'+k+'" '+(g.status===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+area('goal-detail-'+i,'Details / evidence',g.detail,4000)+'</fieldset>').join('')+'</div><button type="button" class="btn ghost" data-cr-add-goal>Add goal</button><h3>Review horizons</h3>'+p.trajectory.map((t,i)=>'<fieldset><legend>Review '+(i+1)+'</legend><label>Horizon<input name="horizon-'+i+'" maxlength="200" value="'+esc(t.label)+'" required></label>'+area('trajectory-'+i,'Next steps',t.detail)+'</fieldset>').join('')+'<button class="btn primary" type="submit">Save private roadmap</button><p role="status" data-cr-save-status></p></form></details>';
 }
 function mount(compact=false){
  if(!eligible())return;const host=$('#clientWorkspaceBody');if(!host)return;
  host.querySelector('#coachRoadmap')?.remove();const box=document.createElement('section');box.id='coachRoadmap';box.className='panel cr-roadmap';host.prepend(box);
  const id=state.client.id,owner=state.user.id,tab=state.clientTab;let serial=0,revision=0,payload=null,dirty=false,busy=false;
  const active=()=>box.isConnected&&eligible()&&state.user.id===owner&&state.client.id===id&&state.clientTab===tab;
  const header=()=>'<div class="panel-head"><div><span class="eyebrow">PRIVATE COACH ROADMAP</span><p class="muted">Agreements, current priorities and the next review. Clients cannot see these notes.</p></div><button type="button" class="btn ghost small" data-cr-refresh>Reload saved</button></div>';
  function bind(){
   box.querySelector('[data-cr-refresh]')?.addEventListener('click',()=>{if(!active()||busy)return;if(dirty&&!window.confirm('Discard unsaved edits and reload the saved roadmap?'))return;load();});
   box.querySelector('[data-cr-open]')?.addEventListener('click',()=>{if(!active())return;state.clientTab='goals';renderClientWorkspace();});
   const form=box.querySelector('[data-cr-form]');if(!form)return;
   form.addEventListener('input',()=>{dirty=true;form.querySelector('[data-cr-save-status]').textContent='Unsaved private changes';});
   form.querySelector('[data-cr-add-goal]').onclick=()=>{if(!active()||busy)return;const next=read(form);if(next.goals.length>=12)return;next.goals.push({title:'New goal',status:'proposed',detail:''});payload=next;paint();box.querySelector('.cr-editor').open=true;dirty=true;};
   form.onsubmit=async event=>{
    event.preventDefault();if(!active()||busy)return;const status=form.querySelector('[data-cr-save-status]'),button=form.querySelector('[type=submit]');let submitted;
    try{submitted=validate(read(form));}catch(e){status.textContent=e.message;return;}
    busy=true;button.disabled=true;form.querySelector('[data-cr-add-goal]').disabled=true;status.textContent='Saving privately…';
    const sent=JSON.stringify(submitted),request=++serial;
    try{
     const row=await query('Save private coaching roadmap',db.rpc('save_coach_client_roadmap',{p_client:id,p_expected_revision:revision,p_payload:submitted}));
     if(!active()||request!==serial)return;
     if(!row||row.client_id!==id||row.coach_id!==owner||row.revision!==revision+1)throw Error('The save was not confirmed. Reload the saved version before retrying.');
     validate(row.payload);revision=row.revision;payload=row.payload;
     if(JSON.stringify(read(form))===sent){dirty=false;paint();box.querySelector('.cr-editor').open=true;box.querySelector('[data-cr-save-status]').textContent='Saved privately · revision '+revision+'. No client plan changed.';}
     else status.textContent='Earlier edits saved. Your newer edits are still unsaved.';
    }catch(e){if(active()&&request===serial)status.textContent=(e.message||'Could not save.')+' Your draft is still here.';}
    finally{busy=false;if(active()&&form.isConnected){button.disabled=false;form.querySelector('[data-cr-add-goal]').disabled=false;}}
   };
  }
  function read(form){const next=JSON.parse(JSON.stringify(payload));for(const k of Object.keys(fields))next[k]=form.elements.namedItem(k).value;next.goals=next.goals.map((g,i)=>({...g,title:form.elements.namedItem('goal-title-'+i).value,status:form.elements.namedItem('goal-status-'+i).value,detail:form.elements.namedItem('goal-detail-'+i).value}));next.trajectory=next.trajectory.map((t,i)=>({...t,label:form.elements.namedItem('horizon-'+i).value,detail:form.elements.namedItem('trajectory-'+i).value}));return next;}
  function paint(){box.innerHTML=header()+markup(payload,compact)+(compact?'<button class="btn primary" type="button" data-cr-open>Open roadmap & goals</button>':'<p class="cr-saved">'+(revision?'Saved private roadmap · revision '+revision:'Not saved yet')+'</p>'+editor(payload));bind();}
  async function load(){
   const request=++serial;box.innerHTML=header()+'<p role="status">Loading saved roadmap…</p>';bind();
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
 const workspace=renderClientWorkspace;renderClientWorkspace=function(){const result=workspace();if(state.role==='coach'){document.querySelectorAll('[data-client-tab="goals"]').forEach(b=>{if(b.textContent!=='Roadmap & goals')b.textContent='Roadmap & goals';});window.CoachMobile?.sync?.();}return result;};
 window.CoachRoadmaps={mount,validate,markup,safeSource,eligible,blank};
})();

/* Recording reviews stay private. Only coach-approved text reaches the checklist. */
(() => {
 let generation=0;
 const sourceLink=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['fathom.video','www.loom.com','loom.com'].includes(u.hostname)?u.href:null;}catch{return null;}};
 const dateAtClient=()=>new Intl.DateTimeFormat('en-CA',{timeZone:state.client?.timezone||'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const todayUTC=()=>new Date().toISOString().slice(0,10);
 const oldCoach=renderCoach;
 renderCoach=function(){if(!state.client&&state.coachView==='coaching-updates')return reviewScreen();return oldCoach();};
 document.addEventListener('DOMContentLoaded',()=>{
   const nav=$('#coachNav');if(!nav||nav.querySelector('[data-coach-view="coaching-updates"]'))return;
   const b=document.createElement('button');b.type='button';b.className='side-link';b.dataset.coachView='coaching-updates';b.innerHTML='<span aria-hidden="true">◌</span>Coaching Updates';
   b.onclick=e=>{e.stopPropagation();state.client=null;state.coachView='coaching-updates';renderCoach();};nav.append(b);
 });
 async function reviewScreen(){
   const ticket=++generation,host=$('#coachMain');
   $$('#coachNav button').forEach(b=>b.classList.toggle('active',b.dataset.coachView===state.coachView));
   host.innerHTML=pageHead('PRIVATE COACH WORKSPACE','Coaching Updates','')+'<section class="panel cu-status"><h2>Connect Fathom</h2><p id="cuConnectionStatus" aria-live="polite">Checking connection…</p><form id="cuConnect"><label>Replacement Fathom API key<input name="api_key" type="password" autocomplete="off" required minlength="10" maxlength="1024" placeholder="Enter your regenerated key securely"></label><button class="btn primary">Save and connect Fathom</button></form><p class="cu-muted">Your key is stored securely on the server and is never displayed here. Saving registers signed delivery of your recordings automatically.</p><p class="cu-muted">Detailed automatic analysis, Loom polling and pre-call briefs are still being completed. Existing client plans remain in place.</p></section><section class="panel"><div class="cu-controls"><label>Find a recording<input id="cuSearch" type="search" placeholder="Client, summary or recording title"></label><label>Client<select id="cuClient"><option value="">All clients</option>'+state.clients.map(c=>`<option value="${esc(c.id)}">${esc(c.display_name)}</option>`).join('')+'</select></label><button class="btn ghost" id="cuRefresh">Refresh</button></div><div id="cuResults" aria-live="polite">Loading private coaching history…</div></section>';
   $('#cuRefresh').onclick=()=>reviewScreen();
   if(state.preview){$('#cuConnect').querySelector('button').disabled=true;$('#cuConnectionStatus').textContent='Sign in as coach to connect Fathom.';$('#cuResults').textContent='Sign in as the coach to review real recordings. This preview contains no client recordings.';return;}
   connectScreen(ticket);
   try{
     const [events,proposals]=await Promise.all([
       query('Coaching recordings',db.from('coaching_recording_events').select('id,client_id,source,source_url,source_title,occurred_at,matching_status,processing_status,summary,analysis,last_error').order('occurred_at',{ascending:false}).limit(150)),
       query('Coaching proposals',db.from('coaching_change_proposals').select('*').order('created_at',{ascending:false}).limit(500))
     ]);
     if(ticket!==generation||state.coachView!=='coaching-updates'||state.client)return;
     const draw=()=>{
       const needle=$('#cuSearch').value.toLowerCase().trim(),clientId=$('#cuClient').value;
       const filtered=events.filter(e=>(!clientId||e.client_id===clientId)&&[state.clients.find(c=>c.id===e.client_id)?.display_name,e.source_title,e.summary].join(' ').toLowerCase().includes(needle));
       $('#cuResults').innerHTML=filtered.map(e=>{
         const client=state.clients.find(c=>c.id===e.client_id),link=sourceLink(e.source_url),a=e.analysis||{};
         return `<article class="cu-recording"><div class="panel-head"><div><span class="eyebrow">${esc(title(e.source))} · ${esc(fmt(e.occurred_at))}</span><h2>${esc(client?.display_name||'Identity needs review')}</h2><p>${esc(e.source_title||'Coaching recording')}</p></div><span class="cu-badge">${esc(e.processing_status)}</span></div><p class="cu-lines">${esc(e.summary||'Summary not available yet.')}</p>${e.last_error?`<p role="alert">Processing needs attention: ${esc(e.last_error)}</p>`:''}${a.progress?.length?`<h3>Reported progress</h3><ul>${a.progress.map(p=>`<li>${esc(p.description||p)}${p.timestamp?` <small>(${esc(p.timestamp)})</small>`:''}</li>`).join('')}</ul>`:''}${a.attention?.length?`<div class="cu-attention"><strong>Decisions to review</strong><ul>${a.attention.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>`:''}${a.historical?'<p class="cu-muted">Historical context. Earlier time-limited instructions are not current targets.</p>':''}${link?`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="text-btn">Open original recording ↗</a>`:''}<div class="cu-proposals">${proposals.filter(p=>p.recording_event_id===e.id).map(p=>proposalForm(p,e)).join('')||'<p class="cu-muted">No pending actions from this recording.</p>'}</div></article>`;
       }).join('')||'<p>No recordings match this search.</p>';
       $('#cuResults').querySelectorAll('[data-cu-review]').forEach(form=>form.onsubmit=event=>reviewProposal(event,form));
     };
     $('#cuSearch').oninput=draw;$('#cuClient').onchange=draw;draw();
   }catch(error){if(ticket===generation&&state.coachView==='coaching-updates')$('#cuResults').textContent=error.message;}
 }
 async function connectScreen(ticket){
   const form=$('#cuConnect'),status=$('#cuConnectionStatus');
   const invoke=async body=>{const {data,error}=await db.functions.invoke('coaching-connect',{body});let message=data?.error;if(error&&!message){try{message=(await error.context.json()).error;}catch{}}if(error||message)throw Error(message||'Connection request failed. Please try again.');return data;};
   const paint=value=>{if(ticket!==generation||!status.isConnected)return;status.textContent=value.enabled?'Fathom webhook registered.'+(value.last_received_at?' Last delivery: '+fmt(value.last_received_at):' Waiting for the first signed recording delivery.'):value.configured?'Key saved. Save again to finish webhook registration.':'Enter your regenerated key below to activate Fathom.';};
   form.onsubmit=async event=>{event.preventDefault();const button=event.submitter;setBusy(button,true);const field=form.elements.api_key,key=field.value;field.value='';try{paint(await invoke({action:'save',api_key:key}));if(status.isConnected)toast('Fathom webhook registered. New recordings will arrive privately for review.');}catch(error){if(status.isConnected)status.textContent=error.message;}finally{setBusy(button,false);}};
   try{paint(await invoke({action:'status'}));}catch(error){if(ticket===generation&&status.isConnected)status.textContent=error.message;}
 }
 function proposalForm(p,e){
   if(p.status!=='pending')return `<div class="cu-reviewed"><strong>${esc(title(p.status))}</strong><p>${esc(p.description)}</p></div>`;
   const v=p.proposed_value||{},historical=v.expires_on&&v.expires_on<todayUTC(),conflict=v.requires_reconciliation===true;
   return `<form data-cu-review="${esc(p.id)}" class="cu-proposal"><span class="eyebrow">${esc(title(p.change_type.replaceAll('_',' ')))}</span>${v.evidence?`<p class="cu-muted">Source: ${esc(v.evidence)}${v.timestamp?' · '+esc(v.timestamp):''}</p>`:''}<label>Client instruction<textarea name="description" rows="2" maxlength="2000" required>${esc(p.description)}</textarea></label>${conflict?`<div class="cu-attention"><p>${esc(v.conflict||'This conflicts with a saved prescription.')}</p><p>Review and update the actual prescription in the client’s training or nutrition editor before publishing related instructions. This button publishes the checklist only.</p><label><input type="checkbox" name="conflict_reviewed"> I have reconciled the actual plan and this instruction.</label></div>`:''}<div class="cu-dates"><label>Starts<input name="starts_on" type="date" required value="${esc(v.starts_on||todayUTC())}"></label><label>Ends<input name="expires_on" type="date" required value="${esc(v.expires_on||iso(new Date(Date.now()+7*86400000)))}"></label></div>${historical?'<p>This deadline has passed. Review the period before publishing.</p>':''}<div class="cu-actions"><button class="btn primary" name="decision" value="approved" ${e.matching_status!=='matched'?'disabled':''}>Approve checklist item</button><button class="btn ghost" name="decision" value="rejected" formnovalidate>Reject</button></div><p class="cu-muted">No calorie, macro or exercise prescription is changed by this approval.</p></form>`;
 }
 async function reviewProposal(event,form){
   event.preventDefault();const button=event.submitter,fd=new FormData(form),decision=button?.value;
   if(!decision)return;setBusy(button,true);
   try{
     const result=await query('Review coaching update',db.rpc('review_coaching_proposal',{p_id:form.dataset.cuReview,p_decision:decision,p_description:fd.get('description'),p_starts:fd.get('starts_on')||null,p_expires:fd.get('expires_on')||null,p_conflict_reviewed:fd.get('conflict_reviewed')==='on'}));
     toast(result.already_reviewed?'This item was already reviewed.':decision==='approved'?'Checklist item published. Prescriptions unchanged.':'Proposal rejected.');
     if(state.coachView==='coaching-updates'&&!state.client)await reviewScreen();
   }catch(error){toast(error.message,'error');}finally{setBusy(button,false);}
 }
 async function focusScreen(host){
   const clientId=state.client?.id,profileId=state.profile?.id;if(!clientId||state.preview)return;
   host.querySelector('#cuFocus')?.remove();const box=document.createElement('section');box.id='cuFocus';box.className='panel cu-focus';box.innerHTML='<span class="eyebrow">AFTER YOUR CHECK-IN</span><h2>Your Focus This Week</h2><p>Loading your current priorities…</p>';host.prepend(box);
   try{
     const date=dateAtClient(),rows=await query('Your weekly focus',db.from('client_weekly_focus').select('id,client_id,description,starts_on,expires_on,completed_at').eq('client_id',clientId).is('archived_at',null).lte('starts_on',date).gte('expires_on',date).order('approved_at',{ascending:false}));
     if(state.client?.id!==clientId||state.profile?.id!==profileId||!box.isConnected)return;
     box.innerHTML='<span class="eyebrow">YOUR AGREED PRIORITIES</span><h2>Your Focus This Week</h2>'+ (rows.length?'<div class="cu-checklist">'+rows.map(r=>`<label><input type="checkbox" data-cu-focus="${esc(r.id)}" ${r.completed_at?'checked':''} ${state.client?.profile_id!==state.user?.id?'disabled':''}><span>${esc(r.description)}<small>Until ${esc(fmt(r.expires_on))}</small></span></label>`).join('')+'</div>':'<p>Your coach has not published a current checklist yet. Keep following your existing plan.</p>');
     box.querySelectorAll('[data-cu-focus]').forEach(input=>input.onchange=async()=>{const checked=input.checked;input.disabled=true;try{await query('Complete focus',db.rpc('complete_coaching_focus',{p_id:input.dataset.cuFocus,p_complete:checked}));}catch(error){input.checked=!checked;toast(error.message,'error');}finally{input.disabled=false;}});
   }catch(error){if(box.isConnected&&state.client?.id===clientId)box.querySelector('p').textContent='Your priorities could not load. Please refresh to try again.';}
 }
 const oldToday=clientToday;
 clientToday=function(){const result=oldToday();Promise.resolve(result).then(()=>focusScreen($('#clientMain'))).catch(()=>{});return result;};
})();

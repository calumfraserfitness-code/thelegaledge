// Shared production flows. Demo records are supplied only by the labelled sample workspace.
function localCoachingDate(value = new Date(), timezone = state.client?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(value);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function todayCoachingModel(date = localCoachingDate()) {
  const week = state.data.weeks.find(w => date >= w.week_start && date <= iso(new Date(new Date(w.week_start+'T12:00:00Z').getTime()+6*864e5)));
  const published = Boolean(week?.published || state.preview);
  const sessions = published ? state.data.sessions.filter(s => s.week_id === week?.id && s.session_date === date) : [];
  const nutritionDay = published ? state.data.nutritionDays.find(n => n.week_id === week?.id && n.nutrition_date === date) : null;
  const mealPlan = nutritionDay ? state.data.nutritionPlans.find(p => p.id === nutritionDay.nutrition_plan_id) : null;
  const manual = state.data.steps.find(s => s.entry_date === date);
  const wearable = preferredHealthDays().find(h => h.date === date);
  const manualCount = manual?.actual_steps ?? manual?.steps;
  const actualSteps = finiteRecorded(wearable?.steps) ? Number(wearable.steps) : finiteRecorded(manualCount) ? Number(manualCount) : null;
  const weeklySessions = published ? state.data.sessions.filter(s => s.week_id === week?.id && ['weights','resistance','cardio','mobility','recovery'].includes(s.training_type)) : [];
  const checkin = week ? state.data.checkins.find(c => (c.client_id===state.client?.id||state.preview&&!c.client_id)&&(c.period_start === week.week_start || (!c.period_start && c.submitted_at?.slice(0,10) >= week.week_start && c.submitted_at?.slice(0,10) <= date))) : null;
  return {date,week,published,sessions,nutritionDay,mealPlan,actualSteps,weeklySessions,checkin};
}
clientToday = function() {
  const m = todayCoachingModel(), goal = typeof plannerDaySteps === 'function' ? (plannerDaySteps({date:m.date}).goal || safeStepGoal()) : safeStepGoal();
  const meals = m.mealPlan ? assignedMealsForPlan(m.mealPlan) : [];
  const completed = m.weeklySessions.filter(s => s.status === 'completed').length;
  const nextCall = (state.data.coachingCalls || []).filter(c => c.status === 'scheduled' && c.scheduled_at >= new Date().toISOString()).sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  $('#clientMain').innerHTML = clientHeader('TODAY', `Your plan for ${fmt(m.date,{weekday:'long',day:'numeric',month:'short'})}`, 'Your assigned coaching, around your working day.') + `
    <section class="panel pw-today-focus"><span class="eyebrow">DAILY MOVEMENT</span><h2>${goal.toLocaleString()} steps</h2><p>${m.actualSteps == null ? 'No count recorded for today.' : `${m.actualSteps.toLocaleString()} steps recorded${m.actualSteps >= goal ? ' · target reached' : ''}.`}</p><form id="todayStepForm" class="pw-inline"><label>Actual steps today<input name="steps" type="number" min="0" max="100000" step="1" value="${m.actualSteps ?? ''}" required></label><button class="btn primary">Save step count</button></form></section>
    <section class="panel"><div class="panel-head"><h2>Today’s training & activity</h2><button class="btn ghost small" data-today-view="planner">Arrange my week</button></div>${!m.published ? '<p>Your coach has not published this week yet. Historical workouts remain in your training history.</p>' : m.sessions.length ? m.sessions.map(s => `<div class="pw-activity">${taskMarkup(s)}<div>${s.scheduled_time ? `<small>${esc(s.scheduled_time.slice(0,5))} · ${esc(s.schedule_timezone || '')}</small>` : ''}<button class="btn ghost small" data-open-session="${esc(s.id)}">Open prescription</button></div></div>`).join('') : '<p>No training, cardio or mobility is scheduled for today.</p>'}</section>
    <section class="panel"><div class="panel-head"><h2>Meals for today</h2>${m.mealPlan ? `<button class="btn primary small" data-open-meal-plan="${esc(m.mealPlan.id)}" data-meal-date="${m.date}">Ingredients & preparation</button>` : ''}</div>${m.mealPlan ? `<h3>${esc(nutritionDayLabel(m.mealPlan))}</h3>${meals.length ? `<div class="pw-meals">${meals.map(({meal}) => `<div><span class="eyebrow">${esc(title(meal.meal_type || 'Meal'))}</span><h3>${esc(meal.name)}</h3></div>`).join('')}</div>` : '<p>No measured meals are attached to this assigned menu yet. Ask your coach to complete it.</p>'}` : '<p>No meal plan is assigned to today. Your coach can assign a dated menu in your planner.</p>'}</section>
    <section class="panel"><div class="panel-head"><h2>This week</h2><button class="btn ghost small" data-today-view="progress">View progress</button></div><div class="pw-week-stats"><div><strong>${completed}/${m.weeklySessions.length}</strong><span>Assigned activities completed</span></div><div><strong>${m.checkin ? (m.checkin.reviewed_at ? 'Reviewed' : 'Submitted') : 'Not submitted'}</strong><span>Weekly check-in</span></div></div><button class="btn primary" data-today-view="checkin">${m.checkin ? 'View weekly check-in' : 'Complete weekly check-in'}</button></section>
    ${m.week?.coach_note ? `<section class="panel"><span class="eyebrow">WEEKLY FOCUS</span><p class="cw-lines">${esc(m.week.coach_note)}</p></section>` : ''}
    ${m.checkin?.reviewed_at&&m.checkin?.review_channel!=='whatsapp'&&(m.checkin?.coach_response || m.checkin?.focus_next_week) ? `<section class="panel"><h2>Your coach’s next steps</h2>${m.checkin.coach_response ? `<p class="cw-lines">${esc(m.checkin.coach_response)}</p>` : ''}${m.checkin.focus_next_week ? `<p class="cw-lines">${esc(m.checkin.focus_next_week)}</p>` : ''}${safeMediaUrl(m.checkin.voice_note_url) ? `<a class="btn ghost" href="${esc(safeMediaUrl(m.checkin.voice_note_url))}" target="_blank" rel="noopener">Watch coach review</a>` : ''}</section>` : ''}
    ${nextCall ? `<section class="panel"><h2>Upcoming coaching review</h2><p>${esc(nextCall.title)} · ${fmt(nextCall.scheduled_at)} · ${nextCall.duration_minutes} minutes</p><button class="btn ghost" data-today-view="support">View agreed time & details</button></section>` : ''}`;
  bindCompletionActions(); bindOpenSessions(); bindMealPlanLinks();
  $$('[data-today-view]').forEach(b => b.onclick = () => {state.clientView=b.dataset.todayView;renderClient();});
  $('#todayStepForm').onsubmit = async e => {
    e.preventDefault(); const clientId=state.client.id, count=Number(new FormData(e.target).get('steps'));
    const row={client_id:clientId,entry_date:m.date,target_steps:goal,actual_steps:count};setBusy(e.submitter,true);
    try {
      const saved=state.preview ? row : (await query('Actual step count',db.from('step_entries').upsert(row,{onConflict:'client_id,entry_date'}).select()))[0];
      if(!saved)throw new Error('The step count was not saved.');
      if(state.client?.id!==clientId)return;
      const old=state.data.steps.find(s=>s.entry_date===m.date);if(old)Object.assign(old,saved);else state.data.steps.push(saved);
      clientToday();toast(state.preview?'Sample count saved locally':'Step count saved');
    }catch(error){toast(error.message,'error');setBusy(e.submitter,false);}
  };
};

function reviewFacts(c) {
  const parts=[];
  for(const [key,label] of [['energy','Energy'],['sleep','Sleep'],['stress','Stress'],['workload','Workload']])if(finiteRecorded(c[key]))parts.push(`${label} ${c[key]}/10`);
  if(c.busy_week)parts.push('Work constraints supplied');
  if(c.support_needed)parts.push('Support requested');
  return parts.join(' · ') || 'Open the submitted answers';
}
async function loadReviewQueue(page = 0) {
  if(state.preview){const records=state.sampleClientData?.size?[...state.sampleClientData].flatMap(([id,data])=>(data.checkins||[]).map(c=>({...c,client_id:id}))):(state.data.checkins||[]).map(c=>({...c,client_id:c.client_id || state.clients[0]?.id}));state.reviewRows=records.filter(c=>!c.reviewed_at);state.reviewCount=state.reviewRows.length;return;}
  const result=await db.from('checkins').select('id,client_id,submitted_at,period_start,weight_kg,week_number,energy,sleep,stress,workload,training_adherence,nutrition_adherence,busy_week,support_needed,coach_response,reviewed_at,source_system',{count:'exact'}).is('reviewed_at',null).order('submitted_at',{ascending:false}).order('id',{ascending:false}).range(page*50,page*50+49);
  if(result.error)throw new Error('Review queue: '+result.error.message);
  state.reviewRows=result.data || [];state.reviewCount=result.count ?? state.reviewRows.length;state.reviewPage=page;
}
async function renderReviewQueue(page = 0) {
  $('#coachMain').innerHTML=pageHead('COACH OPERATIONS','Client check-ins')+'<section class="panel" role="status">Loading submitted check-ins…</section>';
  try {
    await loadReviewQueue(page);if(state.coachView!=='reviews' || state.client)return;
    $('#coachMain').innerHTML=pageHead('COACH OPERATIONS','Client check-ins','<button class="btn ghost" id="refreshReviewQueue">Refresh</button>')+`<section class="panel"><p>${state.reviewCount} submitted check-ins awaiting a completed coach review. Historical records stay attached to their original week.</p>${state.reviewRows.map(c=>{const client=state.clients.find(x=>x.id===c.client_id);const corporate=(typeof firmState!=='undefined'&&firmState.loaded?firmState.participants:state.corporateMemberships || []).some(m=>m.client_id===c.client_id);return `<article class="pw-review-row"><div><h3>${esc(client?.display_name || 'Client')}</h3><small>${corporate?'Firm-sponsored':'1-to-1 client'} · ${fmt(c.submitted_at)}${c.week_number?` · Week ${c.week_number}`:''}</small><p>${esc(reviewFacts(c))}</p><small>Training ${c.training_adherence == null?'not recorded':c.training_adherence+'%'} · Nutrition ${c.nutrition_adherence == null?'not recorded':c.nutrition_adherence+'%'}${c.coach_response?' · Response drafted':''}</small></div><button class="btn primary" data-review-checkin="${esc(c.id)}" data-review-client="${esc(c.client_id)}">Review answers</button></article>`;}).join('') || '<div class="empty">No submitted check-ins require review. This does not mean every client has checked in.</div>'}<div class="pw-inline">${page>0?'<button class="btn ghost" id="previousReviews">Previous 50</button>':''}${(page+1)*50<state.reviewCount?'<button class="btn ghost" id="nextReviews">Next 50</button>':''}</div></section>`;
    $('#refreshReviewQueue').onclick=()=>renderReviewQueue(0);
    $('#previousReviews')&&($('#previousReviews').onclick=()=>renderReviewQueue(page-1));$('#nextReviews')&&($('#nextReviews').onclick=()=>renderReviewQueue(page+1));
    $$('[data-review-checkin]').forEach(b=>b.onclick=()=>openQueuedReview(b));
  }catch(error){renderError($('#coachMain'),error,()=>renderReviewQueue(page));}
}
async function openQueuedReview(button) {
  const client=state.clients.find(c=>c.id===button.dataset.reviewClient);if(!client)return toast('This client is unavailable. Refresh the roster.','error');
  setBusy(button,true);
  try {
    state.client=client;state.clientTab='check-ins';
    if(!state.preview)await loadClientData(client.id);else state.data=state.sampleClientData?.get(client.id)||state.data;
    renderCoach();
    const form=$(`[data-coach-review="${button.dataset.reviewCheckin}"]`);if(form){form.closest('details').open=true;form.scrollIntoView({block:'center',behavior:'smooth'});}
  }catch(error){state.client=null;toast(error.message,'error');renderReviewQueue();}
}
const beforeReviewCoachRender=renderCoach;
renderCoach=function(){if(!state.client&&state.coachView==='reviews'){$$('#coachNav button').forEach(b=>b.classList.toggle('active',b.dataset.coachView==='reviews'));$('.sidebar')?.classList.remove('open');return renderReviewQueue();}return beforeReviewCoachRender();};
const beforeOperationalDashboard=renderDashboard;
renderDashboard=function(){beforeOperationalDashboard();$('#coachMain').insertAdjacentHTML('afterbegin','<section class="panel"><div class="panel-head"><div><span class="eyebrow">COACH OPERATIONS</span><h2>Client check-ins</h2><p>Review submitted answers, write next steps and track completed responses across personal and firm clients.</p></div><button class="btn primary" id="openReviewQueue">Review check-ins</button></div></section>');$('#openReviewQueue').onclick=()=>{state.coachView='reviews';renderCoach();};};
function coachReplyEditor(checkin){
 const draft=(state.data.reviewDrafts||[]).find(row=>row.checkin_id===checkin.id&&row.client_id===state.client?.id&&row.coach_id===state.user?.id);
 return {draft,response_text:draft?draft.response_text||'':checkin.coach_response||'',video_url:draft?draft.video_url||'':checkin.voice_note_url||'',action_points:draft?draft.action_points||'':checkin.focus_next_week||'',available:state.preview||state.data.reviewDraftsAvailable!==false};
}
function rememberCoachReplyDraft(checkin,values){
 const row={checkin_id:checkin.id,client_id:state.client.id,coach_id:state.user?.id,response_text:values.response_text,video_url:values.video_url,action_points:values.action_points};
 const drafts=state.data.reviewDrafts||[],prior=drafts.find(d=>d.checkin_id===row.checkin_id&&d.client_id===row.client_id&&d.coach_id===row.coach_id);if(prior)Object.assign(prior,row);else drafts.push(row);state.data.reviewDrafts=drafts;state.data.reviewDraftsRevision=(state.data.reviewDraftsRevision||0)+1;return row;
}
async function reconcileCoachReplyDrafts(clientId,userId){
 if(state.preview)return true;const data=state.data,before=JSON.stringify(data.reviewDrafts||[]),revision=(data.reviewDraftsRevision||0)+1;data.reviewDraftsRevision=revision;data.reviewDraftsAvailable=false;const active=()=>state.data===data&&state.role==='coach'&&state.client?.id===clientId&&state.user?.id===userId,current=()=>active()&&data.reviewDraftsRevision===revision;
 try{const rows=await query('Private check-in reply drafts',db.from('coach_checkin_reply_drafts').select('*').eq('client_id',clientId).eq('coach_id',userId).order('updated_at',{ascending:false}).limit(250));if(!current())return active()&&data.reviewDraftsAvailable===true;if(!Array.isArray(rows)||JSON.stringify(data.reviewDrafts||[])!==before)return false;data.reviewDrafts=rows.filter(row=>row.client_id===clientId&&row.coach_id===userId);data.reviewDraftsAvailable=true;return true;}
 catch{return false;}
 finally{if(active())refreshCoachReplyAvailability();}
}
const beforeExplicitCoachCheckins=coachCheckins;
coachCheckins=function(){
  beforeExplicitCoachCheckins();
  $$('[data-checkin-response]').forEach(field=>{
    const c=state.data.checkins.find(c=>c.id===field.dataset.checkinResponse);if(!c)return;
    const reply=coachReplyEditor(c),card=field.closest('details');field.closest('label').remove();card.querySelector('[data-checkin-video]')?.closest('label').remove();
    card.insertAdjacentHTML('beforeend',`<form data-coach-review="${esc(c.id)}" class="editor-grid pw-review-form"><p class="wide muted" data-review-save-status role="status">${esc(coachReviewStatus(c))}</p><p class="wide muted" data-private-reply-status>${!reply.available?'Private reply drafts could not load. Refresh saved entries before editing an app reply.':reply.draft?'A saved private draft is loaded. It is not visible to the client.':'App replies stay private until you choose Publish review.'}</p><label class="wide">Reply through<select name="review_method"><option value="app" ${c.review_channel!=='whatsapp'?'selected':''}>App response / video</option><option value="whatsapp" ${c.review_channel==='whatsapp'?'selected':''}>WhatsApp</option></select></label><label class="wide">Coach response<textarea name="response_text" rows="4">${esc(reply.response_text)}</textarea></label><label class="wide">Agreed action points<textarea name="action_points" rows="3">${esc(reply.action_points)}</textarea></label><label class="wide">HTTPS Loom / review video<input name="video_url" type="url" pattern="https://.*" value="${esc(reply.video_url)}"></label><label class="toggle-field wide" data-whatsapp-complete><input name="mark_reviewed" type="checkbox" ${c.reviewed_at&&c.review_channel==='whatsapp'?'checked':''}> I have replied on WhatsApp</label><p class="wide muted" data-review-method-note hidden>Confirm you have already replied on WhatsApp. This saves review status only; no message is sent from the app.</p><div class="wide pw-inline" data-review-app-actions><button class="btn ghost" type="submit" formnovalidate data-review-action="draft">Save private draft</button><button class="btn primary" type="submit" data-review-action="publish">Publish review</button></div><button class="btn primary wide" type="submit" data-review-whatsapp-save hidden>Save WhatsApp review status</button>${c.reviewed_at&&c.review_channel!=='whatsapp'?'<details class="wide"><summary>Review options</summary><p>Reopening withdraws the app reply and keeps a private copy to edit.</p><button type="button" class="btn ghost small" data-review-reopen>Reopen and withdraw app reply</button></details>':''}</form>`);
    const form=card.querySelector('form[data-coach-review]'),method=form.elements.review_method;
    function syncMethod(){const whatsapp=method.value==='whatsapp',available=coachReplyEditor(c).available;form.querySelector('[data-review-method-note]').hidden=!whatsapp;form.querySelector('[data-whatsapp-complete]').hidden=!whatsapp;form.querySelector('[data-review-app-actions]').hidden=whatsapp;form.querySelector('[data-review-whatsapp-save]').hidden=!whatsapp;for(const name of ['response_text','action_points','video_url']){const input=form.elements[name];input.disabled=whatsapp||!available;input.closest('label').hidden=whatsapp;}for(const button of form.querySelectorAll('[data-review-action]'))button.disabled=whatsapp||!available;}
    method.onchange=()=>{if(method.value==='whatsapp')form.elements.mark_reviewed.checked=true;syncMethod();};form.syncReviewMethod=syncMethod;form.dataset.replyReady=String(reply.available);form.dataset.replyOwner=[state.user?.id,state.client?.id,state.role].join('|');syncMethod();
    form.onsubmit=e=>saveExplicitCoachReview(e,c);
    const reopen=form.querySelector('[data-review-reopen]');if(reopen){reopen.disabled=!reply.available;reopen.onclick=()=>reopenExplicitCoachReview(form,c,reopen);}
  });
};
function refreshCoachReplyAvailability(){
 if(state.role!=='coach')return;const owner=[state.user?.id,state.client?.id,state.role].join('|');
 for(const form of document.querySelectorAll('#clientWorkspaceBody [data-coach-review]')){
  if(form.dataset.replyOwner!==owner)continue;const checkin=state.data.checkins.find(row=>row.id===form.dataset.coachReview);if(!checkin)continue;const reply=coachReplyEditor(checkin);form.syncReviewMethod?.();const reopen=form.querySelector('[data-review-reopen]');if(reopen)reopen.disabled=!reply.available;if(!reply.available||form.dataset.replyReady==='true')continue;
  for(const name of ['response_text','video_url','action_points'])form.elements[name].value=reply[name];form.dataset.replyReady='true';const note=form.querySelector('[data-private-reply-status]');if(note)note.textContent=reply.draft?'The saved private draft is loaded. It is not visible to the client.':'Private draft storage is ready. Choose Publish review only when the reply is ready.';
 }
}
function coachReviewStatus(checkin){return checkin.reviewed_at?'Reviewed '+fmt(checkin.reviewed_at)+(checkin.review_channel==='whatsapp'?' · WhatsApp':checkin.review_channel==='app'?' · Published in app':''):'Awaiting completed coach review';}
function replyFormSnapshot(form){return JSON.stringify(['response_text','video_url','action_points','review_method'].map(name=>[name,form.elements[name]?.value]));}
async function saveExplicitCoachReview(event,checkin) {
  event.preventDefault();const form=event.target;if(form.dataset.saving==='true')return;
  const fd=new FormData(form),clientId=state.client?.id,userId=state.user?.id,role=state.role,whatsapp=fd.get('review_method')==='whatsapp',publish=!whatsapp&&event.submitter?.dataset.reviewAction==='publish';
  if(role!=='coach'||!clientId||checkin.client_id&&checkin.client_id!==clientId)return toast('Open this check-in in its coach workspace.','error');
  const active=()=>state.client?.id===clientId&&state.user?.id===userId&&state.role===role;
  if(!whatsapp&&!coachReplyEditor(checkin).available)return toast('Private drafts are unavailable. Refresh saved entries before saving this app reply.','error');
  const args={target_checkin_id:checkin.id,response_text:String(fd.get('response_text')||''),video_url:String(fd.get('video_url')||''),action_points:String(fd.get('action_points')||''),mark_reviewed:whatsapp?fd.has('mark_reviewed'):publish},snapshot=replyFormSnapshot(form);
  if(publish&&!args.response_text.trim()&&!args.video_url.trim())return toast('Add your response or video before publishing, or choose WhatsApp if you replied there.','error');
  if(publish&&args.video_url&&!safeMediaUrl(args.video_url))return toast('Use a valid HTTPS review link before publishing.','error');
  const status=form.querySelector('[data-review-save-status]'),privateStatus=form.querySelector('[data-private-reply-status]');if(status)status.textContent=whatsapp?'Saving review status…':publish?'Publishing review…':'Saving private draft…';form.dataset.saving='true';setBusy(event.submitter,true);
  try{
    let saved;
    if(state.preview){
     if(whatsapp)saved={...checkin,client_id:clientId,coach_response:null,voice_note_url:null,focus_next_week:null,reviewed_at:args.mark_reviewed?(checkin.reviewed_at||new Date().toISOString()):null,review_channel:args.mark_reviewed?'whatsapp':null};
     else saved=publish?{...checkin,client_id:clientId,coach_response:args.response_text,voice_note_url:args.video_url,focus_next_week:args.action_points,reviewed_at:new Date().toISOString(),review_channel:'app'}:{...checkin,client_id:clientId};
    }else saved=await query('Coach review',whatsapp?db.rpc('set_checkin_whatsapp_review',{p_checkin:checkin.id,p_reviewed:args.mark_reviewed}):db.rpc('save_checkin_review',args));
    if(saved?.id!==checkin.id||saved.client_id!==clientId)throw new Error('The review save was not confirmed. Your draft is still here.');if(!active())return;
    if(!whatsapp){if(publish){state.data.reviewDrafts=(state.data.reviewDrafts||[]).filter(row=>row.checkin_id!==saved.id);state.data.reviewDraftsRevision=(state.data.reviewDraftsRevision||0)+1;}else rememberCoachReplyDraft(saved,args);}
    Object.assign(checkin,saved);const index=state.data.checkins.findIndex(row=>row.id===saved.id);if(index>=0)state.data.checkins[index]=saved;
    if(whatsapp&&!state.preview){const ready=await reconcileCoachReplyDrafts(clientId,userId);if(!active())return;if(!ready&&form.isConnected&&privateStatus)privateStatus.textContent='Review status saved. Private replies could not refresh; use Refresh saved entries before editing an app reply.';}
    if(form.isConnected&&status)status.textContent=coachReviewStatus(saved);
    if(whatsapp){const external=saved.review_channel==='whatsapp';if(form.isConnected){form.elements.mark_reviewed.checked=!!saved.reviewed_at;if(saved.reviewed_at&&!external){form.elements.review_method.value='app';form.elements.review_method.onchange();}if(status&&saved.reviewed_at&&external)status.textContent+=' · No message sent from the app.';}toast(state.preview?'Sample review status saved locally':saved.reviewed_at?(external?'Reviewed via WhatsApp':'Existing app review kept'):'Check-in reopened');}
    else if(!publish){if(form.isConnected&&privateStatus)privateStatus.textContent='Private draft saved. '+(saved.reviewed_at?'The published review is unchanged.':'It is not visible to the client.')+(replyFormSnapshot(form)!==snapshot?' Your newer edits are still here; save again.':'');toast(state.preview?'Sample private draft saved locally':'Private draft saved');}
    else{if(form.isConnected){if(replyFormSnapshot(form)===snapshot)coachCheckins();else if(privateStatus)privateStatus.textContent='The submitted version was published. Your newer edits are still here; save privately or publish again when ready.';}toast(state.preview?'Sample review published locally':'Review published');}
  }catch(error){if(active()){if(status&&form.isConnected)status.textContent='Not saved. Your draft is still here; retry.';toast(error.message,'error');}}
  finally{delete form.dataset.saving;setBusy(event.submitter,false);if(active()&&form.isConnected)form.syncReviewMethod?.();}
}
async function reopenExplicitCoachReview(form,checkin,button){
 if(form.dataset.saving==='true'||!form.isConnected||state.role!=='coach'||!coachReplyEditor(checkin).available)return;const clientId=state.client?.id,userId=state.user?.id,copy=coachReplyEditor(checkin),status=form.querySelector('[data-review-save-status]');form.dataset.saving='true';setBusy(button,true);
 const active=()=>form.isConnected&&state.role==='coach'&&state.client?.id===clientId&&state.user?.id===userId;
 try{const saved=state.preview?{...checkin,coach_response:null,voice_note_url:null,focus_next_week:null,reviewed_at:null,review_channel:null}:await query('Reopen coach review',db.rpc('reopen_checkin_review',{p_checkin:checkin.id}));if(saved?.id!==checkin.id||saved.client_id!==clientId)throw Error('The review was not reopened.');if(!active())return;if(state.preview&&!copy.draft)rememberCoachReplyDraft(saved,copy);Object.assign(checkin,saved);const index=state.data.checkins.findIndex(row=>row.id===saved.id);if(index>=0)state.data.checkins[index]=saved;const ready=await reconcileCoachReplyDrafts(clientId,userId);if(!active())return;if(status)status.textContent='Review reopened. The app reply is withdrawn; your private draft and current edits are kept.'+(!ready?' Use Refresh saved entries before editing an app reply.':'');button.closest('details').hidden=true;toast(state.preview?'Sample review reopened locally':'Review reopened');}catch(error){if(active()){if(status)status.textContent='Not reopened. Your current reply and edits are unchanged.';toast(error.message,'error');}}finally{delete form.dataset.saving;setBusy(button,false);if(active())form.syncReviewMethod?.();}
}

const beforeTodayCompletionBindings=bindCompletionActions;
bindCompletionActions=function(){beforeTodayCompletionBindings();$$('[data-session-complete]').forEach(input=>{const save=input.onchange,clientId=state.client.id;input.onchange=async()=>{await save();if(state.clientView==='today'&&state.client?.id===clientId)clientToday();};});};
importTrainingJson=async function(event){
  event.preventDefault();let plan;
  try{plan=validateTrainingPlan(parsePastedPlanJson(new FormData(event.target).get('training_json')));}
  catch(error){const message='Invalid programme: '+error.message;const field=$('#trainingImportError');if(field){field.textContent=message;field.hidden=false;}return toast(message,'error');}
  $('#trainingImportError')&&($('#trainingImportError').hidden=true);
  const clientId=state.client.id;setBusy(event.submitter,true,'Saving draft…');
  try{
    if(state.preview){
      const stamp=Date.now(),program={id:'sample-program-'+stamp,name:plan.programme_name,status:'draft',source_json:plan,days:plan.days.map((day,i)=>({...day,id:'sample-day-'+stamp+'-'+i,day_index:day.weekday??day.day_index??Math.min(i,6),coach_notes:day.optional?'OPTIONAL / BACKUP. '+(day.coach_notes||''):day.coach_notes,exercises:(day.exercises||[]).map((exercise,j)=>({...exercise,id:'sample-exercise-'+stamp+'-'+i+'-'+j,sort_order:j}))}))};
      state.data.programs.unshift(program);state.data.exercises.push(...program.days.flatMap(day=>day.exercises));
    }else{
      const result=await query('Complete training import',db.rpc('import_client_training',{target_client_id:clientId,payload:plan}));
      if(!result?.programme_id)throw new Error('The programme draft was not saved.');
      await loadClientData(clientId);if(state.client?.id!==clientId)return;
    }
    toast(state.preview?'Sample programme draft saved locally':'Complete programme saved as a draft. Review it before scheduling.');coachTraining();
  }catch(error){const field=$('#trainingImportError');if(field){field.textContent=error.message;field.hidden=false;}toast(error.message,'error');setBusy(event.submitter,false);}
};
document.addEventListener('DOMContentLoaded',()=>{
  state.sampleClientData=state.sampleClientData||new Map();
  $('#coachNav')?.addEventListener('click',()=>{if(state.preview&&state.client)state.sampleClientData.set(state.client.id,state.data);},{capture:true});
  $('#coachNav')?.insertAdjacentHTML('beforeend','<button class="side-link" data-coach-view="reviews"><span>✓</span>Review queue</button>');
});



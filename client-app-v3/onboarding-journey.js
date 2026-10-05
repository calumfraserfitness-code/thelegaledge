/* Private persisted onboarding. Existing clients without enrollment retain their flow. */
const journeyDemo=new URLSearchParams(location.search).get('onboarding')==='demo';
const journeyLabels={payment:'Payment confirmation',welcome:'Your welcome',contract:'Your agreement',intake:'Your coaching profile',review:'Coach review',ready:'Coaching access'};
let journeyCurrent=null;
async function journeyCall(action,data={}){
 if(journeyDemo){const j=journeyCurrent;if(action==='welcome'){j.stage='contract';j.welcomed_at=new Date().toISOString();}if(action==='sign'){j.signature_name=data.name;j.address=data.address;j.signed_at=new Date().toISOString();j.stage='contract';}return j;}
 return query('Onboarding journey',db.rpc('journey_action',{p_client:state.client.id,p_action:action,p_data:data}));
}
function journeyCopy(j){
 const text=`<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(j.contract_title)}</title><style>body{font:16px/1.7 system-ui;max-width:750px;margin:40px auto;padding:24px}pre{white-space:pre-wrap;font:inherit}h1{color:#172333}</style><h1>${esc(j.contract_title)}</h1><p>Version ${esc(j.contract_version)}</p><pre>${esc(j.contract_body)}</pre><hr><p>Electronic signature: ${esc(j.signature_name)}<br>Postal address: ${esc(j.address)}<br>Signed at: ${esc(j.signed_at)}<br>Client record: ${esc(j.client_id)}<br>Electronic signature consent recorded.</p>${journeyDemo?'<p>FICTIONAL PREVIEW — NOT A REAL SIGNED AGREEMENT</p>':''}</html>`;
 const url=URL.createObjectURL(new Blob([text],{type:'text/html'}));const a=document.createElement('a');a.href=url;a.download='legal-edge-signed-agreement.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function journeyRail(j){
 const steps=Object.keys(journeyLabels),i=steps.indexOf(j.stage);
 return `<aside class="journey-rail"><div class="journey-wordmark"><span class="journey-monogram">LE</span><strong>THE LEGAL EDGE<small>PERSONAL COACHING</small></strong></div><div class="journey-rail-intro"><span class="eyebrow">A STRONGER START</span><h2>Built around<br><em>your life.</em></h2><p>A clear plan. Personal support.<br>One step at a time.</p></div><ol class="journey-steps">${steps.map((k,n)=>`<li class="${n<i?'complete':n===i?'current':''}"><span>${n<i?'✓':String(n+1).padStart(2,'0')}</span><div>${esc(journeyLabels[k])}${n===i?'<small>You are here</small>':''}</div></li>`).join('')}</ol><div class="journey-rail-footer"><span>CALUM FRASER</span><small>MSc Exercise Physiology · LLB</small><p>Your information stays in your private coaching account.</p></div></aside>`;
}
function journeyShell(j,content){return `<section class="journey-layout">${journeyRail(j)}<div class="journey-content"><div class="journey-topline"><span>YOUR COACHING JOURNEY</span>${journeyDemo?'<a href="?workspace=demo&section=corporate">Fictional preview · Back to app ↗</a>':'<span>Private account</span>'}</div><div class="journey-card">${content}</div><div class="journey-footnote">THE LEGAL EDGE <span>Personal coaching for demanding lives.</span></div></div></section>`;}
function journeyFrame(j,body){
 const keys=Object.keys(journeyLabels),index=keys.indexOf(j.stage);
 show('#clientApp');$('#clientNav').classList.add('hidden');$('.account-menu')?.classList.add('hidden');$('#clientMain').classList.add('journey-page');
 $('#clientMain').innerHTML=journeyShell(j,`<div class="journey-stage-caption"><span class="eyebrow">${j.stage==='ready'?'YOUR NEXT CHAPTER':`STEP ${String(index+1).padStart(2,'0')}`}</span>${j.payment_confirmed_at?'<span class="journey-confirmed">✓ Payment confirmed'+(journeyDemo?' · sample':'')+'</span>':''}</div>${body}<div class="journey-next"><span>COMING NEXT</span><strong>${index<5?esc(journeyLabels[keys[index+1]]):'Your personal coaching workspace'}</strong></div>${j.signed_at?'<button type="button" class="btn ghost" id="journeyCopy">↓ Your signed agreement</button>':''}`);
 $('#journeyCopy')?.addEventListener('click',()=>journeyCopy(j));
}
function journeyWrapExisting(j){
 const host=$('#clientMain'),nodes=[...host.childNodes];host.classList.add('journey-page');host.innerHTML=journeyShell(j,'<div id="journeyExisting"></div>');const target=$('#journeyExisting');nodes.forEach(n=>target.append(n));
}
function renderJourney(j){
 journeyCurrent=j;
 if(j.stage==='payment')return journeyFrame(j,'<h1>You’re in the right place.</h1><p>Your coach is confirming your payment. Your welcome will appear here as soon as it is confirmed.</p><button class="btn ghost" onclick="renderClient()">Check status</button>');
 if(j.stage==='welcome'){
  let video='';try{const u=new URL(j.welcome_url);if(u.protocol==='https:')video=/\.(mp4|webm)(\?|$)/i.test(u.href)?`<video controls playsinline preload="metadata" src="${esc(u.href)}"></video>`:`<a class="btn ghost" href="${esc(u.href)}" target="_blank" rel="noopener">Watch Calum’s welcome</a>`;}catch{}
  journeyFrame(j,`<h1>Your next chapter<br>starts <em>here.</em></h1><p>Your payment has been confirmed${journeyDemo?' in this fictional preview':''}. Watch your welcome, then we’ll take care of your agreement.</p>${journeyDemo?'<div class="journey-video-placeholder"><div class="journey-video-art"><span class="journey-monogram">LE</span><span class="journey-play">▶</span></div><div><span>WELCOME TO YOUR PROGRAMME</span><h3>A personal welcome from Calum</h3><small>Video space · add your recording to activate</small></div></div>':video}<button class="btn primary" id="journeyContinue">I’ve watched it · Continue</button>`);
  $('#journeyContinue').onclick=async e=>{setBusy(e.target,true);try{await journeyCall('welcome');renderClient();}catch(err){toast(err.message,'error');setBusy(e.target,false);}};return;
 }
 if(j.stage==='contract'){
  if(j.signed_at){renderLegalGate();$('.account-menu')?.classList.add('hidden');$('#clientMain .eyebrow').textContent='AGREEMENT SAVED · HEALTH & PRIVACY CONSENT';$('#clientMain').insertAdjacentHTML('afterbegin','<p class="journey-note">'+(journeyDemo?'FICTIONAL PREVIEW · ':'')+'Agreement saved. Complete your health and privacy consent to continue.</p>');journeyWrapExisting(j);$('#legalGate [name=signature_name]').value=j.signature_name||'';if(journeyDemo)$('#legalGate').onsubmit=e=>{e.preventDefault();j.stage='intake';renderJourney(j);};return;}
  journeyFrame(j,`<h1>Your coaching agreement.</h1><p>Read your agreement and sign below. A saved copy will be available to you and your coach.</p><article class="journey-contract"><h2>${esc(j.contract_title)}</h2><small>Version ${esc(j.contract_version)}</small><pre>${esc(j.contract_body)}</pre></article><form id="journeySign"><label>Full legal name<input name="name" autocomplete="name" minlength="2" required></label><label>Postal address<textarea name="address" autocomplete="street-address" minlength="8" required></textarea></label><label class="toggle-field"><input name="consent" type="checkbox" required> I have read this agreement, agree to its terms, and consent to signing electronically using my typed name.</label><button class="btn primary">Sign and continue</button></form>`);
  $('#journeySign').onsubmit=async e=>{e.preventDefault();setBusy(e.submitter,true);const f=new FormData(e.target);try{await journeyCall('sign',{name:f.get('name'),address:f.get('address'),consent:true});renderClient();}catch(err){toast(err.message,'error');setBusy(e.submitter,false);}};return;
 }
 if(j.stage==='intake'){
  renderOnboardingWizard();$('.account-menu')?.classList.add('hidden');$('#clientMain .eyebrow').textContent='STEP 4 OF 6';
  $('#clientMain').insertAdjacentHTML('afterbegin','<p class="journey-note">'+(journeyDemo?'FICTIONAL PREVIEW · ':'')+'Agreement complete. Your only next step is your coaching profile.</p>');
  journeyIntakePages();journeyWrapExisting(j);
  if(journeyDemo)$('#onboardingWizard').onsubmit=e=>{e.preventDefault();j.stage='review';j.intake_completed_at=new Date().toISOString();renderJourney(j);};return;
 }
 if(j.stage==='review'){journeyFrame(j,'<h1>You’re all set.</h1><p>Your intake is saved. Calum will review your answers and prepare your personalised plan. Your coaching workspace unlocks when he publishes it.</p><button class="btn ghost" id="journeyRefresh">Check for my plan</button>');$('#journeyRefresh').onclick=()=>{if(journeyDemo){j.stage='ready';renderJourney(j);}else boot();};return;}
 if(journeyDemo)journeyFrame(j,'<h1>Your coaching starts here.</h1><p>Training, meals, weekly planning, check-ins and progress — together in your own workspace.</p><a class="btn primary" href="?workspace=demo&person=0&view=client&tab=health">Connect your apps ↗</a><a class="btn ghost" href="?workspace=demo&person=0&view=client&tab=training">Explore your coaching</a>');
}
const beforeJourneyClient=renderClient;
renderClient=async function(){
 if(journeyDemo)return renderJourney(journeyCurrent);
 if(state.preview||state.role!=='client'||!state.client){$('#clientMain')?.classList.remove('journey-page');return beforeJourneyClient();}
 try{const rows=await query('Onboarding journey',db.from('onboarding_journeys').select('*').eq('client_id',state.client.id));const j=rows[0];journeyCurrent=j||null;if(j&&j.stage!=='ready')return renderJourney(j);if(j?.stage==='ready'&&state.client.plan_status!=='published'){const fresh=await query('Client status',db.from('clients').select('*').eq('id',state.client.id).single());state.client={...state.client,...fresh};}$('.account-menu')?.classList.remove('hidden');$('#clientMain').classList.remove('journey-page');return beforeJourneyClient();}catch(e){$('#clientMain').innerHTML='<section class="panel">Unable to check onboarding. Please refresh to retry.</section>';toast(e.message,'error');}
};
async function renderJourneyCoach(){
 show('#coachApp');const host=$('#coachMain');host.innerHTML='<section class="panel">Loading onboarding journeys…</section>';
 try{
 const rows=state.preview?[]:await query('Onboarding journeys',db.from('onboarding_journeys').select('*').order('created_at',{ascending:false}));
 const eligible=state.clients.filter(c=>c.profile_id&&c.onboarding_status!=='complete'&&!rows.some(j=>j.client_id===c.id));
 host.innerHTML=pageHead('COACH OPERATIONS','Client onboarding','')+`<section class="panel"><h2>One step at a time</h2><p>Payment → welcome → agreement & consent → intake → coach review → coaching access.</p><p class="muted">Payment is coach-confirmed. Copies are saved in the app; email delivery and automatic payment events are not connected.</p><a class="btn ghost" href="?onboarding=demo" target="_blank">Preview the client journey</a></section>${rows.map(j=>{const c=state.clients.find(c=>c.id===j.client_id);const hours=Math.floor((Date.now()-Date.parse(j.stage_started_at))/3600000);return `<section class="panel"><div class="panel-head"><div><h2>${esc(c?.display_name||'Client')}</h2><span class="pill">${esc(journeyLabels[j.stage])}</span><p>${hours>=48&& !['ready','review'].includes(j.stage)?'Needs follow-up · ':''}${hours}h in this step</p></div>${j.signed_at?`<button class="btn ghost" data-copy-journey="${esc(j.client_id)}">Signed agreement</button>`:''}</div>${j.stage==='payment'?`<form data-payment-client="${esc(j.client_id)}"><label>Verified payment receipt / reference<input name="reference" minlength="3" required></label><button class="btn primary">I’ve verified payment · Release welcome</button></form>`:''}<small>Started ${esc(new Date(j.created_at).toLocaleString())}${j.signed_at?` · Signed ${esc(new Date(j.signed_at).toLocaleString())}`:''}</small></section>`;}).join('')||'<section class="panel">No clients enrolled in the new journey yet. Existing clients keep their current access.</section>'}<section class="panel"><h2>Enroll a new client</h2><p>Create their secure account in Clients first, then add your welcome recording and approved agreement here. The agreement is frozen for this enrollment.</p><form id="journeyEnroll"><label>Client<select name="client" required><option value="">Choose a new linked client</option>${eligible.map(c=>`<option value="${esc(c.id)}">${esc(c.display_name)}</option>`).join('')}</select></label><label>Welcome video URL<input name="welcome_url" type="url" pattern="https://.*" required></label><label>Agreement title<input name="contract_title" required></label><label>Agreement version<input name="contract_version" required></label><label>Your approved agreement text<textarea name="contract_body" rows="10" minlength="40" required></textarea></label><button class="btn primary">Start onboarding · Await payment</button></form></section>`;
 host.querySelectorAll('[data-copy-journey]').forEach(b=>b.onclick=()=>journeyCopy(rows.find(j=>j.client_id===b.dataset.copyJourney)));
 host.querySelectorAll('[data-payment-client]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();await coachAction(f.dataset.paymentClient,'payment',{reference:new FormData(f).get('reference')},e.submitter);});
 $('#journeyEnroll').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const id=d.client;delete d.client;await coachAction(id,'enroll',d,e.submitter);};
 }catch(e){host.innerHTML='<section class="panel">Unable to load onboarding journeys. Refresh to retry.</section>';toast(e.message,'error');}
}
async function coachAction(id,action,data,button){setBusy(button,true);try{await query('Onboarding',db.rpc('journey_action',{p_client:id,p_action:action,p_data:data}));await renderJourneyCoach();}catch(e){toast(e.message,'error');setBusy(button,false);}}
const beforeJourneyCoach=renderCoach;
renderCoach=function(){if(state.coachView==='onboarding-journeys'&&!state.client)return renderJourneyCoach();return beforeJourneyCoach();};
document.addEventListener('DOMContentLoaded',()=>{
 const b=document.createElement('button');b.className='side-link';b.textContent='Onboarding';b.dataset.coachView='onboarding-journeys';b.onclick=()=>{state.client=null;state.coachView='onboarding-journeys';renderCoach();};$('#coachNav').append(b);
 const copy=document.createElement('button');copy.type='button';copy.textContent='Signed agreement';copy.onclick=async()=>{try{if(!state.client||state.preview)return toast('No signed agreement in this preview');const rows=await query('Agreement',db.from('onboarding_journeys').select('*').eq('client_id',state.client.id));if(rows[0]?.signed_at)journeyCopy(rows[0]);else toast('No signed agreement saved');}catch(e){toast(e.message,'error');}};$('.account-menu > div')?.prepend(copy);
 if(journeyDemo){state.preview=true;state.role='client';state.client={id:'fictional-onboarding-client',display_name:'Preview Client'};journeyCurrent={client_id:state.client.id,stage:'welcome',payment_confirmed_at:new Date().toISOString(),welcome_url:'',contract_title:'Fictional preview agreement',contract_version:'DEMO',contract_body:'This is sample text to demonstrate the signing step. It is not a coaching contract. Your coach supplies the actual approved agreement, including service scope, fees, cancellation terms and privacy information.'};renderJourney(journeyCurrent);}
});
// Refresh progress while the client is waiting; no notifications or emails are implied.
setInterval(()=>{if(!document.hidden&&!journeyDemo&&!state.preview&&state.role==='client'&&journeyCurrent&&['payment','review'].includes(journeyCurrent.stage))renderClient();},30000);

function journeyIntakePages(){
 const f=$('#onboardingWizard'),headings=[...f.querySelectorAll('h2')],grids=[...f.querySelectorAll('.editor-grid')],submit=f.querySelector('button[type="submit"],button.btn.primary');let step=0;
 const controls=document.createElement('div');controls.className='journey-intake-controls';controls.innerHTML='<button type="button" class="btn ghost" id="journeyBack">Back</button><button type="button" class="btn primary" id="journeyNext">Continue</button>';f.append(controls);
 function paint(){headings.forEach((h,i)=>h.hidden=i!==step);grids.forEach((g,i)=>g.hidden=i!==step);submit.hidden=step!==grids.length-1;$('#journeyBack').hidden=step===0;$('#journeyNext').hidden=step===grids.length-1;($('#journeyExisting .eyebrow')||$('#clientMain .eyebrow')).textContent=`COACHING PROFILE · ${step+1} OF ${grids.length}`;}
 $('#journeyBack').onclick=()=>{step--;paint();};$('#journeyNext').onclick=()=>{const invalid=[...grids[step].querySelectorAll('input,textarea,select')].find(x=>!x.checkValidity());if(invalid)return invalid.reportValidity();step++;paint();};paint();
}

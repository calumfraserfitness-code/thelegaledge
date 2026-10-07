/* Names and destinations only. Existing authentication and onboarding gates remain in force. */
function clearCoachNav(){
 const nav=document.querySelector('#coachNav');if(!nav)return;
 const names={dashboard:['⌂','Home'],clients:['◉','1-to-1 Clients'],firms:['▤','Corporate'],reviews:['✓','Check-ins']};
 for(const [key,[icon,label]] of Object.entries(names)){
  const b=nav.querySelector(`[data-coach-view="${key}"]`);if(b&&b.innerHTML!==`<span>${icon}</span>${label}`){b.innerHTML=`<span>${icon}</span>${label}`;b.title=label;b.dataset.clearName=label;}
 }
 const old=nav.querySelector('.coach-setup-nav');if(old)old.hidden=true;
 let settings=nav.querySelector('#clearCoachSettings');
 if(!settings){settings=document.createElement('button');settings.id='clearCoachSettings';settings.className='side-link';settings.innerHTML='<span>⚙</span>Settings';settings.onclick=e=>{e.stopPropagation();state.client=null;state.coachView='settings';renderCoach();};nav.append(settings);}
 const ordered=[...Object.keys(names).map(key=>nav.querySelector(`[data-coach-view="${key}"]`)),settings].filter(Boolean);
 let anchor=old||null;for(const b of ordered.reverse()){if(b.nextElementSibling!==anchor)nav.insertBefore(b,anchor);anchor=b;}
 settings.classList.toggle('active',!state.client&&['settings','my-health','connections','onboarding-journeys'].includes(state.coachView));
 clearSettingsBack();
}
const clearNavPrevious=simplifyCoachNavigation;
simplifyCoachNavigation=function(){clearNavPrevious();clearCoachNav();};
function coachingSettings(){
 const host=$('#coachMain');
 host.innerHTML=`<section class="clear-page"><span class="eyebrow">COACH SETTINGS</span><h1>Accounts & devices</h1><p>Choose the task you need to do.</p><div class="clear-task-grid">${[
 ['onboarding-journeys','New client onboarding','Set up their welcome, agreement and coaching profile.'],
 ['connections','Client devices','See whose phone or training app is sharing data.'],
 ['my-health','Connect my own phone','Connect your iPhone or Hevy account using this coach login.']
 ].map(([key,title,description])=>`<button type="button" class="clear-task" data-clear-setting="${key}"><strong>${title}</strong><span>${description}</span></button>`).join('')}</div><p class="clear-account-note">One sign-in opens your coach workspace. Clients use their own accounts; each person connects their own devices.</p></section>`;
 host.querySelectorAll('[data-clear-setting]').forEach(b=>b.onclick=()=>{state.client=null;state.coachView=b.dataset.clearSetting;renderCoach();});
}
function clearSettingsBack(){
 if(state.client||!['my-health','connections','onboarding-journeys'].includes(state.coachView))return;
 const host=$('#coachMain');if(!host||host.querySelector('#clearSettingsBack'))return;
 const b=document.createElement('button');b.id='clearSettingsBack';b.className='btn ghost clear-back';b.textContent='Back to settings';b.onclick=()=>{state.coachView='settings';renderCoach();};host.prepend(b);
}
const clearCoachRenderBefore=renderCoach;
renderCoach=function(){
 if(state.coachView==='settings'&&!state.client){coachingSettings();clearCoachNav();return;}
 const result=clearCoachRenderBefore();clearCoachNav();
 if(result?.then)result.then(clearSettingsBack).catch(()=>{});
 return result;
};
function clearWorkspaceTabs(){
 const tabs=$('#clientTabs');if(!tabs)return;
 const names={overview:'Summary',planner:'Weekly plan',training:'Training',nutrition:'Nutrition',checkins:'Check-ins',checkin:'Check-ins',progress:'Progress'};
 let details=tabs.querySelector('.le-more-tabs');
 if(!details){details=document.createElement('details');details.className='le-more-tabs';details.innerHTML='<summary>Client details</summary><div></div>';tabs.append(details);}
 else details.querySelector('summary').textContent='Client details';
 const extras={onboarding:'Intake answers',legal:'Agreement & consent',diagnostics:'Bloods & genetics',goals:'Goals',support:'Calls & messages',connections:'Devices'};
 for(const b of [...tabs.querySelectorAll('[data-client-tab]')]){
  const key=b.dataset.clientTab;
  if(names[key])b.textContent=names[key];
  if(extras[key]){b.textContent=extras[key];details.lastElementChild.append(b);if(state.clientTab===key)details.open=true;}
 }
 tabs.classList.add('clear-client-tabs');
 const host=$('#coachMain');if(!host.querySelector('#clearAllClients')){const b=document.createElement('button');b.id='clearAllClients';b.className='btn ghost clear-back';b.textContent='Back to clients';b.onclick=()=>{state.client=null;state.coachView='clients';renderCoach();};host.prepend(b);}
}
const clearWorkspaceBefore=renderClientWorkspace;
renderClientWorkspace=function(){const result=clearWorkspaceBefore();clearWorkspaceTabs();return result;};
const clearClientDestinations=[
 ['support','Your coach','Messages, voice notes and coaching calls.'],
 ['progress','Your progress','Measurements, goals and recorded readings.'],
 ['health','Devices & apps','Connect your phone, watch readings or Hevy.'],
 ['diagnostics','Bloods & genetics','View reports shared with your coach.']
];
function clearClientMore(){
 const destinations=[...clearClientDestinations];if(state.hasPilot||state.preview)destinations.push(['pilot','Firm resources','Materials for your firm programme.']);
 $('#clientMain').innerHTML=`<section class="clear-page"><span class="eyebrow">YOUR ACCOUNT</span><h1>More</h1><div class="clear-task-grid">${destinations.map(([key,title,description])=>`<button type="button" class="clear-task" data-clear-client-view="${key}"><strong>${title}</strong><span>${description}</span></button>`).join('')}</div></section>`;
 $('#clientMain').querySelectorAll('[data-clear-client-view]').forEach(b=>b.onclick=()=>{state.clientView=b.dataset.clearClientView;renderClient();});
}
function updateClientNav(){
 const nav=$('#clientNav');if(!nav)return;
 if(!nav.dataset.clearNavigation){
  nav.dataset.clearNavigation='true';nav.innerHTML=[['today','⌂','Today'],['planner','▦','Schedule'],['training','◇','Training'],['nutrition','○','Nutrition'],['checkin','✓','Check-in']].map(([key,icon,label])=>`<button data-client-view="${key}"><span>${icon}</span>${label}</button>`).join('')+'<button type="button" id="clearClientMore"><span>☰</span>More</button>';
  nav.querySelector('#clearClientMore').onclick=e=>{e.stopPropagation();state.clientView='more';renderClient();};
 }
 nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.clientView===state.clientView||(b.id==='clearClientMore'&&!['today','planner','training','nutrition','checkin'].includes(state.clientView))));
}
const clearClientRenderBefore=renderClient;
renderClient=function(){
 const ready=state.preview||(state.client?.onboarding_status==='complete'&&state.client?.plan_status==='published');
 if(state.clientView==='more'&&ready){$('#clientNav').classList.remove('hidden');clearClientMore();}else clearClientRenderBefore();
 updateClientNav();
};
function clearLogin(){
 const form=$('#loginForm');if(!form||form.dataset.clearLogin)return;form.dataset.clearLogin='true';
 const p=form.querySelector('h2 + p');if(p)p.textContent='Use your existing Legal Edge account. Your workspace opens automatically.';
 const footer=form.querySelector(':scope > p');if(footer)footer.textContent='Coach, client and firm accounts use this same sign-in.';
 const title=form.querySelector('h2');if(new URLSearchParams(location.search).get('setup')==='health'){title.textContent='Connect your own phone';if(p)p.textContent='Sign in with your existing account to open your phone setup.';}
 const preview=form.querySelector('a[href*="workspace=demo"]');if(preview){const detail=document.createElement('details');detail.className='clear-preview-link';detail.innerHTML='<summary>See a sample before signing in</summary>';preview.before(detail);detail.append(preview);preview.textContent='Open fictional preview';}
 const password=$('#password'),toggle=document.createElement('button');toggle.type='button';toggle.className='text-btn clear-password-toggle';toggle.textContent='Show password';toggle.setAttribute('aria-pressed','false');toggle.onclick=()=>{const visible=password.type==='password';password.type=visible?'text':'password';toggle.textContent=visible?'Hide password':'Show password';toggle.setAttribute('aria-pressed',String(visible));};password.closest('label').append(toggle);
 const original=form.onsubmit;let pending=false;
 form.onsubmit=async event=>{event.preventDefault();if(pending)return;pending=true;const button=form.querySelector('button[type="submit"]');setBusy(button,true,'Signing in…');try{await original(event);}catch{$('#authMsg').textContent='Could not sign in. Check your connection and try again.';}finally{pending=false;setBusy(button,false);}};
 $('#authMsg').setAttribute('role','status');$('#authMsg').setAttribute('aria-live','polite');
}
document.addEventListener('DOMContentLoaded',()=>{clearCoachNav();updateClientNav();clearWorkspaceTabs();clearLogin();});

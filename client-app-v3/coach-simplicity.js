/* Keep daily coaching separate from occasional setup. No data or permissions change. */
function simplifyCoachNavigation(){
 const nav=document.querySelector('#coachNav');if(!nav)return;
 const labels={dashboard:['⌂','Overview'],clients:['◉','1-to-1 clients'],firms:['▤','Corporate firms'],reviews:['✓','Weekly check-ins'],'onboarding-journeys':['＋','New client onboarding'],connections:['↗','Client connections'],'my-health':['♡','Your own devices']};
 let setup=nav.querySelector('.coach-setup-nav');
 if(!setup){setup=document.createElement('details');setup.className='coach-setup-nav';setup.innerHTML='<summary>⚙ <span>Setup</span></summary><div class="coach-setup-links"></div>';nav.append(setup);}
 const group=setup.querySelector('div');
 for(const b of [...nav.querySelectorAll('button')]){
  const key=b.dataset.coachView||(b.id==='coachHealthNav'?'my-health':null),label=labels[key];if(!label)continue;
  if(b.dataset.simpleLabel!==key){b.innerHTML=`<span>${label[0]}</span>${label[1]}`;b.dataset.simpleLabel=key;b.title=key==='my-health'?'Connect Calum’s own phone or watch':label[1];}
  if(['onboarding-journeys','connections','my-health'].includes(key)&&b.parentElement!==group)group.append(b);
  b.classList.toggle('active',!state.client&&state.coachView===key);
 }
 if(['onboarding-journeys','connections','my-health'].includes(state.coachView))setup.open=true;
 // Keep the four everyday destinations above Setup, even if added by another module.
 for(const key of ['dashboard','clients','firms','reviews']){const b=nav.querySelector(`[data-coach-view="${key}"]`);if(b&&b.parentElement===nav)nav.insertBefore(b,setup);}
}
function simplifyCoachOnboarding(){
 const host=document.querySelector('#coachMain'),form=host?.querySelector('#journeyEnroll');if(!form||form.dataset.simplified)return;form.dataset.simplified='true';host.classList.add('coach-onboarding-simple');
 const intro=host.querySelector('.page-head + .panel');if(intro){intro.innerHTML='<div class="panel-head"><div><h2>Welcome new clients</h2><p>Track their progress here. Set up a new journey only when someone joins.</p></div><a class="btn ghost" href="?onboarding=demo" target="_blank" rel="noopener">See the client experience ↗</a></div><p class="coach-journey-path">Welcome <span>→</span> Agreement <span>→</span> Coaching profile <span>→</span> Your review</p>';}
 const heading=host.querySelector('.page-head h1');if(heading)heading.textContent='New client onboarding';
 const panel=form.closest('.panel'),description=panel.querySelector('h2 + p');if(description)description.textContent='Choose their account, payment route and welcome materials. They complete the agreement and profile themselves.';
 const open=document.createElement('details');open.className='coach-setup-section';open.innerHTML='<summary><span>＋ Set up a new client</span><small>Account · payment · welcome · agreement</small></summary>';panel.insertBefore(open,form);open.append(form);
 const names=[['1','Client & payment',['client','funding_mode','funding_reference','payment_url','stripe_payment_link_id']],['2','Welcome video',['welcome_url']],['3','Agreement & privacy',['contract_title','contract_version','contract_body','privacy_version','privacy_body']]];
 for(const [number,title,fields] of names){const section=document.createElement('fieldset');section.className='coach-enroll-step';section.innerHTML=`<legend><span>${number}</span>${title}</legend>`;
 if(number==='1')section.insertAdjacentHTML('beforeend','<p>Personal clients pay for their place. Firm-funded employees skip payment.</p>');
 if(number==='2')section.insertAdjacentHTML('beforeend','<p>Your short welcome recording tells them what happens next.</p>');
 if(number==='3')section.insertAdjacentHTML('beforeend','<p>Use your approved documents. A signed copy stays in each client’s record.</p>');
 form.insertBefore(section,form.querySelector('button'));
 for(const name of fields){const label=form.querySelector(`[name="${name}"]`)?.closest('label');if(label)section.append(label);}
 if(number==='1'){const offer=form.querySelector('#journeyStripeOffer')?.closest('label');if(offer)section.insertBefore(offer,section.querySelector('[name=payment_url]')?.closest('label')||null);const note=[...form.querySelectorAll('small')].find(n=>n.textContent.includes('Stripe automatic'));if(note){note.textContent='Until automatic payment confirmation is connected, verify the receipt before releasing their welcome.';section.append(note);}const id=section.querySelector('[name=stripe_payment_link_id]')?.closest('label');if(id){const advanced=document.createElement('details');advanced.className='coach-enroll-advanced';advanced.innerHTML='<summary>Advanced Stripe matching</summary>';id.before(advanced);advanced.append(id);}}
 }
 const legalNote=[...form.children].find(n=>n.tagName==='P');if(legalNote){const detail=document.createElement('details');detail.className='coach-enroll-advanced';detail.innerHTML='<summary>What your privacy notice needs to cover</summary>';form.querySelector('fieldset:last-of-type').append(detail);detail.append(legalNote);}
 // Required fields remain native form controls and all original handlers remain attached.
 const resources=host.querySelector('#journeyResourceForm');if(resources){const p=resources.closest('.panel'),details=document.createElement('details');details.className='coach-setup-section';details.innerHTML='<summary><span>Starter materials</span><small>Articles, videos and downloads while clients wait for their plan</small></summary>';const h=p.querySelector('h2'),d=p.querySelector('h2 + p');h?.remove();d?.remove();while(p.firstChild)details.append(p.firstChild);p.append(details);}
 if(state.preview){const empty=[...host.querySelectorAll('section.panel')].find(p=>p.textContent.trim()==='No clients enrolled in the new journey yet. Existing clients keep their current access.');if(empty)empty.textContent='Sample preview: no real enrollment records are shown here.';}
}
document.addEventListener('DOMContentLoaded',()=>{
 let queued=false;const run=()=>{queued=false;simplifyCoachNavigation();simplifyCoachOnboarding();};
 const observe=()=>{if(queued)return;queued=true;requestAnimationFrame(run);};
 for(const id of ['coachNav','coachMain']){const el=document.getElementById(id);if(el)new MutationObserver(observe).observe(el,{childList:true,subtree:true});}run();
});

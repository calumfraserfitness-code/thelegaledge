/* One daily-health route; optional apps stay available without implying live access. */
function hubPhoneFirst(host,showSetup,apple){
 if(!showSetup)return;
 const grid=host.querySelector('.hub-grid'),title=host.querySelector('.hub-section-title');if(!grid||!title)return;
 const providers=[...grid.querySelectorAll('.hub-provider')];
 const phone=document.createElement('section');phone.className='hub-phone-start';
 phone.innerHTML=`<div><span class="eyebrow">START WITH YOUR PHONE</span><h2>Connect your daily health.</h2><p>Steps, sleep and optional health readings, alongside your coaching. Choose your phone to get started.</p><span class="hub-status ${apple.tone}">${esc(apple.label)}</span></div><div class="hub-phone-actions"><button class="btn primary" data-hub-provider="apple_health">${apple.tone==='ok'?'Manage iPhone connection':'iPhone / Apple Watch'}</button><button class="btn ghost" data-hub-provider="health_connect">Android availability</button><small>iPhone requires Health Auto Export’s paid automation feature. Automatic Android sharing is not available yet.</small></div>`;
 title.replaceWith(phone);
 const hevy=providers.find(p=>p.querySelector('[data-hub-provider=hevy]'));
 const heading=document.createElement('div');heading.className='hub-section-title';heading.innerHTML='<h2>Training app</h2><span>Optional · log workouts in Hevy</span>';grid.before(heading);
 const extra=document.createElement('details');extra.className='hub-other-apps';extra.innerHTML='<summary>Garmin, MyFitnessPal and other connection options</summary><p>Garmin and MyFitnessPal currently use the iPhone connection. Direct account connections are not enabled.</p><div class="hub-grid"></div>';grid.after(extra);
 for(const card of providers)if(card!==hevy)extra.querySelector('.hub-grid').append(card);
 grid.classList.add('hub-strength-only');
}


// The safe phone link lands in Connected health after the existing account gates.
let phoneEntryAccount=null;
const phoneEntryRenderBefore=renderClient;
renderClient=function(){
 const params=new URLSearchParams(location.search),account=state.preview?'preview':state.user?.id;
 if(params.get('setup')==='health'&&account&&phoneEntryAccount!==account){state.clientView='health';phoneEntryAccount=account;}
 return phoneEntryRenderBefore();
};

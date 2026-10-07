/* One daily-health route; optional apps stay available without implying live access. */
function hubPhoneFirst(host,showSetup,apple){
 if(!showSetup)return;
 const grid=host.querySelector('.hub-grid'),title=host.querySelector('.hub-section-title');if(!grid||!title)return;
 const providers=[...grid.querySelectorAll('.hub-provider')];
 const phone=document.createElement('section');phone.className='hub-phone-start';
 phone.innerHTML=`<div><span class="eyebrow">START WITH YOUR PHONE</span><h2>Share your health data.</h2><p>Free weekly reports and exports, alongside your coaching. Choose your phone to see the available routes.</p><span class="hub-status ${apple.tone}">${esc(apple.label)}</span></div><div class="hub-phone-actions"><button class="btn primary" data-hub-provider="apple_health">${apple.tone==='ok'?'Manage iPhone connection':'iPhone / Apple Watch'}</button><button class="btn ghost" data-hub-provider="health_connect">Android availability</button><small>No paid exporter required. Weekly reports work now; phone automation requires device setup and a successful first upload.</small></div>`;
 title.replaceWith(phone);
 const garmin=providers.find(p=>p.querySelector('[data-hub-provider=garmin]'));
 const heading=document.createElement('div');heading.className='hub-section-title';heading.innerHTML='<h2>Garmin watch</h2><span>Sync supported readings through your iPhone</span>';grid.before(heading);
 const extra=document.createElement('details');extra.className='hub-other-apps';extra.innerHTML='<summary>MyFitnessPal, Fitbit / Air and other apps</summary><p>MyFitnessPal can share nutrition totals through Apple Health. Direct Fitbit / Air access requires provider approval.</p><div class="hub-grid"></div>';grid.after(extra);
 for(const card of providers)if(card!==garmin)extra.querySelector('.hub-grid').append(card);
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

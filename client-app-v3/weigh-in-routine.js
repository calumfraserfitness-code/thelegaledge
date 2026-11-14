/* Three spaced weigh-ins, including a weekend reading, from this client's saved records. */
(function(){
 'use strict';
 const M=window.WeighInRoutineModel;
 function owner(){return [state.user?.id,state.role,state.client?.id,String(state.preview)].join('|');}
 function clientSurface(){return state.role==='client'||state.role==='coach'&&!!document.querySelector('#clientApp:not(.hidden)');}
 function read(){try{return state.client&&M?.plan(state.client,state.data,{now:new Date(),preview:state.preview});}catch{return null;}}
 function date(value){try{return fmt(value);}catch{return value;}}
 function remove(host){host?.querySelectorAll('[data-weighin-routine]').forEach(node=>node.remove());}
 function markup(plan,coach){
  const count=Number(plan.count)||0,target=Number(plan.target)||3;
  return '<div class="wir-heading"><div><span class="eyebrow">'+(coach?'CLIENT WEIGH-INS':'YOUR WEIGH-IN ROUTINE')+'</span><h2>At least '+target+' weigh-ins each week</h2></div><strong class="wir-count">'+esc(count)+'<small> recorded this week</small></strong></div><p>Use separate days spread through the week, including one Saturday or Sunday. For example: '+esc(plan.example||'Tuesday, Thursday and Saturday')+'. Choose days that suit you.</p><div class="wir-status" aria-label="This week’s weigh-in progress"><span>'+esc(count)+' / '+esc(target)+' minimum</span><span>Weekend: '+(plan.weekendDone?'recorded':'to do')+'</span><span>Days spread through week: '+(plan.spreadDone?'recorded':'in progress')+'</span></div><div class="wir-footer"><small>'+esc(date(plan.weekStart))+' – '+esc(date(plan.weekEnd))+' · '+(plan.complete?'Weekly routine recorded.':'Only saved readings count. Multiple entries on one day count once.')+'</small><button type="button" class="btn ghost small" data-weighin-log>'+ (coach?'Open weight log':'Log a weigh-in')+'</button></div>';
 }
 function focusWeight(host){const input=host?.querySelector('form input[name="weight_display"]');if(input){input.focus();input.scrollIntoView?.({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}
 function mountCard(host,plan,mode,place){
  if(!host)return;if(!plan){remove(host);return;}
  const key=owner();let card=host.querySelector('[data-weighin-routine]');
  if(!card){card=document.createElement('section');card.dataset.weighinRoutine=mode;card.className='panel weighin-routine';card.setAttribute('aria-label',mode==='coach'?'Client weigh-in routine':'Your weekly weigh-in routine');place(card);}
  const signature=JSON.stringify([key,mode,plan]);if(card.dataset.signature===signature)return;card.dataset.signature=signature;card.innerHTML=markup(plan,mode==='coach');
  card.querySelector('[data-weighin-log]').onclick=async()=>{
   if(!card.isConnected||owner()!==key)return;
   if(mode==='coach'){
    if(state.role!=='coach'||state.clientTab!=='progress'){state.clientTab='progress';await Promise.resolve(renderClientWorkspace());}
    if(owner()===key)focusWeight(document.querySelector('#clientWorkspaceBody'));
   }else{
    if(!clientSurface())return;
    if(state.clientView!=='progress'){state.clientView='progress';await Promise.resolve(renderClient());}
    if(owner()===key&&clientSurface())focusWeight(document.querySelector('#clientMain'));
   }
  };
 }
 function clientMount(plan){
  const host=document.querySelector('#clientMain');if(!host||!clientSurface())return;
  if(state.clientView==='today'){
   const home=host.querySelector('#personalCoachingHome');if(!home){remove(host);return;}
   mountCard(home,plan,'client',card=>{const next=home.querySelector('.pch-next');if(next)next.after(card);else home.prepend(card);});
  }else if(state.clientView==='progress'){
   const form=host.querySelector('#progressForm');if(!form){remove(host);return;}
   mountCard(host,plan,'client',card=>form.before(card));
  }else if(state.clientView==='checkin'){
   remove(host);const help=host.querySelector('#checkinWeightHelp');let note=host.querySelector('[data-weighin-instruction]');
   if(!plan||!help){note?.remove();return;}
   if(!note){note=document.createElement('p');note.dataset.weighinInstruction='';note.className='wir-checkin-note';help.after(note);}
   const text='Your weekly target: at least '+plan.target+' weigh-ins on separate, spread-out days, including one at the weekend. Log each reading in Progress; a check-in weight also counts for the day it is submitted.';
   if(note.textContent!==text)note.textContent=text;
  }else remove(host);
 }
 function coachMount(plan){
  const host=document.querySelector('#clientWorkspaceBody');if(!host||state.role!=='coach')return;
  if(!['overview','progress'].includes(state.clientTab)){remove(host);return;}
  mountCard(host,plan,'coach',card=>{const form=host.querySelector('#coachProgressForm');if(form)form.closest('.data-entry-panel')?.before(card);else{const summary=host.querySelector('.client-saved-summary');if(summary)summary.after(card);else host.prepend(card);}});
 }
 function mount(){const plan=read();clientMount(plan);coachMount(plan);}
 for(const name of ['clientToday','clientProgress','clientCheckin','coachOverview','coachProgress']){
  const before=window[name];if(typeof before!=='function')continue;window[name]=function(...args){const result=before(...args);mount();return result;};
 }
 for(const name of ['renderClient','renderClientWorkspace']){
  const before=window[name];if(typeof before!=='function')continue;window[name]=function(...args){const key=owner(),result=before(...args);Promise.resolve(result).then(()=>{if(owner()===key)mount();}).catch(()=>{});return result;};
 }
 window.WeighInRoutine={mount};
})();

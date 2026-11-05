/* Home shortcuts use the existing log forms and their confirmed save handlers. */
(function(){
 'use strict';
 let context=null,observer=null,scheduled=false,renderSequence=0,lastOwner='';const homeOwners=new WeakMap(),unfinished=new Map();
 const owner=()=>[state.user?.id,state.client?.id,state.role,String(state.preview)].join('|');
 const surface=()=>!!state.user?.id&&!!state.client?.id&&state.client.onboarding_status==='complete'&&['client','coach'].includes(state.role)&&!!document.querySelector('#clientApp:not(.hidden)');
 const category=s=>['mobility','recovery'].includes(s.training_type)?'mobility':s.training_type==='cardio'?'cardio':'weights';
 function week(){const value=typeof currentWeek==='function'?currentWeek():null;let start;try{start=window.CheckinStatus?.week(state.client);}catch{return null;}return value?.published&&(!start||value.week_start===start)&&(value.client_id===state.client?.id||state.preview&&!value.client_id)?value:null;}
 function sessions(){const value=week();return value?(state.data.sessions||[]).filter(s=>s.week_id===value.id&&(!s.client_id||s.client_id===state.client.id)).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.title||'').localeCompare(String(b.title||''),undefined,{numeric:true})):[];}
 function reset(){context=null;document.querySelectorAll('[data-home-quick-context]').forEach(node=>node.remove());}
 function same(saved){return surface()&&owner()===saved;}
 function fits(){return context&&same(context.owner)&&(context.kind==='weight'?state.clientView==='progress':state.clientView==='training'&&state.trainingCategory===context.category&&(context.kind!=='exercise'||state.selectedSessionId===context.session));}
 function focus(control){if(!control)return;for(let parent=control.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;control.focus();control.scrollIntoView?.({block:'center',behavior:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 function controls(host){
  if(!context)return {};
  if(context.kind==='weight'){const form=host.querySelector('#progressForm');return {form,control:form?.querySelector('[name="weight_display"]'),status:form?.querySelector('[data-progress-save-status]')};}
  if(context.kind==='cardio'){const form=Array.from(host.querySelectorAll('[data-cardio-id]')).find(f=>f.dataset.cardioId===(context.session||''));return {form,control:form?.querySelector('[name="activity"]'),status:host.querySelector('#cardioSaveStatus')?.textContent.trim()?host.querySelector('#cardioSaveStatus'):form?.querySelector('[data-cardio-status]')};}
  const practice=Array.from(host.querySelectorAll('[data-practice-session]')).find(input=>input.dataset.practiceSession===context.session);
  const complete=Array.from(host.querySelectorAll('[data-session-complete]')).find(input=>input.dataset.sessionComplete===context.session&&!input.disabled);
  const form=host.querySelector('[data-exercise-log]');
  return {form,control:practice||complete||form?.querySelector('input'),status:practice?.closest('label')?.querySelector('[data-practice-save]')||complete?.closest('.task')?.querySelector('[data-completion-status]')||form?.querySelector('.set-save-status')};
 }
 function values(form){return Object.fromEntries(Array.from(form.elements).filter(input=>input.name&&['INPUT','TEXTAREA','SELECT'].includes(input.tagName)&&!['file','password'].includes(input.type)).map(input=>[input.name,input.type==='checkbox'?input.checked:input.value]));}
 function localDay(){try{return window.CheckinStatus?.localDate(new Date(),state.client?.timezone||'Europe/Dublin')||new Date().toISOString().slice(0,10);}catch{return '';}}
 function draftKey(value=context){return value?[value.owner,localDay(),value.kind,value.session||''].join('|'):'';}
 function fill(form,fields){for(const [name,value]of Object.entries(fields)){const input=form.elements.namedItem(name);if(input&&'value'in input){if(input.type==='checkbox')input.checked=value;else input.value=value;}}}
 function unsavedNote(form,text){let note=form.querySelector('[data-home-quick-edits]');if(!note){note=document.createElement('p');note.dataset.homeQuickEdits='';note.className='muted wide';note.setAttribute('role','status');form.append(note);}if(note.textContent!==text)note.textContent=text;}
 function retainNewerTyping(form){
  if(!form||form.dataset.homeQuickBound==='true'||!['weight','cardio'].includes(context?.kind)||typeof form.onsubmit!=='function')return;
  form.dataset.homeQuickBound='true';const save=form.onsubmit,key=context.owner,kind=context.kind,session=context.session,entryKey=draftKey();let pending=false;
  const restored=unfinished.get(entryKey);if(restored){fill(form,restored.fields);form.dataset.homeQuickDirty='true';unfinished.delete(entryKey);unsavedNote(form,'Your unfinished entry is restored. Save it to record these values.');}
  const dirty=()=>{if(same(key)&&fits()&&context.kind===kind&&context.session===session)form.dataset.homeQuickDirty='true';};form.addEventListener('input',dirty);form.addEventListener('change',dirty);
  form.onsubmit=async function(event){
   if(pending){event.preventDefault();return;}if(!same(key)||!fits()){event.preventDefault();return;}
   const submitted=values(form);pending=true;form.dataset.homeQuickSaving='true';form.dataset.homeQuickDirty='true';
   try{return await save.call(this,event);}
   finally{
    pending=false;delete form.dataset.homeQuickSaving;
    if(!same(key)||!fits()||context.kind!==kind||context.session!==session)return;
    const changed=Object.entries(values(form)).filter(([name,value])=>value!==submitted[name]);
    const current=controls(document.querySelector('#clientMain')).form;
    if(changed.length&&current&&current!==form){
     fill(current,Object.fromEntries(changed));current.dataset.homeQuickDirty='true';unsavedNote(current,'Your newer entries are still here. Save again to record these changes.');focus(current.elements.namedItem(changed[0][0])||current.querySelector('input'));
    }
    sync();
   }
  };
 }
 function routeHeader(host){
  if(!fits()){reset();return;}
  let box=host.querySelector('[data-home-quick-context]');
  if(!box){
   box=document.createElement('section');box.className='panel home-quick-context';box.dataset.homeQuickContext='';
   box.innerHTML='<div><span class="eyebrow">QUICK LOG</span><h2></h2></div><button type="button" class="btn ghost small" data-home-quick-back>Back to Home</button><p class="muted" role="status" aria-live="polite" data-home-quick-status></p>';
   host.prepend(box);const key=context.owner;
   box.querySelector('[data-home-quick-back]').onclick=()=>{
    if(!same(key)||!fits()||!box.isConnected)return;
    if(host.querySelector('form[data-saving="true"],form[data-home-quick-saving="true"]')||Array.from(host.querySelectorAll('[data-practice-save],[data-completion-status],.set-save-status')).some(node=>/^Saving/i.test(node.textContent.trim()))){box.querySelector('[data-home-quick-status]').textContent='A save is still in progress. Wait for its confirmation before returning Home.';return;}
    const form=controls(host).form;if(form?.dataset.homeQuickDirty==='true'&&['weight','cardio'].includes(context.kind))unfinished.set(draftKey(),{day:localDay(),fields:values(form)});reset();state.clientView='today';renderClient();
   };
  }
  const title=context.kind==='weight'?'Log a weigh-in':context.kind==='cardio'?'Log completed cardio':'Your exercise log';
  if(box.querySelector('h2').textContent!==title)box.querySelector('h2').textContent=title;
  const actual=controls(host);retainNewerTyping(actual.form);
  const status=box.querySelector('[data-home-quick-status]'),text=actual.status?.textContent.trim(),newer=actual.form?.querySelector('[data-home-quick-edits]')?.textContent.trim();
  const message=context.kind==='exercise'?'Each exercise shows its own save confirmation beside the controls.':newer?[text,newer].filter(Boolean).join(' '):text||'Use the existing controls below. Your save confirmation appears beside the entry.';
  if(status.textContent!==message)status.textContent=message;
  if(context.focus){const pending=context;queueMicrotask(()=>{if(context!==pending||!fits())return;const current=controls(host).control;if(current?.isConnected){context.focus=false;focus(current);}});}
 }
 async function open(kind,session){
  if(!surface()||!['weight','cardio','exercise'].includes(kind))return;
  const key=owner(),rows=sessions(),chosen=session?rows.find(row=>row.id===session):null;
  if(kind==='weight'&&state.client.track_weight===false)return;
  if(kind!=='weight'&&(!week()||session&&!chosen))return;
  if(kind==='cardio'&&chosen&&chosen.training_type!=='cardio'||kind==='exercise'&&(!chosen||chosen.training_type==='cardio'))return;
  context={owner:key,kind,session:chosen?.id||null,category:kind==='cardio'?'cardio':chosen?category(chosen):null,focus:true};
  if(kind==='weight')state.clientView='progress';else{state.clientView='training';state.trainingCategory=context.category;state.selectedSessionId=context.session;}
  const sequence=++renderSequence;await Promise.resolve(renderClient());if(sequence!==renderSequence||!same(key))return;sync();
 }
 function choices(box,kind,key){
  if(!same(key)||state.clientView!=='today'||!box.isConnected)return;
  const target=box.querySelector('[data-home-quick-choices]'),rows=sessions().filter(s=>kind==='cardio'?s.training_type==='cardio':s.training_type!=='cardio');
  target.hidden=false;target.innerHTML='<h3>'+ (kind==='cardio'?'Which cardio did you complete?':'Choose the session you want to log')+'</h3><div class="home-quick-choices">'+rows.map(s=>'<button type="button" class="btn ghost" data-home-quick-session="'+esc(s.id)+'">'+esc(s.title||'Assigned session')+'<small>'+esc(category(s)==='mobility'?'Breathing, mobility or recovery':category(s)==='weights'?'Sets and session completion':'Your assigned cardio')+'</small></button>').join('')+(kind==='cardio'?'<button type="button" class="btn ghost" data-home-quick-other>Other cardio I completed<small>Use your existing extra-cardio log</small></button>':rows.length?'':'<p>No exercises are assigned in your published week yet.</p>')+'</div><button type="button" class="text-btn" data-home-quick-cancel>Close choices</button>';
  target.querySelectorAll('[data-home-quick-session]').forEach(button=>button.onclick=()=>{if(same(key)&&button.isConnected)open(kind,button.dataset.homeQuickSession);});
  target.querySelector('[data-home-quick-other]')?.addEventListener('click',()=>{if(same(key)&&target.isConnected)open('cardio');});
  target.querySelector('[data-home-quick-cancel]').onclick=()=>{if(same(key)&&target.isConnected){target.hidden=true;box.querySelector('[data-home-quick="'+kind+'"]')?.focus();}};
  target.querySelector('button')?.focus();
 }
 function home(host){
  const root=host.querySelector('#personalCoachingHome');if(!root)return;
  let box=root.querySelector('#homeQuickLog');const key=owner(),weight=state.client.track_weight!==false,published=!!week();
  if(homeOwners.has(root)&&homeOwners.get(root)!==key){box?.remove();root.querySelectorAll('.home-quick-weight-duplicate').forEach(button=>button.classList.remove('home-quick-weight-duplicate'));return;}homeOwners.set(root,key);
  if(!box){
   box=document.createElement('section');box.id='homeQuickLog';box.className='panel home-quick-log';
   box.innerHTML='<div class="home-quick-heading"><span class="eyebrow">QUICK LOG</span><h2>Record it when you’re ready.</h2></div><div class="home-quick-actions"></div><p class="muted" data-home-quick-note></p><div data-home-quick-choices hidden aria-live="polite"></div>';
   const before=root.querySelector('#clientWeeklyRecap,[data-pch-secondary]');if(before)before.before(box);else root.append(box);
  }
  const signature=[key,weight,published].join('|');
  if(box.dataset.signature!==signature){
   box.dataset.signature=signature;box.querySelector('.home-quick-actions').innerHTML=(weight?'<button type="button" class="btn ghost" data-home-quick="weight">Log weight</button>':'')+'<button type="button" class="btn ghost" data-home-quick="cardio" '+(!published?'disabled':'')+'>Log cardio</button><button type="button" class="btn ghost" data-home-quick="exercise" '+(!published?'disabled':'')+'>Exercises & ticks</button>';
   box.querySelector('[data-home-quick-note]').textContent=published?'Open your usual log directly. Saved entries show a confirmation beside the controls.':'Your cardio and exercise shortcuts become available when your current training week is published.';
   box.querySelector('[data-home-quick-choices]').hidden=true;
   box.querySelectorAll('[data-home-quick]').forEach(button=>button.onclick=()=>{if(!same(key)||!button.isConnected||state.clientView!=='today')return;const kind=button.dataset.homeQuick;if(kind==='weight')open(kind);else if(kind==='cardio'&&!sessions().some(s=>s.training_type==='cardio'))open(kind);else choices(box,kind,key);});
  }
  const note=box.querySelector('[data-home-quick-note]');if(unfinished.size&&note.textContent!=='Your unfinished entry is kept for this visit. Open its shortcut to continue.')note.textContent='Your unfinished entry is kept for this visit. Open its shortcut to continue.';
  root.querySelectorAll('[data-weighin-log]').forEach(button=>button.classList.toggle('home-quick-weight-duplicate',weight));
 }
 function watch(host){observer?.disconnect();observer=null;if(!host||!surface()||state.clientView!=='today'&&!context)return;observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;sync();});});observer.observe(host,{childList:true,subtree:true});}
 function sync(){
  observer?.disconnect();const host=document.querySelector('#clientMain');
  if(owner()!==lastOwner){unfinished.clear();lastOwner=owner();}
  for(const [key,draft]of unfinished)if(draft.day!==localDay())unfinished.delete(key);
  if(!surface()||!host){reset();return;}
  if(context&&!fits())reset();
  if(state.clientView==='today')home(host);else if(context)routeHeader(host);
  watch(host);
 }
 for(const name of ['clientToday','clientProgress','clientTraining']){const before=window[name];if(typeof before!=='function')continue;window[name]=function(...args){observer?.disconnect();const result=before.apply(this,args);sync();return result;};}
 const render=renderClient;renderClient=function(...args){observer?.disconnect();if(context&&!fits())reset();const key=owner(),result=render.apply(this,args);Promise.resolve(result).then(()=>{if(owner()===key)sync();}).catch(()=>{});return result;};
 window.ClientHomeQuickLog={mount:sync,open,sessions};
})();

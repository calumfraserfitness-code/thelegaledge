/* The weekly questions use the existing draft, upload and submission flow. */
(function(){
 'use strict';
 const outcomes={completed:'Completed',modified:'Completed with changes',missed:'Missed',planned:'Still to do'};
 function sessionReview(form,period){
  const week=(state.data.weeks||[]).find(w=>w.published&&w.week_start===period&&(!w.client_id||w.client_id===state.client.id));
  const sessions=(state.data.sessions||[]).filter(s=>week&&s.week_id===week.id&&(!s.client_id||s.client_id===state.client.id)&&['weights','resistance','cardio'].includes(s.training_type)).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.session_date).localeCompare(String(b.session_date)));
  const section=document.createElement('section');
  section.innerHTML='<h2>Workout details</h2>';
  const tracked=sessions.map(s=>{
   const label=document.createElement('label'),select=document.createElement('select');
   label.textContent=s.title+(s.source_metadata?.optional===true?' (optional session)':'');
   select.name='session_outcome_'+s.id;
   select.innerHTML='<option value="">Choose outcome (optional)</option>'+Object.entries(outcomes).map(([key,value])=>'<option value="'+key+'">'+value+'</option>').join('');
   if(s.status==='completed')select.value='completed';
   else if(s.session_date>window.CheckinStatus?.localDate?.(new Date(),state.client.timezone||'Europe/Dublin'))select.value='planned';
   label.append(select);section.append(label);
   return {session:s,select};
  });
  function update(){
   const selected=tracked.filter(({session})=>session.source_metadata?.optional!==true);
   const result=selected.length&&selected.every(({select})=>select.value&&select.value!=='planned')?Math.round(100*selected.filter(({select})=>select.value!=='missed').length/selected.length):null;
   return {result,details:Object.fromEntries(tracked.filter(({select})=>select.value).map(({session,select},i)=>['Session '+(i+1),session.title+' — '+outcomes[select.value]]))};
  }
  form.weeklyTrainingReview=update;
  return section;
 }
 function mount(){
  if(state.client?.onboarding_status==='complete'){
   document.querySelector('#clientMain .client-page-head')?.classList.add('pch-checkin-hero','pch-start-hero');
  }
  const form=document.querySelector('#checkinForm');
  if(!form||form.dataset.quickView||!state.client||!['client','coach'].includes(state.role))return;
  const stages=[...form.querySelectorAll('[data-checkin-stage]')],weight=form.querySelector('[name="weight_display"]');
  if(stages.length!==3||!weight)return;
  form.dataset.quickView='true';
  const details=document.createElement('details');details.className='checkin-extra';details.dataset.checkinExtra='';
  const summary=document.createElement('summary');summary.textContent='Add optional details';details.append(summary);
  const period=form.elements.period_start.value,client=state.client,zone=client.timezone||'Europe/Dublin';
  const due=window.CheckinStatus?.due?.(client,period);
  const heading=document.querySelector('#clientMain .client-page-head');
  if(heading){
   heading.querySelector('.eyebrow')?.remove();
   const title=heading.querySelector('h1');if(title)title.textContent='Weekly check-in';
   heading.querySelector('p')?.remove();
  }
  const weightLabel=weight.closest('label');
  weightLabel.firstChild.textContent='Current weight ('+(client.weight_unit==='lbs'?'lb':'kg')+')';
  const weightHelp=form.querySelector('#checkinWeightHelp');
  if(weightHelp){
   weightHelp.textContent=weightHelp.textContent.split('Enter a new reading')[0].trim()+' Leave blank if you haven’t weighed.';
  }
  const main=document.createElement('section');
  main.className='checkin-main';
  main.append(weightLabel);
  if(weightHelp)main.append(weightHelp);
  main.insertAdjacentHTML('beforeend',
   '<label>How did training go?<textarea name="challenges" rows="2" maxlength="1200" required placeholder="What did you get done? What changed or got in the way?"></textarea></label>'+
   '<label>How did your food plan go?<textarea name="food_summary" rows="2" maxlength="1200" required placeholder="What worked well? Where did you struggle?"></textarea></label>');
  const recovery=document.createElement('fieldset');
  recovery.className='checkin-recovery';
  recovery.innerHTML='<legend>Energy, sleep and stress <small>Optional</small></legend>';
  for(const name of ['energy','sleep','stress']){
   const score=form.querySelector('[name="'+name+'"]')?.closest('fieldset');
   if(score)recovery.append(score);
  }
  main.append(recovery);
  const support=form.querySelector('[name="support_needed"]');
  if(support){
   support.rows=2;support.maxLength=1200;support.placeholder='A question, a change you need, or a busy week coming up';
   const label=support.closest('label');label.firstChild.textContent='What can I help with next week? ';
   const optional=document.createElement('small');optional.textContent='Optional';label.insertBefore(optional,support);
   main.append(label);
  }
  stages[0].before(main);
  const picker=document.querySelector('#checkinWeekChoice');
  if(picker&&heading){
   const bar=picker.closest('section');
   bar.classList.add('checkin-week-picker');
   bar.querySelector('p')?.remove();
   if(due&&+due>Date.now()){
    const deadline=document.createElement('small');
    deadline.textContent='Due '+new Intl.DateTimeFormat('en',{timeZone:zone,weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(due);
    bar.append(deadline);
   }
   heading.after(bar);
  }
  const training=sessionReview(form,period);
  if(training.querySelector('select'))details.append(training);
  const steps=form.querySelector('.refresh-connected');if(steps)details.append(steps);
  form.querySelector('[name="training_adherence"]')?.closest('fieldset')?.remove();
  form.querySelector('[name="nutrition_adherence"]')?.closest('fieldset')?.remove();
  for(const section of stages){
   section.querySelector('h2')?.remove();
   section.querySelector(':scope > p.muted:not(#checkinWeightHelp)')?.remove();
   if(!section.children.length)continue;
   section.hidden=false;details.append(section);
  }
  const nav=form.querySelector('.refresh-checkin-navigation');if(nav)nav.before(details);else form.append(details);
  form.querySelector('.refresh-checkin-progress')?.setAttribute('hidden','');
  for(const id of ['checkinBack','checkinNext']){const button=form.querySelector('#'+id);if(button)button.hidden=true;}
  const submit=form.querySelector('#checkinSubmit');if(submit)submit.hidden=false;
  // Native validation must reveal any invalid optional field before focusing it.
  form.addEventListener('invalid',e=>{if(details.contains(e.target))details.open=true;},true);
  const submitCheckin=form.onsubmit;
  form.onsubmit=function(event){
   for(const field of form.querySelectorAll('textarea[required]'))field.value=field.value.trim();
   if(!form.reportValidity()){event.preventDefault();return;}
   return submitCheckin.call(this,event);
  };
 }
 const before=clientCheckin;clientCheckin=function(){const result=before();mount();return result;};
 const render=renderClient;renderClient=function(){const user=state.user?.id,id=state.client?.id,result=render();Promise.resolve(result).then(()=>{if(state.user?.id===user&&state.client?.id===id&&state.clientView==='checkin')mount();}).catch(()=>{});return result;};
 window.CheckinQuickView={mount};
})();

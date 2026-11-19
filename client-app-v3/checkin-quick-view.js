/* Short default check-in; move the existing controls, draft and submit handlers intact. */
(function(){
 'use strict';
 const outcomes={completed:'Completed',modified:'Completed with changes',missed:'Missed'};
 function sessionReview(form,period){
  const week=(state.data.weeks||[]).find(w=>w.published&&w.week_start===period&&(!w.client_id||w.client_id===state.client.id));
  const sessions=(state.data.sessions||[]).filter(s=>week&&s.week_id===week.id&&(!s.client_id||s.client_id===state.client.id)&&['weights','resistance','cardio'].includes(s.training_type)).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.session_date).localeCompare(String(b.session_date)));
  const section=document.createElement('section');
  section.innerHTML='<h2>Training this week</h2><p>Confirm what you completed, changed or missed. A workout without a saved log still counts if you did it.</p>';
  const tracked=sessions.map((s,i)=>{
   const label=document.createElement('label'),select=document.createElement('select');
   label.textContent=s.title+(s.source_metadata?.optional===true?' (optional session)':'');
   select.name='session_outcome_'+s.id;
   select.required=s.source_metadata?.optional!==true;
   select.innerHTML='<option value="">'+(select.required?'Choose outcome':'Leave unanswered')+'</option>'+Object.entries(outcomes).map(([key,value])=>'<option value="'+key+'">'+value+'</option>').join('');
   if(s.status==='completed')select.value='completed';
   label.append(select);section.append(label);
   return {session:s,select};
  });
  section.insertAdjacentHTML('beforeend','<label>'+ (tracked.length?'What got in the way or changed?':'What training did you do or miss?')+'<textarea name="challenges" rows="2" maxlength="1200" placeholder="'+(tracked.length?'Tell Calum why you changed or missed a workout.':'Include workouts planned and completed, or write “No training this week”.')+'"></textarea></label>');
  const changes=section.querySelector('textarea');
  function update(){
   changes.required=!tracked.length||tracked.some(({select})=>['missed','modified'].includes(select.value));
   const selected=tracked.filter(({select})=>select.required);
   const result=selected.length&&selected.every(({select})=>select.value)?Math.round(100*selected.filter(({select})=>select.value!=='missed').length/selected.length):null;
   return {result,details:Object.fromEntries(tracked.filter(({select})=>select.value).map(({session,select},i)=>['Session '+(i+1),session.title+' — '+outcomes[select.value]]))};
  }
  update();section.addEventListener('change',update);
  form.weeklyTrainingReview=update;
  return section;
 }
 function mount(){
  const form=document.querySelector('#checkinForm');
  if(!form||form.dataset.quickView||!state.client||!['client','coach'].includes(state.role))return;
  const stages=[...form.querySelectorAll('[data-checkin-stage]')];if(stages.length!==3)return;
  form.dataset.quickView='true';
  const details=document.createElement('details');details.className='checkin-extra';details.dataset.checkinExtra='';
  const summary=document.createElement('summary');summary.textContent='Add measurements, wins or a voice note';details.append(summary);
  const period=form.elements.period_start.value,client=state.client,zone=client.timezone||'Europe/Dublin';
  const due=window.CheckinStatus?.due?.(client,period);
  const intro=document.createElement('p');intro.className='muted';intro.textContent=due?'Submit by '+window.CheckinStatus.stamp(due,zone)+'. Review your training, food and what you need from Calum.':'Review your training, food and what you need from Calum.';stages[0].before(intro);
  const training=sessionReview(form,period);intro.after(training);
  const next=document.createElement('section');next.innerHTML='<h2>Food and next week</h2><label>How did your food plan go?<textarea name="food_summary" rows="2" maxlength="1200" required placeholder="What worked? What slipped? Think lunch, snacks and late nights."></textarea></label>';
  training.after(next);
  const support=form.querySelector('[name="support_needed"]');
  if(support){support.required=true;support.maxLength=1200;support.placeholder='A change, question or upcoming deadline. Write “All good” if you need no help.';support.closest('label').firstChild.textContent='What can Calum help you with?';next.append(support.closest('label'));}
  form.querySelector('[name="training_adherence"]')?.closest('fieldset')?.remove();
  form.querySelector('[name="nutrition_adherence"]')?.closest('fieldset')?.remove();
  const workload=form.querySelector('[name="workload"]')?.closest('fieldset');if(workload)details.append(workload);
  for(const section of stages.slice(1)){section.hidden=false;details.append(section);}
  const nav=form.querySelector('.refresh-checkin-navigation');if(nav)nav.before(details);else form.append(details);
  form.querySelector('.refresh-checkin-progress')?.setAttribute('hidden','');
  for(const id of ['checkinBack','checkinNext']){const button=form.querySelector('#'+id);if(button)button.hidden=true;}
  const submit=form.querySelector('#checkinSubmit');if(submit)submit.hidden=false;
  // Native validation must reveal any invalid optional field before focusing it.
  form.addEventListener('invalid',e=>{if(details.contains(e.target))details.open=true;},true);
  // Restore disclosure state on the form itself; no answers enter browser storage.
  details.addEventListener('toggle',()=>{summary.textContent=details.open?'Additional check-in details':'Add measurements, wins or a voice note';});
  const submitCheckin=form.onsubmit;
  form.onsubmit=function(event){
   form.weeklyTrainingReview();
   for(const field of form.querySelectorAll('textarea[required]'))field.value=field.value.trim();
   if(!form.reportValidity()){event.preventDefault();return;}
   return submitCheckin.call(this,event);
  };
 }
 const before=clientCheckin;clientCheckin=function(){const result=before();mount();return result;};
 const render=renderClient;renderClient=function(){const user=state.user?.id,id=state.client?.id,result=render();Promise.resolve(result).then(()=>{if(state.user?.id===user&&state.client?.id===id&&state.clientView==='checkin')mount();}).catch(()=>{});return result;};
 window.CheckinQuickView={mount};
})();

/* Short default check-in; move the existing controls, draft and submit handlers intact. */
(function(){
 'use strict';
 function mount(){
  const form=document.querySelector('#checkinForm');
  if(!form||form.dataset.quickView||!state.client||!['client','coach'].includes(state.role))return;
  const stages=[...form.querySelectorAll('[data-checkin-stage]')];if(stages.length!==3)return;
  form.dataset.quickView='true';
  const details=document.createElement('details');details.className='checkin-extra';details.dataset.checkinExtra='';
  const summary=document.createElement('summary');summary.textContent='Add routine, measurements, wins or a voice note';details.append(summary);
  const intro=document.createElement('p');intro.className='muted';intro.textContent='Busy week? Share your scores and what you need from Calum, then submit. Add the details below when useful. Blank answers stay unanswered.';stages[0].before(intro);
  const support=form.querySelector('[name="support_needed"]')?.closest('label');if(support)stages[0].after(support);
  const workload=form.querySelector('[name="workload"]')?.closest('fieldset');if(workload)details.append(workload);
  for(const section of stages.slice(1)){section.hidden=false;details.append(section);}
  const nav=form.querySelector('.refresh-checkin-navigation');if(nav)nav.before(details);else form.append(details);
  form.querySelector('.refresh-checkin-progress')?.setAttribute('hidden','');
  for(const id of ['checkinBack','checkinNext']){const button=form.querySelector('#'+id);if(button)button.hidden=true;}
  const submit=form.querySelector('#checkinSubmit');if(submit)submit.hidden=false;
  // Native validation must reveal any invalid optional field before focusing it.
  form.addEventListener('invalid',e=>{if(details.contains(e.target))details.open=true;},true);
  // Restore disclosure state on the form itself; no answers enter browser storage.
  details.addEventListener('toggle',()=>{summary.textContent=details.open?'Additional check-in details':'Add routine, measurements, wins or a voice note';});
 }
 const before=clientCheckin;clientCheckin=function(){const result=before();mount();return result;};
 const render=renderClient;renderClient=function(){const user=state.user?.id,id=state.client?.id,result=render();Promise.resolve(result).then(()=>{if(state.user?.id===user&&state.client?.id===id&&state.clientView==='checkin')mount();}).catch(()=>{});return result;};
 window.CheckinQuickView={mount};
})();

/* The weekly questions use the existing draft, upload and submission flow. */
(function(){
 'use strict';
 function goalContext(client,data,period){
  const current=period===window.CheckinStatus?.week?.(client);
  if(!current)return {summary:'',targets:[],recap:null};
  const targets=(data.coachingGoals||[]).filter(g=>g.client_id===client.id&&g.status==='active');
  const recap=(data.coachingGuidance||[]).filter(g=>g.client_id===client.id&&g.published&&/^Call recap · \d{4}-\d{2}-\d{2}$/.test(g.title))
   .sort((a,b)=>b.title.localeCompare(a.title)||String(b.created_at).localeCompare(String(a.created_at)))[0];
  return {summary:String(client.goal_summary||'').trim(),targets,recap};
 }
 function targetText(goal,client){
  if(!finiteRecorded(goal.target))return goal.title;
  const pounds=goal.metric==='weight_kg'&&client.weight_unit==='lbs';
  const value=Number(goal.target)*(pounds?2.2046226218:1);
  const unit=pounds?'lb':goal.unit||'';
  return goal.title+' · '+Number(value.toFixed(1)).toLocaleString()+(unit?' '+unit:'');
 }
 function goalPanel(goals,client){
  if(!goals.summary&&!goals.targets.length&&!goals.recap)return null;
  const box=document.createElement('section');box.className='checkin-goals';
  box.innerHTML='<h2>Your agreed goals</h2>'+(goals.summary?'<p>'+esc(goals.summary)+'</p>':'')+
   (goals.targets.length?'<ul>'+goals.targets.map(g=>'<li>'+esc(targetText(g,client))+'</li>').join('')+'</ul>':'')+
   (goals.recap?'<details><summary>Latest agreed call recap · '+esc(fmt(goals.recap.title.slice(13)))+'</summary><p class="cw-lines">'+esc(goals.recap.body)+'</p></details>':'');
  return box;
 }
 function progressPanel(period,client){
  const section=document.createElement('section');section.className='checkin-progress-metrics';
  const week=(state.data.weeks||[]).find(w=>w.published&&w.week_start===period&&(!w.client_id||w.client_id===client.id));
  const lifts=(state.data.sessions||[]).filter(s=>week&&s.week_id===week.id&&(!s.client_id||s.client_id===client.id)&&
   ['weights','resistance'].includes(s.training_type)&&s.source_metadata?.optional!==true);
  const recorded=lifts.filter(s=>s.status==='completed').length;
  section.innerHTML='<h2>Progress this week</h2><div class="checkin-counts">'+
   '<label>Strength sessions completed<input name="strength_sessions_completed" type="number" min="0" max="28" step="1" inputmode="numeric">'+
   (lifts.length?'<small>'+recorded+' logged · '+lifts.length+' assigned. Include any you did outside the app.</small>':'<small>Include any sessions you did outside the app.</small>')+'</label>'+
   '<label>Days you followed your food plan<input name="nutrition_days_on_plan" type="number" min="0" max="7" step="1" inputmode="numeric"><small>Out of 7. Leave blank if you’re unsure.</small></label></div>';
  const previous=(state.data.checkins||[]).filter(r=>r.client_id===client.id&&r.period_start<period)
   .sort((a,b)=>b.period_start.localeCompare(a.period_start))[0];
  const values=previous?.original_answers||{};
  const last=[['Strength sessions completed','strength sessions'],['Days following the food plan','days on the food plan']]
   .filter(([k])=>finiteRecorded(values[k])).map(([k,label])=>Number(values[k])+' '+label);
  if(last.length)section.insertAdjacentHTML('beforeend','<small>Last check-in ('+esc(fmt(previous.period_start))+') · '+esc(last.join(' · '))+'</small>');
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
   const previous=weightHelp.textContent.split('Enter a new reading')[0].trim().replace('Latest saved weigh-in:', 'Last logged:');
   weightHelp.textContent=previous;
   const optional=document.createElement('small');optional.textContent='Optional';
   weightLabel.insertBefore(optional,weight);
  }
  const main=document.createElement('section');
  main.className='checkin-main';
  const weighIn=document.createElement('section');
  weighIn.className='checkin-weigh-in';
  weighIn.append(weightLabel);
  if(weightHelp)weighIn.append(weightHelp);
  main.append(weighIn);
  const goals=goalContext(client,state.data,period),agreed=goalPanel(goals,client);
  if(agreed)main.append(agreed);
  main.append(progressPanel(period,client));
  form.checkinGoalSnapshot=[goals.summary,...goals.targets.map(g=>targetText(g,client))].filter(Boolean).join(' · ').slice(0,2000);

  main.insertAdjacentHTML('beforeend',
   '<section class="checkin-reflection" aria-label="Training and food notes"><label>What improved in training, and what held you back?<textarea name="challenges" rows="2" maxlength="1200" required placeholder="Name a lift, session or rep improvement, or tell me what stopped you training."></textarea></label>'+
   '<label>What helped or got in the way with food?<textarea name="food_summary" rows="2" maxlength="1200" required placeholder="Tell me where meals went to plan or what made it difficult."></textarea></label></section>');
  const recovery=document.createElement('fieldset');
  recovery.className='checkin-recovery';
  recovery.innerHTML='<legend>Recovery <small>Optional</small></legend>';
  for(const name of ['energy','sleep','stress']){
   const score=form.querySelector('[name="'+name+'"]')?.closest('fieldset');
   if(score)recovery.append(score);
  }
  main.append(recovery);
  main.insertAdjacentHTML('beforeend','<section class="checkin-next-week"><h2>Next week</h2><label>What’s one action you’ll commit to next week?<textarea name="next_week_availability" rows="2" maxlength="1200" required placeholder="Pick one step toward your goal and, if useful, say when you’ll do it."></textarea></label></section>');
  const support=form.querySelector('[name="support_needed"]');
  if(support){
   support.rows=2;support.maxLength=1200;support.placeholder='A question, a change you need, or a busy week coming up';
   const label=support.closest('label');label.firstChild.textContent='Where can I help? ';
   const optional=document.createElement('small');optional.textContent='Optional';label.insertBefore(optional,support);
   main.querySelector('.checkin-next-week').append(label);
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
  const steps=form.querySelector('.refresh-connected');if(steps)details.append(steps);
  for(const name of ['training_adherence','nutrition_adherence','workload']){
   form.querySelector('[name="'+name+'"]')?.closest('fieldset')?.remove();
  }
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

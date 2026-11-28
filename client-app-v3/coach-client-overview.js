/* Coach summary: existing editors and evidence remain available without dominating the default screen. */
(function(){
 'use strict';
 const M=window.CheckinStatus;
 const own=(r,c,preview)=>r?.client_id===c.id||(preview&&!r?.client_id);
 const dateLabel=v=>v?fmt(v,{day:'numeric',month:'short'}):'Not recorded';
 const localStamp=(v,c)=>{if(!Number.isFinite(Date.parse(v)))return 'Time unavailable';try{return new Intl.DateTimeFormat('en-IE',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short',timeZone:c.timezone||'Europe/Dublin'}).format(new Date(v));}catch{return 'Timezone needs setup';}};
 const optional=s=>s.source_metadata?.optional===true||/\boptional\b/i.test(s.title||'');
 const workout=s=>!['mobility','recovery'].includes(s.training_type);
 const number=v=>M.recorded(v)?Number(v):null;
 function model(c,d,now=new Date(),preview=false){
  let today=null,weekStart=null;try{today=M.localDate(now,c.timezone||'Europe/Dublin');weekStart=M.week(c,now);}catch{}
  const week=(d.weeks||[]).find(w=>own(w,c,preview)&&w.published&&w.week_start===weekStart);
  const sessions=(d.sessions||[]).filter(s=>week&&s.week_id===week.id&&(!s.client_id||own(s,c,preview))&&workout(s)).sort((a,b)=>String(a.session_date).localeCompare(String(b.session_date))||Number(a.sort_order||0)-Number(b.sort_order||0));
  const required=sessions.filter(s=>!optional(s)),extra=sessions.filter(optional);
  const checkins=(d.checkins||[]).filter(r=>own(r,c,preview)).sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at)));
  const checks=window.LegalEdgePriorities?.currentCheckin?.(c,checkins,now)||{label:checkins.length?'Latest check-in':'No check-in recorded',saved:checkins[0]};
  const observations=[...(d.progress||[]).filter(r=>own(r,c,preview)&&number(r.weight_kg)!==null).map(r=>({v:Number(r.weight_kg),at:r.entry_date,source:'Progress entry'})),...checkins.filter(r=>number(r.weight_kg)!==null).map(r=>({v:Number(r.weight_kg),at:r.submitted_at,source:'Check-in'}))].filter(r=>Number.isFinite(Date.parse(r.at))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  const goals=String(c.goal_summary||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const planDay=(d.nutritionDays||[]).find(row=>week&&row.week_id===week.id&&row.nutrition_date===today);
  const plan=(d.nutritionPlans||[]).find(p=>p.id===planDay?.nutrition_plan_id&&(!p.client_id||own(p,c,preview)));
  const calls=(d.coachingCalls||[]).filter(r=>own(r,c,preview)&&r.status==='scheduled'&&Date.parse(r.scheduled_at)>=+now).sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at));
  const recap=(d.coachingGuidance||[]).filter(r=>own(r,c,preview)&&r.published&&/^Call recap · \d{4}-\d{2}-\d{2}$/.test(r.title||'')).sort((a,b)=>b.title.localeCompare(a.title))[0];
  const completed=required.filter(s=>s.status==='completed').length;
  const next=required.find(s=>s.status==='planned')||extra.find(s=>s.status==='planned');
  return {today,week,required,extra,completed,next,checks,latestCheck:checkins[0],weight:observations[0],goals,plan,call:calls[0],recap};
 }
 function go(tab){state.clientTab=tab;renderClientWorkspace();}
 const button=(tab,label)=>'<button class="btn ghost small" type="button" data-cov-route="'+tab+'">'+esc(label)+'</button>';
 const card=(label,value,detail,tab,action)=>'<section class="cov-card"><span class="eyebrow">'+esc(label)+'</span><h3>'+esc(value)+'</h3><p>'+esc(detail)+'</p>'+button(tab,action)+'</section>';
 function summary(c,d){
  const m=model(c,d,new Date(),state.preview);
  const weekValue=m.week?(m.required.length?m.completed+' / '+m.required.length:'No required workouts'):'No published week';
  const weekDetail=m.week?(m.required.length?'Required workouts marked complete'+(m.extra.length?' · '+m.extra.length+' optional':''):'Review the weekly plan'):'Open the weekly plan to check assignments';
  const weight=m.weight?displayWeight(m.weight.v):'Not recorded',delta=m.weight&&number(c.start_weight_kg)!==null?displayWeight(m.weight.v-Number(c.start_weight_kg),true):null;
  const weightDetail=m.weight?dateLabel(m.weight.at)+' · '+m.weight.source+(delta?' · '+delta+' from start':''):'No logged weigh-in yet';
  const checkDetail=m.checks.saved?M.submissionLabel(m.checks.saved):m.checks.due?'Due '+localStamp(m.checks.due,c):m.latestCheck?'Last saved: '+M.submissionLabel(m.latestCheck):'No saved check-in';
  const date=m.today?fmt(m.today,{weekday:'long',day:'numeric',month:'long'}):'Client-local date unavailable';
  return '<section id="coachClientOverview" class="cov-overview" aria-label="Client overview"><header class="cov-heading"><div><span class="eyebrow">CLIENT AT A GLANCE</span><h2>Overview</h2><p>'+esc(date)+'</p></div></header><div class="cov-grid">'+
   card('TRAINING THIS WEEK',weekValue,weekDetail,'planner','View weekly plan')+
   card('LATEST CHECK-IN',m.checks.label||'Not available',checkDetail,'check-ins','Review check-in')+
   card('LATEST WEIGHT',weight,weightDetail,'progress','Open progress')+
   card('TODAY’S NUTRITION',m.plan?.name||'No assigned menu',m.plan?'Assigned meals · use Nutrition to review tracking and portions':'Review the saved meal plan','nutrition','Open nutrition')+
   '</div><div class="cov-two"><section class="panel cov-goals"><div class="cov-row"><h2>Agreed goals</h2>'+button('goals','Edit goals')+'</div>'+
   (m.goals.length?'<ul>'+m.goals.slice(0,5).map(g=>'<li>'+esc(g)+'</li>').join('')+'</ul>':'<p>No agreed goal summary recorded.</p>')+(m.goals.length>5?'<p class="muted">'+(m.goals.length-5)+' more in Goals.</p>':'')+'</section>'+
   '<section class="panel cov-next"><div class="cov-row"><h2>Next up</h2>'+button('training','Open training')+'</div><div><span class="eyebrow">NEXT WORKOUT</span><h3>'+esc(m.next?.title||'No pending workout')+'</h3><p>'+esc(m.next?(m.next.source_metadata?.flexible===true?'Flexible session':dateLabel(m.next.session_date)):'Open weekly plan for details.')+'</p></div><div class="cov-call"><span class="eyebrow">NEXT CALL</span><h3>'+esc(m.call?localStamp(m.call.scheduled_at,c):'No upcoming call recorded')+'</h3>'+button('support','Calls & notes')+'</div>'+
   (m.recap?.body?'<details class="cov-recap"><summary>Latest call recap · '+esc(dateLabel(m.recap.title.slice(-10)))+'</summary>'+coachingTextMarkup(m.recap.body)+'</details>':'')+'</section></div></section>';
 }
 const openState=new Map();let arranging=false,observedHost=null,observer=null;
 function observe(host){if(observedHost===host)return;observer?.disconnect();observedHost=host;observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.matches('#coachClientOverview,#coachOverviewMore,[data-cft]'))))arrange();});observer.observe(host,{childList:true});}
 function arrange(){
  if(arranging||state.role!=='coach'||!state.client||state.clientTab!=='overview')return;
  const host=$('#clientWorkspaceBody');if(!host||host.querySelector('.error-state')||!host.children.length)return;observe(host);
  const key=[state.user?.id||'sample',state.client.id].join(':');arranging=true;
  try{
   let box=host.querySelector(':scope > #coachClientOverview'),tools=host.querySelector(':scope > #coachOverviewMore');
   if(!box){host.insertAdjacentHTML('afterbegin',summary(state.client,state.data));box=host.querySelector('#coachClientOverview');const id=state.client.id,user=state.user?.id;box.querySelectorAll('[data-cov-route]').forEach(b=>b.onclick=()=>{if(b.isConnected&&state.role==='coach'&&state.client?.id===id&&state.user?.id===user)go(b.dataset.covRoute);});}
   if(!tools){tools=document.createElement('details');tools.id='coachOverviewMore';tools.className='panel cov-more';tools.innerHTML='<summary><span>More coaching tools</span><small>Reports, activity, settings, call follow-through and private review tools</small></summary><div data-cov-details></div>';tools.open=openState.get(key)===true;tools.addEventListener('toggle',()=>openState.set(key,tools.open));host.append(tools);}
   const content=tools.querySelector('[data-cov-details]');
   // Move existing DOM nodes, including editors and listeners; do not recreate forms or write records.
   for(const node of [...host.children])if(node!==box&&node!==tools&&!node.matches('[data-cft]'))content.append(node);
   const food=host.querySelector(':scope > [data-cft]');if(food&&box.nextElementSibling!==food)box.after(food);
   if(host.lastElementChild!==tools)host.append(tools);
  }finally{observer?.takeRecords();arranging=false;}
 }
 const oldOverview=coachOverview;coachOverview=function(){const result=oldOverview();arrange();return result;};
 const oldWorkspace=renderClientWorkspace;renderClientWorkspace=function(){const result=oldWorkspace();arrange();return result;};
 window.CoachClientOverview={model,arrange};
})();

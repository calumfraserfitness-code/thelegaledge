/* A personal home built from published coaching and saved records. No inferred prescriptions. */
(function(){
 'use strict';
 const M=window.CheckinStatus;let observer=null,scheduleLoading=false;
 const owned=(rows,c)=>(rows||[]).filter(r=>r.client_id===c.id||state.preview&&!r.client_id);
 function startingPlan(client,data,date){
  if(!client.start_date||client.start_date<=date)return null;
  const week=owned(data.weeks,client).find(w=>w.published&&w.week_start<=client.start_date&&+new Date(client.start_date+'T12:00:00Z')- +new Date(w.week_start+'T12:00:00Z')<7*864e5);
  if(!week)return null;
  return week;
 }
 function model(client,data,now=new Date()){
  const date=M.localDate(now,client.timezone||'Europe/Dublin'),period=M.week(client,now);
  const week=owned(data.weeks,client).filter(w=>w.published&&w.week_start<=date&&date<=new Date(+new Date(w.week_start+'T12:00:00Z')+6*864e5).toISOString().slice(0,10)).sort((a,b)=>b.week_start.localeCompare(a.week_start))[0];
  const start=startingPlan(client,data,date),planWeek=start||week,mealDate=start?client.start_date:date;
  const day=(data.nutritionDays||[]).find(d=>planWeek&&d.week_id===planWeek.id&&d.nutrition_date===mealDate);
  const menu=day&&(data.nutritionPlans||[]).find(p=>p.id===day.nutrition_plan_id&&(!p.client_id||p.client_id===client.id));
  const sessions=(data.sessions||[]).filter(s=>planWeek&&s.week_id===planWeek.id&&(!s.client_id||s.client_id===client.id));
  const ordered=[...sessions].sort((a,b)=>String(a.session_date||'').localeCompare(String(b.session_date||''))||Number(a.sort_order||0)-Number(b.sort_order||0));
  const complete=s=>window.FlexibleCompletion?window.FlexibleCompletion.done(s,date):s.status==='completed';
  const daily=s=>['mobility','recovery'].includes(s.training_type);
  const pending=ordered.filter(s=>!['cancelled','skipped'].includes(s.status)&&!complete(s));
  const next=pending.find(s=>!daily(s)&&s.source_metadata?.optional!==true)||pending.find(s=>!daily(s))||pending[0];
  const saved=owned(data.checkins,client).some(r=>r.period_start===period);
  const due=client.weekly_checkin_enabled!==false?M.due(client,period):null;
  const action=start?{route:'training',title:'Your first week starts '+fmt(client.start_date,{weekday:'long',day:'numeric',month:'long'}),label:'View your training plan'}:
   !saved&&due&&+due<=+now?{route:'checkin',title:'Your weekly check-in is due',label:'Complete check-in'}:
   next?{route:'training',session:next.id,category:daily(next)?'mobility':next.training_type==='cardio'?'cardio':'weights',title:next.title||'Your next session',label:'Open session'}:
   week&&sessions.some(complete)?{route:'progress',title:'You’ve finished this week’s sessions',label:'View progress'}:
   {route:'support',title:week?'No sessions scheduled this week':'Your next plan is coming',label:'Open Coach'};
  const counted=sessions.filter(s=>['weights','resistance','cardio'].includes(s.training_type)&&
   !['cancelled','skipped'].includes(s.status)&&s.source_metadata?.optional!==true);
  const dueLabel=due&&!start&&!saved&&action.route!=='checkin'?new Intl.DateTimeFormat('en-GB',{
   weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:client.timezone||'Europe/Dublin'
  }).format(due):'';
  const goal=String(client.goal_summary||'').trim();
  const targets=owned(data.coachingGoals,client).filter(g=>g.status==='active');
  const upcoming=owned(data.coachingCalls,client).filter(c=>c.status==='scheduled'&&Date.parse(c.scheduled_at)>=+now)
   .sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at))[0];
  return {date,action,start,mealDate,menu,count:counted.length,completed:counted.filter(complete).length,dueLabel,goal,targets,upcoming};
 }
 function nextAgreedAction(client,data,rows,today){
  const cutoff=new Date(Date.parse(today+'T12:00:00Z')-13*864e5).toISOString().slice(0,10);
  const recent=value=>typeof value==='string'&&value.slice(0,10)>=cutoff&&Number.isFinite(Date.parse(value));
  const firstLine=value=>String(value||'').split(/\r?\n/).map(line=>line.trim().replace(/^(?:[-*•]+|\d+[.)])\s+/, '')).find(Boolean)||'';
  return [
   ...owned(rows,client).filter(r=>!r.completed_at&&r.approved_at&&r.starts_on<=today&&r.expires_on>=today)
    .map(r=>({at:r.approved_at,text:firstLine(r.description)})),
   ...owned(data.checkins,client).filter(r=>recent(r.reviewed_at)&&r.review_channel!=='whatsapp')
    .map(r=>({at:r.reviewed_at,text:firstLine(r.focus_next_week)}))
  ].filter(r=>r.text).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]?.text||'';
 }
 function paintAgreedAction(root,client,rows=[]){
  const slot=root.querySelector('[data-pch-agreed]');
  if(!slot)return;
  const text=nextAgreedAction(client,state.data,rows,root.dataset.localDate);
  if(slot.dataset.value===text)return;
  slot.dataset.value=text;slot.hidden=!text;
  slot.innerHTML=text?'<section class="pch-agreed"><h3>Your agreed next step</h3><p>'+esc(text)+'</p></section>':'';
 }
 async function refreshAgreedAction(root,client){
  const account=state.user?.id,followThrough=window.CoachingFollowThrough;
  if(state.preview||!followThrough)return;
  try{
   const rows=await followThrough.approvedActions(client.id,root.dataset.localDate);
   if(root.isConnected&&state.client===client&&state.user?.id===account&&eligible())paintAgreedAction(root,client,rows);
  }catch{ /* Keep any previously shown published action available. */ }
 }
 function coachingMarkup(home,client){
  const {goal,targets,upcoming}=home,zone=client.timezone||'Europe/Dublin';
  const locale=String(client.market_region||'').toLowerCase()==='us'?'en-US':'en-GB';
  const targetRows=targets.map(g=>{
   const pounds=g.metric==='weight_kg'&&client.weight_unit==='lbs';
   const factor=pounds?2.2046226218:1,unit=pounds?'lb':String(g.unit||'').trim();
   const value=g.target==null||g.target===''?null:Number(g.target)*factor;
   const format=n=>n.toLocaleString(locale,{maximumFractionDigits:1});
   const target=value!==null&&Number.isFinite(value)?'<strong class="pch-target-number">'+esc(format(value))+
    (unit?' <small>'+esc(unit)+'</small>':'')+'</strong>':'';
   const current=typeof coachingGoalValue==='function'?coachingGoalValue(g):null;
   const hasCurrent=typeof current==='number'&&Number.isFinite(current);
   const recorded=target?'<small class="pch-recorded">'+(hasCurrent?'Latest '+esc(format(current*factor)+(unit?' '+unit:'')):'Waiting for a saved measurement')+'</small>':'';
   const percent=typeof coachingGoalPercent==='function'?coachingGoalPercent(g,current):null;
   const progress=percent==null?'':'<progress value="'+percent+'" max="100" aria-label="'+esc(g.title)+' progress"></progress>';
   const remaining=hasCurrent&&target&&g.metric==='weight_kg'&&Number(g.baseline)>Number(g.target)&&current>Number(g.target)
    ?'<small class="pch-recorded">'+esc(format((current-Number(g.target))*factor)+' '+unit)+' to first milestone</small>':'';
   const by=/^\d{4}-\d{2}-\d{2}$/.test(g.target_date||'')?'<small class="pch-target-date">By '+esc(fmt(g.target_date,{day:'numeric',month:'short',year:'numeric'}))+'</small>':'';
   return '<li><span>'+esc(g.title)+'</span>'+target+recorded+remaining+progress+by+'</li>';
  });
  const goalContent=(goal?'<div class="pch-goal-text">'+coachingTextMarkup(goal)+'</div>':'')+
   (targetRows.length?'<ul class="pch-targets" aria-label="Agreed targets">'+targetRows.join('')+'</ul>':'');
  let call='<p class="pch-call-empty">No call scheduled</p>';
  if(upcoming){
   const stamp=new Date(upcoming.scheduled_at);
   const date=new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'short',timeZone:zone}).format(stamp);
   const clock=new Intl.DateTimeFormat(locale,{hour:'numeric',minute:'2-digit',timeZone:zone,timeZoneName:'short'}).format(stamp);
   const join=typeof coachingJoinUrl==='function'?coachingJoinUrl(upcoming.join_url):'';
   const duration=Number(upcoming.duration_minutes);
   call='<time datetime="'+esc(upcoming.scheduled_at)+'"><strong>'+esc(date)+'</strong><span>'+esc(clock)+
    (Number.isFinite(duration)&&duration>0?' · '+esc(duration)+' min':'')+'</span></time>'+
    (join?'<a class="btn primary small" target="_blank" rel="noopener noreferrer" href="'+esc(join)+'">Join call</a>':
     '<p class="pch-call-empty">Join link pending</p>');
  }
  return '<section class="panel pch-coaching" aria-label="Your goals and coaching calls"><div class="pch-coaching-grid">'+
   '<div class="pch-goals-summary">'+(goalContent?'<h2>Agreed goals</h2>'+goalContent:'')+'<div data-pch-agreed hidden></div></div>'+
   '<div class="pch-call-summary"><h2>Next coaching call</h2>'+call+
   '<button type="button" class="text-btn" data-pch-calls>Call details & notes</button></div></div></section>';
 }
 function eligible(){return !!state.client&&['client','coach'].includes(state.role)&&state.clientView==='today'&&
  state.client.onboarding_status==='complete'&&(state.preview||state.client.plan_status==='published');}
 function arrange(){
  if(!eligible())return;
  const host=$('#clientMain'),root=host?.querySelector('#personalCoachingHome');if(!root)return;
  for(const node of [...host.children]){
   if(node!==root&&node.id!=='coachingConnectionStatus')node.remove();
  }
 }
 function mount(){
  if(!eligible())return false;
  const host=$('#clientMain');if(!host)return false;
  let home;try{home=model(state.client,state.data);}catch{return false;}
  observer?.disconnect();
  const client=state.client,user=state.user?.id,role=state.role,action=home.action;
  const root=document.createElement('div');root.id='personalCoachingHome';root.className='pch-home';root.dataset.localDate=home.date;root.dataset.pchSimple='true';
  const name=String(client.display_name||'').trim().split(/\s+/)[0];
  const recipes=home.menu&&typeof mealsForNutritionPlan==='function'?mealsForNutritionPlan(home.menu):[];
  const meals=(window.DailyNutrition?.slots(recipes)||recipes.map(meal=>({meal})))
   .filter(({meal})=>String(meal?.name||'').trim()).slice(0,3);
  const dateLabel=fmt(home.date,{weekday:'long',day:'numeric',month:'long'});
  root.innerHTML='<header class="pch-heading"><p>'+esc(dateLabel)+'</p><h1>'+esc(name?'Hi, '+name:'Today')+'</h1></header>'+
   '<div data-pch-video hidden></div>'+coachingMarkup(home,client)+'<div class="pch-plan">'+
   '<section class="panel pch-next"><p class="eyebrow">'+(home.start?'YOUR FIRST WEEK':action.route==='training'?'NEXT SESSION':action.route==='checkin'?'WEEKLY CHECK-IN':'THIS WEEK')+'</p><h2>'+esc(action.title)+'</h2>'+
   (home.count?'<p class="pch-completion"><strong>'+home.completed+' of '+home.count+'</strong> planned sessions complete</p><progress value="'+home.completed+'" max="'+home.count+'" aria-label="Planned sessions complete"></progress>':'')+
   (window.FlexibleCompletion?.recentSessionsMarkup?.(client,state.data,1)||'')+
   '<button type="button" class="btn primary" data-pch-next>'+esc(action.label)+'</button>'+
   '<button type="button" class="btn ghost pch-week-link" data-pch-planner>Weekly planner</button>'+
   (home.dueLabel?'<p class="pch-due">Check-in due '+esc(home.dueLabel)+'</p>':'')+'</section>'+
   (meals.length?'<section class="panel pch-meals"><h2>'+(home.start?'First day’s meals':'Today’s meals')+'</h2><ul>'+meals.map(({meal,key})=>'<li><button type="button" class="pch-meal-link" data-pch-meals="'+esc(key||'')+'">'+esc(meal.name)+' <span aria-hidden="true">›</span></button></li>').join('')+
    '</ul><button type="button" class="btn ghost" data-pch-meals>View meals & portions</button></section>':'')+'</div>'+'<div data-pch-weigh-in hidden></div>';
  host.replaceChildren(root);
  const active=()=>root.isConnected&&eligible()&&state.client===client&&state.user?.id===user&&state.role===role;
  root.querySelector('[data-pch-next]').onclick=()=>{
   if(!active())return;
   state.clientView=action.route;
   if(action.route==='checkin')state.checkinWeek=null;
   if(action.route==='training'){state.selectedSessionId=action.session||null;state.trainingCategory=action.category||'weights';}
   renderClient();
  };
  root.querySelector('[data-pch-calls]').onclick=async()=>{
   if(!active())return;
   state.clientView='support';
   await renderClient();
   if(state.client===client&&state.user?.id===user&&state.clientView==='support'){
    const calls=$('#coachingCalls');
    if(calls){calls.tabIndex=-1;calls.focus();}
   }
  };
  root.querySelector('[data-pch-planner]').onclick=()=>{
   if(!active())return;
   state.clientView='planner';renderClient();
  };
  root.querySelectorAll('[data-pch-meals]').forEach(button=>button.onclick=()=>{
   if(!active())return;
   state.clientView='nutrition';
   if(typeof window.openDailyNutritionDate==='function')window.openDailyNutritionDate(home.mealDate,button.dataset.pchMeals);else renderClient();
  });
  paintAgreedAction(root,client);
  refreshAgreedAction(root,client);
  window.PracticeFeedback?.feedback();
  window.PracticeFeedback?.refresh();
  observer=new MutationObserver(arrange);
  observer.observe(host,{childList:true});
  return true;
 }
 const today=clientToday;
 clientToday=function(){if(!mount())return today();};
 async function refreshWeek(){
  if(scheduleLoading||document.hidden||!state.client)return;
  const today=M.localDate(new Date(),state.client.timezone||'Europe/Dublin');
  const host=$('#clientMain');
  if(state.clientView==='planner'&&host?.dataset.completionDate&&host.dataset.completionDate!==today&&!host.contains(document.activeElement?.closest('input, textarea, select'))){
   renderClient();return;
  }
  if(!eligible())return;
  const root=host?.querySelector('#personalCoachingHome');if(!root)return;
  const editingWeighIn=()=>{
   const form=root.querySelector('#todayProgressForm');
   return !!form&&(form.dataset.saving==='true'||Array.from(form.querySelectorAll('input')).some(input=>input.value));
  };
  if(root.dataset.localDate!==today){if(!editingWeighIn())renderClient();return;}
  if(state.role!=='client'||state.preview)return;
  const client=state.client,user=state.user?.id,data=state.data,loadSequence=clientDataLoadSequence;
  const active=()=>root.isConnected&&eligible()&&state.role==='client'&&state.client===client&&state.user?.id===user;
  scheduleLoading=true;
  refreshAgreedAction(root,client);
  try{
   const anchor=client.start_date>today?client.start_date:today;
   const earliest=new Date(Date.parse(anchor+'T12:00:00Z')-6*864e5).toISOString().slice(0,10);
   const weeks=await query('This week',db.from('program_weeks').select('*').eq('client_id',client.id).eq('published',true).gte('week_start',earliest).lte('week_start',anchor).order('week_start',{ascending:false}));
   const ids=weeks.map(w=>w.id);
   const sessions=ids.length?await query('This week’s sessions',db.from('training_sessions').select('*').in('week_id',ids)):[];
   const calls=await query('Upcoming coaching calls',db.from('client_coaching_calls').select('*').eq('client_id',client.id)
    .eq('status','scheduled').gte('scheduled_at',new Date().toISOString()).order('scheduled_at',{ascending:true}).limit(30)).catch(()=>null);
   if(!active()||data!==state.data||loadSequence!==clientDataLoadSequence)return;
   const current=data.weeks.filter(w=>w.published&&w.week_start>=earliest&&w.week_start<=anchor);
   const currentIds=new Set(current.map(w=>w.id));
   const snapshot=rows=>JSON.stringify([...rows].sort((a,b)=>a.id.localeCompare(b.id)));
   const plannedCalls=(data.coachingCalls||[]).filter(c=>c.status==='scheduled'&&Date.parse(c.scheduled_at)>=Date.now())
    .sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at)).slice(0,30);
   const changed=snapshot(weeks)!==snapshot(current)||snapshot(sessions)!==snapshot(data.sessions.filter(s=>currentIds.has(s.week_id)))||
    (calls&&snapshot(calls)!==snapshot(plannedCalls));
   if(changed){
    if(!(await loadClientData(client.id)))return;
    root.dataset.refreshWeek='true';
   }
   const inputFocused=root.contains(document.activeElement)&&document.activeElement.matches('input, textarea, select');
   if(active()&&!inputFocused&&!editingWeighIn()&&(root.dataset.refreshWeek||root.dataset.localDate!==today))renderClient();
  }catch(error){console.warn('Could not refresh the weekly schedule.',error);}
  finally{scheduleLoading=false;}
 }
 document.addEventListener('visibilitychange',refreshWeek);
 window.setInterval(refreshWeek,60000);
 window.PersonalCoachingHome={model,mount,arrange,startingPlan,nextAgreedAction};
})();

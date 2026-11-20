/* A personal home built from published coaching and saved records. No inferred prescriptions. */
(function(){
 'use strict';
 const M=window.CheckinStatus,cache=new Map();let observer=null,scheduled=false,scheduleLoading=false;
 const owned=(rows,c)=>(rows||[]).filter(r=>r.client_id===c.id||state.preview&&!r.client_id);
 function startingPlan(client,data,date){
  if(!client.start_date||client.start_date<=date)return null;
  const week=owned(data.weeks,client).find(w=>w.published&&w.week_start<=client.start_date&&+new Date(client.start_date+'T12:00:00Z')- +new Date(w.week_start+'T12:00:00Z')<7*864e5);
  if(!week)return null;
  const sessions=(data.sessions||[]).filter(s=>s.week_id===week.id&&(!s.client_id||s.client_id===client.id)).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.session_date).localeCompare(String(b.session_date)));
  const menuDays=(data.nutritionDays||[]).filter(d=>d.week_id===week.id);
  return {week,sessions,hasMeals:menuDays.some(d=>d.nutrition_plan_id)};
 }
 function weekSchedule(week,sessions,client,calls,now=new Date()){
  const zone=client.timezone||'Europe/Dublin',today=M.localDate(now,zone);
  const start=week?.week_start||M.week(client,now);
  const label=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
  const dayLabel=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',timeZone:'UTC'});
  const time=new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  const dateTime=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  const dates=Array.from({length:7},(_,i)=>new Date(Date.parse(start+'T12:00:00Z')+864e5*i));
  const end=dates[6].toISOString().slice(0,10),weekLabel=M.weekLabel(start,client,now);
  const due=client.weekly_checkin_enabled!==false?M.due(client,start):null,dueDate=due&&M.localDate(due,zone);
  const scheduled=owned(calls,client).filter(call=>call.status==='scheduled'&&Number.isFinite(Date.parse(call.scheduled_at))&&+new Date(call.scheduled_at)+(Number(call.duration_minutes)||30)*60000>+now)
   .map(call=>({...call,instant:new Date(call.scheduled_at),day:M.localDate(new Date(call.scheduled_at),zone)}))
   .sort((a,b)=>a.instant-b.instant);
  const outside=scheduled.find(call=>call.day<start||call.day>end);
  const weighIns=client.track_weight!==false&&Number(client.weekly_weigh_in_minimum)===2&&sessions.some(s=>s.source_metadata?.gym_days);
  const rows=dates.map(date=>{
   const key=date.toISOString().slice(0,10);
   const assigned=sessions.filter(s=>s.session_date===key).map(s=>'<button class="week-activity" type="button" data-week-session="'+esc(s.id)+'"><span>'+esc(s.title.split(' · ')[0])+'</span><small>'+esc(s.title.split(' · ').slice(1).join(' · '))+(s.status==='completed'?' ✓':'')+'</small></button>').join('');
   const appointments=scheduled.filter(call=>call.day===key).map(call=>'<button class="week-activity week-call" type="button" data-week-call="'+esc(call.id)+'" aria-label="'+esc(call.title)+'"><strong>Coaching call</strong><small>'+esc(time.format(call.instant))+'</small></button>').join('');
   const checkin=key!==dueDate?'':start<=today?'<button class="week-activity week-checkin" type="button" data-week-checkin>Check-in form <small>'+esc(time.format(due))+'</small></button>':'<span class="week-activity week-checkin">Check-in form <small>'+esc(time.format(due))+'</small></span>';
   return '<li '+(key===today?'aria-current="date"':'')+'><strong>'+esc(dayLabel.format(date))+'</strong>'+assigned+appointments+checkin+(weighIns&&[0,2,5].includes(date.getUTCDay())?'<small class="week-weigh-in">Weigh-in</small>':'')+'</li>';
  }).join('');
  const nextCall=outside?'<p class="pch-next-call"><button class="text-btn" type="button" data-week-call="'+esc(outside.id)+'">Coaching call</button> <span>'+esc(dateTime.format(outside.instant))+' · '+esc(M.weekLabel(M.week(client,outside.instant),client,now).toLowerCase())+'</span></p>':'';
  return '<section class="panel pch-week-strip"><h2>'+weekLabel+' <small>'+esc(label.format(dates[0])+' – '+label.format(dates[6]))+'</small></h2>'+nextCall+'<ol>'+rows+'</ol>'+(week?'<button class="text-btn pch-planner-link" type="button" data-week-planner>Weekly planner</button>':'')+'</section>';
 }
 function bindWeekSchedule(root){
  const id=state.client.id,user=state.user?.id;
  const active=()=>root.isConnected&&eligible()&&state.client?.id===id&&state.user?.id===user;
  root.querySelectorAll('[data-week-session]').forEach(button=>button.onclick=()=>{
   if(!active())return;
   const session=state.data.sessions.find(s=>s.id===button.dataset.weekSession);if(!session)return;
   state.selectedSessionId=session.id;
   state.trainingCategory=['mobility','recovery'].includes(session.training_type)?'mobility':session.training_type==='cardio'?'cardio':'weights';
   route('training');
  });
  root.querySelector('[data-week-checkin]')?.addEventListener('click',()=>{if(active()){state.checkinWeek=null;route('checkin');}});
  root.querySelector('[data-week-planner]')?.addEventListener('click',()=>{if(active())route('planner');});
  root.querySelectorAll('[data-week-call]').forEach(button=>button.onclick=()=>{
   if(!active())return;
   route('support');
   const calls=document.getElementById('coachingCalls');
   const selected=[...(calls?.querySelectorAll('[data-coaching-call]')||[])].find(row=>row.dataset.coachingCall===button.dataset.weekCall);
   (selected||calls)?.scrollIntoView?.({block:'start'});
  });
 }
 function goalMarkup(goal){
  return goal?'<section class="panel pch-goal"><h2>Your goals</h2><p class="pch-focus-text">'+esc(goal)+'</p></section>':'';
 }
 function prioritiesMarkup(week,sessions,client,{starting=false,hasMeals=false,checkin=null}={}){
  const lifts=sessions.filter(s=>['weights','resistance'].includes(s.training_type));
  const rides=sessions.filter(s=>s.training_type==='cardio'&&/\bPeloton\b/i.test(s.title));
  const cardio=sessions.filter(s=>s.training_type==='cardio').length-rides.length;
  const liftType=lifts.every(s=>/\bfull[ -]body\b/i.test(s.title))?' full-body ':' ';
  const training=[lifts.length&&lifts.length+liftType+(lifts.length===1?'lift':'lifts'),
   rides.length&&rides.length+' Peloton '+(rides.length===1?'ride':'rides'),
   cardio&&cardio+' cardio '+(cardio===1?'session':'sessions')].filter(Boolean).join(' · ');
  const due=client.weekly_checkin_enabled!==false?M.due(client,week.week_start):null;
  const dateFormat=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:client.timezone||'Europe/Dublin'});
  const timeFormat=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZoneName:'short',timeZone:client.timezone||'Europe/Dublin'});
  const dueLabel=due?dateFormat.format(due)+' · '+timeFormat.format(due):'';
  const steps=Number(client.daily_steps_goal);
  const weigh=client.track_weight!==false&&Number(client.weekly_weigh_in_minimum)===2;
  return '<section class="panel pch-priorities" aria-labelledby="pchPrioritiesTitle"><div class="pch-priorities-heading"><h2 id="pchPrioritiesTitle">'+(starting?'Week one priorities':'This week’s priorities')+'</h2></div><ul>'+
   (training?'<li><span>Training</span><strong>'+esc(training)+'</strong></li>':'')+
   (steps>0?'<li><span>Daily steps</span><strong>'+esc(steps.toLocaleString())+'</strong></li>':'')+
   (weigh?'<li><span>Weigh-ins</span><strong>Tue, Fri, Sun <small>At least twice</small></strong></li>':'')+
   (checkin||dueLabel?'<li><span>Check-in</span><strong>'+esc(checkin?(checkin.reviewed_at?'Reviewed':'Submitted'):dueLabel)+'</strong></li>':'')+
   '</ul><div class="pch-priority-actions"><button type="button" class="btn primary small" data-pch-priority-training>Open training</button>'+
   (hasMeals?'<button type="button" class="btn ghost small" data-pch-start-meals>Meal plan</button>':'')+
   (!starting&&(checkin||dueLabel)?'<button type="button" class="btn ghost small" data-pch-checkin>'+(checkin?'View check-in':'Open check-in')+'</button>':'')+
   '</div>'+(week.coach_note?'<details class="pch-week-notes"><summary>Week notes</summary><p>'+esc(week.coach_note)+'</p></details>':'')+'</section>';
 }
 function bindPriorities(root,active,startDate){
  root.querySelector('[data-pch-priority-training]')?.addEventListener('click',()=>{
   if(!active())return;
   state.selectedSessionId=null;
   state.trainingCategory='weights';
   route('training');
  });
  root.querySelector('[data-pch-start-meals]')?.addEventListener('click',()=>{
   if(!active())return;
   if(startDate&&typeof window.openDailyNutritionDate==='function'){
    state.clientView='nutrition';window.openDailyNutritionDate(startDate);
   }else route('nutrition');
  });
  root.querySelector('[data-pch-checkin]')?.addEventListener('click',()=>{if(active()){state.checkinWeek=null;route('checkin');}});
 }
 function startingMarkup(plan,client,data){
  const date=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(client.start_date+'T12:00:00Z'));
  const gymPlan=plan.sessions.some(s=>s.source_metadata?.gym_days);
  const workouts=(gymPlan?[]:plan.sessions).map(session=>{
   const exercises=(data.exercises||[]).filter(e=>e.session_id===session.id).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
   const details=exercises.length?'<ul>'+exercises.map(e=>'<li>'+esc(e.name)+(e.sets&&e.reps?' · '+esc(e.sets)+' × '+esc(e.reps):'')+'</li>').join('')+'</ul>':session.notes?'<p>'+esc(session.notes)+'</p>':'';
   return '<details class="panel"><summary><strong>'+esc(session.title)+'</strong>'+(session.duration_minutes?' · '+esc(session.duration_minutes)+' min':'')+'</summary>'+details+'</details>';
  }).join('');
  const due=client.weekly_checkin_enabled!==false?M.due(client,plan.week.week_start):null;
  const priorities=gymPlan?prioritiesMarkup(plan.week,plan.sessions,client,{starting:true,hasMeals:plan.hasMeals}):
   '<section class="panel pch-goal"><h2>Week one priorities</h2>'+(plan.week.coach_note?'<p class="pch-focus-text">'+esc(plan.week.coach_note)+'</p>':'')+
   '<div class="head-actions">'+(plan.hasMeals?'<button type="button" class="btn primary" data-pch-start-meals>View meal plan</button>':'')+
   '<button type="button" class="btn ghost" data-pch-start-coach>Open Coach</button></div>'+(due?'<p>First check-in due '+esc(M.stamp(due,client.timezone||'Europe/Dublin'))+'.</p>':'')+'</section>';
  return '<header class="pch-heading pch-start-hero"><h1>Your first week</h1><p>Starts '+esc(date)+'</p></header>'+priorities+weekSchedule(plan.week,plan.sessions,client,data.coachingCalls)+goalMarkup(client.goal_summary)+(workouts?'<section class="panel pch-focus"><h2>Your sessions</h2>'+workouts+'</section>':'');
 }
 function model(client,data,now=new Date()){
  const date=M.localDate(now,client.timezone||'Europe/Dublin'),period=M.week(client,now);
  const week=owned(data.weeks,client).filter(w=>w.published&&w.week_start<=date&&date<=new Date(+new Date(w.week_start+'T12:00:00Z')+6*864e5).toISOString().slice(0,10)).sort((a,b)=>b.week_start.localeCompare(a.week_start))[0];
  const sessions=(data.sessions||[]).filter(s=>week&&s.week_id===week.id&&(!s.client_id||s.client_id===client.id));
  const ordered=[...sessions].sort((a,b)=>String(a.session_date||'').localeCompare(String(b.session_date||''))||Number(a.sort_order||0)-Number(b.sort_order||0));
  const complete=s=>window.FlexibleCompletion?window.FlexibleCompletion.done(s,date):s.status==='completed';
  const daily=s=>['mobility','recovery'].includes(s.training_type);
  const next=ordered.find(s=>!daily(s)&&!complete(s))||ordered.find(s=>daily(s)&&!complete(s));
  const saved=owned(data.checkins,client).filter(r=>r.period_start===period).sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at)))[0];
  const due=client.weekly_checkin_enabled!==false?M.due(client,period):null;
  const goals=owned(data.coachingGoals,client).filter(g=>g.status==='active');
  const goal=String(client.goal_summary||goals[0]?.title||'').trim();
  const checkinDue=!saved&&due&&+due<=+now;
  const action=checkinDue?{route:'checkin',label:'Complete your check-in',title:'How did your week go?',detail:'Let me know what you got done and where you need a hand.'}:next?{route:'training',session:next.id,category:daily(next)?'mobility':next.training_type==='cardio'?'cardio':'weights',label:'Open session',title:next.title||'Your next session',detail:daily(next)?'Tick each practice when you finish. Earlier days stay saved.':'Complete when ready. Your session order is a guide, not a fixed day.'}:week&&sessions.length?{route:'progress',label:'View your progress',title:'Your recorded progress, in one place.',detail:'Your assigned sessions are complete. Review your progress or open Training for practice and extra activity.'}:{route:'support',label:'Open Coach',title:'Your coaching hub is here.',detail:week?'Your current week has no assigned sessions yet. Open Coach for your saved guidance.':'The current week has not been published yet. Your saved feedback and previous work remain available.'};
  return {date,week,goal,action,next,savedDue:due,focus:String(week?.coach_note||'').trim(),saved,goals};
 }
 function checkinMarkup(m,c){
  const label=c.weekly_checkin_enabled===false?'Not scheduled':m.saved?m.saved.reviewed_at?'Reviewed':'Submitted':m.savedDue&&+m.savedDue<=Date.now()?'Ready to send':'Your weekly check-in';
  const detail=m.saved?'Saved '+M.stamp(m.saved.submitted_at,c.timezone||'Europe/Dublin'):m.savedDue?'Due '+M.stamp(m.savedDue,c.timezone||'Europe/Dublin'):c.weekly_checkin_enabled===false?'Use Coach for your agreed support.':'Calum needs to confirm your check-in deadline.';
  return '<section class="panel pch-checkin"><span class="eyebrow">YOUR CHECK-IN</span><h2>'+esc(label)+'</h2><p>'+esc(detail)+'</p><button type="button" class="btn ghost" data-pch-checkin>'+(m.saved?'View saved check-in':'Open check-in')+'</button><small>Quick scores and a message. Add more detail when it helps.</small></section>';
 }
 function milestoneMarkup(m,c){
  const g=m.goals.find(g=>g.target!==null&&g.target!==''&&g.target!==undefined&&Number.isFinite(Number(g.target)));
  let text='<p>Your next measurable target will appear when it is agreed with Calum.</p>';
  if(g){
   let value=null;try{if(typeof coachingGoalValue==='function')value=coachingGoalValue(g);}catch{}
   const factor=g.metric==='weight_kg'&&c.weight_unit==='lbs'?2.2046226218:1,unit=factor!==1?'lb':g.unit||'',display=v=>Number((Number(v)*factor).toFixed(1));
   const known=value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
   text='<h3>'+esc(g.title)+'</h3><p><strong>'+(known?esc(display(value)):'Awaiting a recorded measurement')+'</strong> · target '+esc(display(g.target))+' '+esc(unit)+'</p>';
   if(known&&g.baseline!==null&&g.baseline!==undefined&&g.baseline!==''&&Number.isFinite(Number(g.baseline))&&typeof coachingGoalPercent==='function'){
    const pct=coachingGoalPercent(g,value);text+='<progress max="100" value="'+pct+'" aria-label="'+esc(g.title)+' progress"></progress>';
   }
   text+='<small>'+(g.target_date?'Target date '+esc(g.target_date):'Target date to agree')+' · based on your saved progress</small>';
  }
  return '<section class="panel pch-milestone"><span class="eyebrow">YOUR NEXT MILESTONE</span>'+text+(m.week?'<p class="muted">Current published programme'+(m.week.week_number?' · week '+esc(m.week.week_number):'')+'</p>':'')+'<button type="button" class="text-btn" data-pch-progress>View goals & recorded progress</button></section>';
 }
 function eligible(){return !!state.client&&['client','coach'].includes(state.role)&&state.clientView==='today'&&state.client.onboarding_status==='complete';}
 function route(view){state.clientView=view;renderClient();}
 function arrange(){
  scheduled=false;if(!eligible())return;const host=$('#clientMain'),root=host?.querySelector('#personalCoachingHome');if(!root)return;
  const video=host.querySelector('#cvLatest'),slot=root.querySelector('[data-pch-video]');
  if(video&&video.parentElement!==slot)slot.append(video);slot.hidden=!video;
  // Preserve loaded cards, handlers and async save/retry states when reducing the page.
  const secondary=root.querySelector('[data-pch-secondary-content]');
  Array.from(host.children).filter(node=>node!==root&&node.id!=='coachingConnectionStatus').forEach(node=>{if(node.id==='cvLatest'){if(node.parentElement!==slot)slot.append(node);}else if(!node.matches('.page-head,.client-page-head,.client-heading,.client-header'))secondary.append(node);else node.remove();});
  if(root.dataset.startingPlan)root.querySelectorAll(':scope > #homeQuickLog, :scope > #clientWeeklyRecap, :scope > [data-weighin-routine]').forEach(node=>secondary.append(node));
 }
 function watch(){observer?.disconnect();observer=null;if(!eligible())return;const host=$('#clientMain');if(!host)return;
  observer=new MutationObserver(rows=>{if(rows.some(r=>r.addedNodes.length||r.removedNodes.length)&&!scheduled){scheduled=true;queueMicrotask(arrange);}});observer.observe(host,{childList:true,subtree:true});
 }
 function paintFocus(root,m,rows,status='ready'){
  const box=root.querySelector('[data-pch-focus]');if(!box)return;
  const current=(rows||[]).filter(r=>r.client_id===state.client.id&&r.approved_at&&!r.archived_at&&r.starts_on<=m.date&&r.expires_on>=m.date),open=current.filter(r=>!r.completed_at);
  const text=m.focus||open[0]?.description;
  if(box.hasAttribute('data-pch-focus-compact'))box.hidden=!text;
  box.innerHTML='<span class="eyebrow">THIS WEEK’S FOCUS</span>'+(text?'<p class="pch-focus-text">'+esc(text)+'</p>':current.length?'<p>Your current agreed actions are marked complete. Keep following your published programme.</p>':status==='loading'?'<p role="status">Reading your agreed focus…</p>':status==='unavailable'?'<p role="status">Your agreed actions could not load. Open Coach to retry.</p>':'<p>'+(m.week?'Follow your published programme. Your current coaching feedback and agreed actions are in Coach.':'Your current focus will appear here when it is published. Your saved feedback remains in Coach.')+'</p>')+'<button type="button" class="text-btn" data-pch-coach>View coaching & agreed actions</button>';
  const user=state.user?.id,id=state.client.id;box.querySelector('button').onclick=()=>{if(box.isConnected&&eligible()&&state.user?.id===user&&state.client?.id===id)route('support');};
 }
 async function focus(root,m){
  if(state.preview){paintFocus(root,m,[]);return;}
  const client=state.client.id,user=state.user?.id,role=state.role,key=[user,client,m.date].join('|'),active=()=>root.isConnected&&eligible()&&state.user?.id===user&&state.client?.id===client&&state.role===role;
  const saved=cache.get(key);if(saved&&Date.now()-saved.at<30000){paintFocus(root,m,saved.rows);return;}
  paintFocus(root,m,[],'loading');
  try{const rows=await query('Personal home approved focus',db.from('client_weekly_focus').select('id,client_id,description,starts_on,expires_on,completed_at,approved_at,archived_at').eq('client_id',client).is('archived_at',null).not('approved_at','is',null).lte('starts_on',m.date).gte('expires_on',m.date).order('approved_at',{ascending:false}).limit(100));
   if(!active())return;if(rows.some(r=>r.client_id!==client)||rows.length>=100)throw Error('Complete focus could not be confirmed.');cache.set(key,{rows,at:Date.now()});if(cache.size>20)cache.delete(cache.keys().next().value);paintFocus(root,m,rows);
  }catch{if(active())paintFocus(root,m,[],'unavailable');}
 }
 function mount(){
  observer?.disconnect();observer=null;if(!eligible())return;const host=$('#clientMain');if(!host||!host.querySelector('.priority-grid'))return;if(host.querySelector('#personalCoachingHome')){arrange();watch();return;}
  let m;try{m=model(state.client,state.data);}catch{return;}
  const client=state.client.id,user=state.user?.id,root=document.createElement('div');root.id='personalCoachingHome';root.className='pch-home';root.dataset.localDate=m.date;
  const start=startingPlan(state.client,state.data,m.date);
  if(start){
   root.dataset.startingPlan='true';
   root.innerHTML=startingMarkup(start,state.client,state.data)+'<div data-pch-video hidden></div><details class="pch-secondary" data-pch-secondary><summary><span>More coaching tools</span></summary><div data-pch-secondary-content></div></details>';
   host.prepend(root);
   const active=()=>root.isConnected&&eligible()&&state.user?.id===user&&state.client?.id===client;
   bindPriorities(root,active,state.client.start_date);
   root.querySelector('[data-pch-start-coach]')?.addEventListener('click',()=>{if(active())route('support');});
   bindWeekSchedule(root);
   arrange();watch();return;
  }
  const name=String(state.client.display_name||'').trim().split(/\s+/)[0];
  const weekSessions=(state.data.sessions||[]).filter(s=>s.week_id===m.week?.id&&(!s.client_id||s.client_id===client));
  const schedule=weekSchedule(m.week,weekSessions,state.client,state.data.coachingCalls);
  const compact=!!m.week&&weekSessions.some(s=>s.source_metadata?.gym_days);
  const priorities=compact?prioritiesMarkup(m.week,weekSessions,state.client,{checkin:m.saved,hasMeals:(state.data.nutritionDays||[]).some(d=>d.week_id===m.week.id&&d.nutrition_plan_id)}):'';
  const focusPanel='<section class="panel pch-focus" data-pch-focus'+(compact?' data-pch-focus-compact hidden':'')+'></section>';
  const actions=compact?'':'<section class="panel pch-next"><span class="eyebrow">YOUR NEXT STEP</span><h2>'+esc(m.action.title)+'</h2><p>'+esc(m.action.detail)+'</p><button type="button" class="btn primary" data-pch-next>'+esc(m.action.label)+'</button></section>'+checkinMarkup(m,state.client);
  root.innerHTML='<header class="pch-heading pch-start-hero"><span class="eyebrow">YOUR PERSONAL COACHING</span><h1>'+esc(name?name+', here’s your focus.':'Your coaching, made clear.')+'</h1></header>'+
   priorities+schedule+goalMarkup(m.goal)+'<div data-pch-video hidden></div>'+focusPanel+actions+
   (compact&&!m.goals.length?'':milestoneMarkup(m,state.client))+'<details class="pch-secondary" data-pch-secondary><summary><span>Your plan & progress</span><small>Meals, check-in, training and saved activity</small></summary><div data-pch-secondary-content></div></details>';
  host.prepend(root);const active=()=>root.isConnected&&eligible()&&state.user?.id===user&&state.client?.id===client;
  bindPriorities(root,active);
  root.querySelector('[data-pch-next]')?.addEventListener('click',()=>{if(!active())return;if(m.action.session){state.selectedSessionId=m.action.session;state.trainingCategory=m.action.category;}route(m.action.route);});
  root.querySelector('[data-pch-progress]')?.addEventListener('click',()=>{if(active())route('progress');});
  bindWeekSchedule(root);arrange();watch();focus(root,compact?{...m,focus:''}:m);
 }
 const today=clientToday;clientToday=function(){const result=today();mount();return result;};
 // Later render wrappers sometimes rebuild Today in a microtask. Mount only the final gated view.
 const render=renderClient;renderClient=function(){observer?.disconnect();const result=render(),user=state.user?.id,client=state.client?.id;Promise.resolve(result).then(()=>{if(state.user?.id!==user||state.client?.id!==client||!eligible())return;if(!$('#personalCoachingHome'))mount();else{arrange();watch();}}).catch(()=>{});return result;};
 async function refreshWeek(){
  if(scheduleLoading||document.hidden||!state.client)return;
  const today=M.localDate(new Date(),state.client.timezone||'Europe/Dublin');
  const host=$('#clientMain');
  if(state.clientView==='planner'&&host?.dataset.completionDate&&host.dataset.completionDate!==today&&!host.contains(document.activeElement?.closest('input, textarea, select'))){
   renderClient();return;
  }
  if(!eligible())return;
  const root=host?.querySelector('#personalCoachingHome');if(!root)return;
  if(root.dataset.localDate!==today){renderClient();return;}
  if(state.role!=='client'||state.preview)return;
  const client=state.client,user=state.user?.id,data=state.data,loadSequence=clientDataLoadSequence;
  const active=()=>root.isConnected&&eligible()&&state.role==='client'&&state.client===client&&state.user?.id===user;
  scheduleLoading=true;
  try{
   const anchor=client.start_date>today?client.start_date:today;
   const earliest=new Date(Date.parse(anchor+'T12:00:00Z')-6*864e5).toISOString().slice(0,10);
   const weeks=await query('This week',db.from('program_weeks').select('*').eq('client_id',client.id).eq('published',true).gte('week_start',earliest).lte('week_start',anchor).order('week_start',{ascending:false}));
   const ids=weeks.map(w=>w.id);
   const since=new Date(Date.now()-864e5).toISOString();
   const [sessions,calls]=await Promise.all([
    ids.length?query('This week’s sessions',db.from('training_sessions').select('*').in('week_id',ids)):[],
    query('Upcoming calls',db.from('client_coaching_calls').select('*').eq('client_id',client.id).eq('status','scheduled').gte('scheduled_at',since).order('scheduled_at').limit(30)).catch(()=>null)
   ]);
   if(!active()||data!==state.data||loadSequence!==clientDataLoadSequence)return;
   const current=data.weeks.filter(w=>w.published&&w.week_start>=earliest&&w.week_start<=anchor);
   const currentIds=new Set(current.map(w=>w.id));
   const snapshot=rows=>JSON.stringify([...rows].sort((a,b)=>a.id.localeCompare(b.id)));
   const changed=snapshot(weeks)!==snapshot(current)||snapshot(sessions)!==snapshot(data.sessions.filter(s=>currentIds.has(s.week_id)))
    ||(calls&&snapshot(calls)!==snapshot((data.coachingCalls||[]).filter(c=>c.status==='scheduled'&&Date.parse(c.scheduled_at)>=Date.parse(since)).sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at)).slice(0,30)));
   if(changed){
    if(!(await loadClientData(client.id)))return;
    root.dataset.refreshWeek='true';
   }
   const inputFocused=root.contains(document.activeElement)&&document.activeElement.matches('input, textarea, select');
   if(active()&&!inputFocused&&(root.dataset.refreshWeek||root.dataset.localDate!==today))renderClient();
  }catch(error){console.warn('Could not refresh the weekly schedule.',error);}
  finally{scheduleLoading=false;}
 }
 document.addEventListener('visibilitychange',refreshWeek);
 window.setInterval(refreshWeek,60000);
 window.PersonalCoachingHome={model,mount,arrange,startingPlan,weekSchedule};
})();

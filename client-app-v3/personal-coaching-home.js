/* A personal home built from published coaching and saved records. No inferred prescriptions. */
(function(){
 'use strict';
 const M=window.CheckinStatus;let observer=null,scheduleLoading=false;
 const owned=(rows,c)=>(rows||[]).filter(r=>r.client_id===c.id||state.preview&&!r.client_id);
 function startingPlan(client,data,date){
  if(!client.start_date||client.start_date<=date)return null;
  const week=owned(data.weeks,client).find(w=>w.published&&w.week_start<=client.start_date&&+new Date(client.start_date+'T12:00:00Z')- +new Date(w.week_start+'T12:00:00Z')<7*864e5);
  if(!week)return null;
  const menuDays=(data.nutritionDays||[]).filter(d=>d.week_id===week.id);
  return {hasMeals:menuDays.some(d=>d.nutrition_plan_id)};
 }
 function model(client,data,now=new Date()){
  const date=M.localDate(now,client.timezone||'Europe/Dublin'),period=M.week(client,now);
  const week=owned(data.weeks,client).filter(w=>w.published&&w.week_start<=date&&date<=new Date(+new Date(w.week_start+'T12:00:00Z')+6*864e5).toISOString().slice(0,10)).sort((a,b)=>b.week_start.localeCompare(a.week_start))[0];
  const sessions=(data.sessions||[]).filter(s=>week&&s.week_id===week.id&&(!s.client_id||s.client_id===client.id));
  const ordered=[...sessions].sort((a,b)=>String(a.session_date||'').localeCompare(String(b.session_date||''))||Number(a.sort_order||0)-Number(b.sort_order||0));
  const complete=s=>window.FlexibleCompletion?window.FlexibleCompletion.done(s,date):s.status==='completed';
  const daily=s=>['mobility','recovery'].includes(s.training_type);
  const pending=ordered.filter(s=>!['cancelled','skipped'].includes(s.status)&&!complete(s));
  const next=pending.find(s=>!daily(s)&&s.source_metadata?.optional!==true)||pending.find(s=>!daily(s))||pending[0];
  const saved=owned(data.checkins,client).some(r=>r.period_start===period);
  const due=client.weekly_checkin_enabled!==false?M.due(client,period):null;
  const start=startingPlan(client,data,date);
  const action=start?{route:'training',title:'Your first week starts '+fmt(client.start_date,{weekday:'long',day:'numeric',month:'long'}),label:'View your training plan'}:
   !saved&&due&&+due<=+now?{route:'checkin',title:'Your weekly check-in is due',label:'Complete check-in'}:
   next?{route:'training',session:next.id,category:daily(next)?'mobility':next.training_type==='cardio'?'cardio':'weights',title:next.title||'Your next session',label:'Open session'}:
   week&&sessions.some(complete)?{route:'progress',title:'You’ve finished this week’s sessions',label:'View progress'}:
   {route:'support',title:week?'No sessions scheduled this week':'Your next plan is coming',label:'Open Coach'};
  return {date,action,start};
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
  const links=[['training','Training'],['nutrition','Meals'],['progress','Progress'],['support','Coach']];
  if(!home.start&&client.weekly_checkin_enabled!==false)links.push(['checkin','Check-in']);
  root.innerHTML='<header class="pch-heading"><h1>'+esc(name?'Hi, '+name:'Today')+'</h1></header>'+
   '<section class="panel pch-next"><p class="eyebrow">'+(home.start?'YOUR FIRST WEEK':'NEXT UP')+'</p><h2>'+esc(action.title)+'</h2>'+
   '<button type="button" class="btn primary" data-pch-next>'+esc(action.label)+'</button></section>'+
   '<nav class="pch-shortcuts" aria-label="Go to">'+links.filter(([view])=>view!==action.route).map(([view,label])=>
    '<button type="button" class="btn ghost" data-pch-route="'+view+'">'+label+'</button>').join('')+'</nav>';
  host.replaceChildren(root);
  const active=()=>root.isConnected&&eligible()&&state.client===client&&state.user?.id===user&&state.role===role;
  function open(view,primary=false){
   if(!active())return;
   state.clientView=view;
   if(view==='checkin')state.checkinWeek=null;
   if(view==='training'){
    state.selectedSessionId=primary?action.session||null:null;
    state.trainingCategory=primary?action.category||'weights':'weights';
   }
   if(view==='nutrition'&&home.start&&home.start.hasMeals&&typeof window.openDailyNutritionDate==='function'){
    window.openDailyNutritionDate(client.start_date);return;
   }
   renderClient();
  }
  root.querySelector('[data-pch-next]').onclick=()=>open(action.route,true);
  root.querySelectorAll('[data-pch-route]').forEach(button=>button.onclick=()=>open(button.dataset.pchRoute));
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
   const sessions=ids.length?await query('This week’s sessions',db.from('training_sessions').select('*').in('week_id',ids)):[];
   if(!active()||data!==state.data||loadSequence!==clientDataLoadSequence)return;
   const current=data.weeks.filter(w=>w.published&&w.week_start>=earliest&&w.week_start<=anchor);
   const currentIds=new Set(current.map(w=>w.id));
   const snapshot=rows=>JSON.stringify([...rows].sort((a,b)=>a.id.localeCompare(b.id)));
   const changed=snapshot(weeks)!==snapshot(current)||snapshot(sessions)!==snapshot(data.sessions.filter(s=>currentIds.has(s.week_id)));
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
 window.PersonalCoachingHome={model,mount,arrange,startingPlan};
})();

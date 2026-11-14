/* A personal home built from published coaching and saved records. No inferred prescriptions. */
(function(){
 'use strict';
 const M=window.CheckinStatus,cache=new Map();let observer=null,scheduled=false;
 const owned=(rows,c)=>(rows||[]).filter(r=>r.client_id===c.id||state.preview&&!r.client_id);
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
  const action=checkinDue?{route:'checkin',label:'Complete your check-in',title:'Let Calum know how your week went.',detail:'Your saved check-in helps shape your next coaching review.'}:next?{route:'training',session:next.id,category:daily(next)?'mobility':next.training_type==='cardio'?'cardio':'weights',label:'Open session',title:next.title||'Your next session',detail:daily(next)?'Tick each practice when you finish. Earlier days stay saved.':'Complete when ready. Your session order is a guide, not a fixed day.'}:week&&sessions.length?{route:'progress',label:'View your progress',title:'Your recorded progress, in one place.',detail:'Your assigned sessions are complete. Review your progress or open Training for practice and extra activity.'}:{route:'support',label:'Open Coach',title:'Your coaching hub is here.',detail:week?'Your current week has no assigned sessions yet. Open Coach for your saved guidance.':'The current week has not been published yet. Your saved feedback and previous work remain available.'};
  return {date,week,goal,action,focus:String(week?.coach_note||'').trim(),saved,goals};
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
 }
 function watch(){observer?.disconnect();observer=null;if(!eligible())return;const host=$('#clientMain');if(!host)return;
  observer=new MutationObserver(rows=>{if(rows.some(r=>r.addedNodes.length||r.removedNodes.length)&&!scheduled){scheduled=true;queueMicrotask(arrange);}});observer.observe(host,{childList:true,subtree:true});
 }
 function paintFocus(root,m,rows,status='ready'){
  const box=root.querySelector('[data-pch-focus]');if(!box)return;
  const current=(rows||[]).filter(r=>r.client_id===state.client.id&&r.approved_at&&!r.archived_at&&r.starts_on<=m.date&&r.expires_on>=m.date),open=current.filter(r=>!r.completed_at);
  const text=m.focus||open[0]?.description;
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
  const client=state.client.id,user=state.user?.id,root=document.createElement('div');root.id='personalCoachingHome';root.className='pch-home';
  const name=String(state.client.display_name||'').trim().split(/\s+/)[0];
  root.innerHTML='<header class="pch-heading"><span class="eyebrow">YOUR PERSONAL COACHING</span><h1>'+esc(name?name+', here’s your focus.':'Your coaching, made clear.')+'</h1><p>One clear next step. Calum’s guidance, around your week.</p></header><section class="panel pch-goal"><span class="eyebrow">YOUR CURRENT GOAL</span><h2>'+esc(m.goal||'Your goals, agreed with Calum.')+'</h2>'+(m.goal?'':'<p>Open Coach to review your saved goals and agree your next target.</p>')+'</section><div data-pch-video hidden></div><section class="panel pch-focus" data-pch-focus></section><section class="panel pch-next"><span class="eyebrow">YOUR NEXT STEP</span><h2>'+esc(m.action.title)+'</h2><p>'+esc(m.action.detail)+'</p><button type="button" class="btn primary" data-pch-next>'+esc(m.action.label)+'</button></section><details class="pch-secondary" data-pch-secondary><summary><span>Your plan & progress</span><small>Meals, check-in, training and saved activity</small></summary><div data-pch-secondary-content></div></details>';
  host.prepend(root);const active=()=>root.isConnected&&eligible()&&state.user?.id===user&&state.client?.id===client;
  root.querySelector('[data-pch-next]').onclick=()=>{if(!active())return;if(m.action.session){state.selectedSessionId=m.action.session;state.trainingCategory=m.action.category;}route(m.action.route);};
  arrange();watch();focus(root,m);
 }
 const today=clientToday;clientToday=function(){const result=today();mount();return result;};
 // Later render wrappers sometimes rebuild Today in a microtask. Mount only the final gated view.
 const render=renderClient;renderClient=function(){observer?.disconnect();const result=render(),user=state.user?.id,client=state.client?.id;Promise.resolve(result).then(()=>{if(state.user?.id!==user||state.client?.id!==client||!eligible())return;if(!$('#personalCoachingHome'))mount();else{arrange();watch();}}).catch(()=>{});return result;};
 window.PersonalCoachingHome={model,mount,arrange};
})();

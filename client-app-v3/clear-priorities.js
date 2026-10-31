/* Clear daily priorities. No new prescriptions, tracking requirements or messages. */
(function(){
 'use strict';let generation=0;
 const M=window.CheckinStatus,owned=r=>r.client_id===state.client?.id||state.preview&&!r.client_id;
 function route(view){state.clientView=view;renderClient();}
 function action(view,label){return '<button type="button" class="btn ghost" data-priority-route="'+view+'">'+esc(label)+'</button>';}
 function currentCheckin(client,rows,now=new Date()){
  try{const period=M.week(client,now),saved=rows.find(r=>r.client_id===client.id&&r.period_start===period),due=M.due(client,period);return {saved,due,label:client.weekly_checkin_enabled===false?'Not scheduled':saved?saved.reviewed_at?'Reviewed':'Submitted':!due?'Deadline not configured':now>due?'Overdue':'Due'};}catch{return {saved:null,due:null,label:'Timezone needs setup'};}
 }
 function home(){
  const host=$('#clientMain');if(!host||!state.client)return;
  const c=state.client,data=state.data,now=new Date();let today;
  try{today=M.localDate(now,c.timezone||'Europe/Dublin');}catch{host.insertAdjacentHTML('afterbegin','<p role="status">Your timezone needs coach setup before today’s plan can be shown.</p>');return;}
  const week=(data.weeks||[]).filter(w=>(!w.client_id||owned(w))&&w.published&&w.week_start<=today&&today<=new Date(+new Date(w.week_start+'T12:00:00Z')+6*864e5).toISOString().slice(0,10)).sort((a,b)=>b.week_start.localeCompare(a.week_start))[0];
  const sessions=(data.sessions||[]).filter(s=>(!s.client_id||owned(s))&&s.week_id===week?.id&&s.session_date>=today&&s.status!=='completed').sort((a,b)=>a.session_date.localeCompare(b.session_date)||String(a.scheduled_time||'').localeCompare(String(b.scheduled_time||'')));
  const next=sessions[0],day=(data.nutritionDays||[]).find(d=>d.week_id===week?.id&&d.nutrition_date===today),plan=(data.nutritionPlans||[]).find(p=>p.id===day?.nutrition_plan_id&&(!p.client_id||owned(p))),meals=plan?assignedMealsForPlan(plan):[];
  const check=currentCheckin(c,(data.checkins||[]).filter(owned),now);
  const publishedVideos=(data.coachingGuidance||[]).filter(r=>owned(r)&&r.published&&/^Video check-in\b/.test(r.title||'')).map(r=>{
   const link=window.ClientCheckinVideo?.parse(String(r.body||'').match(/https:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/[a-f0-9]{32}/i)?.[0]);
   return link?{reviewed_at:String(r.body||'').match(/Recorded:\s*(\d{4}-\d{2}-\d{2})/)?.[1]||r.created_at,voice_note_url:link.url}:null;
  }).filter(Boolean);
  const review=[...(data.checkins||[]).filter(r=>owned(r)&&r.reviewed_at&&(r.coach_response||safeMediaUrl(r.voice_note_url))),...publishedVideos].sort((a,b)=>String(b.reviewed_at).localeCompare(String(a.reviewed_at)))[0];
  const date=d=>new Intl.DateTimeFormat('en-IE',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
  host.innerHTML=clientHeader('YOUR DAY','A clear next step.','Your training, meals and coaching—without another daily checklist.')+
   '<div class="priority-grid"><section class="panel priority-training"><span class="eyebrow">01 · NEXT SESSION</span><h2>'+esc(next?.title||'Your next session')+'</h2><p>'+esc(next?date(next.session_date)+(next.scheduled_time?' · '+next.scheduled_time.slice(0,5)+' '+(next.schedule_timezone||c.timezone||''):''):week?'No unfinished session is scheduled in your current week.':'Your coach needs to publish the current week.')+'</p>'+(next?'<button type="button" class="btn primary" data-priority-session="'+esc(next.id)+'">Open session</button>':action('training','View training & history'))+'</section>'+
   '<section class="panel"><span class="eyebrow">02 · TODAY’S MEALS</span><h2>Your meals, not a food diary.</h2>'+(meals.length?'<ul class="priority-meals">'+meals.map(({meal})=>'<li>'+esc(meal.name)+'</li>').join('')+'</ul>':'<p>No measured menu is assigned for today. Your coach can complete it.</p>')+action('nutrition','Meals, portions & swaps')+'<p class="muted">Daily food logging is optional unless you and Calum have agreed otherwise. Your meals and strength progress still work without a daily diary.</p></section>'+
   '<section class="panel"><span class="eyebrow">03 · WEEKLY CHECK-IN</span><h2>'+esc(check.label)+'</h2><p>'+esc(check.saved?'Saved '+M.stamp(check.saved.submitted_at,c.timezone||'Europe/Dublin'):check.due?'Due '+M.stamp(check.due,c.timezone||'Europe/Dublin'):c.weekly_checkin_enabled===false?'Your coach has not scheduled weekly check-ins.':'Your coach needs to confirm the day, time and timezone.')+'</p>'+action('checkin',check.saved?'View saved check-in':'Open weekly check-in')+'</section>'+
   '<section class="panel priority-feedback"><span class="eyebrow">04 · LATEST COACH FEEDBACK</span><h2>'+ (review?'Your next steps.':'Your coach is here.')+'</h2>'+(review?'<p class="muted">Reviewed '+esc(M.stamp(review.reviewed_at,c.timezone||'Europe/Dublin'))+'</p>'+'<p>Open Coach for your video feedback and agreed next steps.</p>':'<p>No completed feedback is saved yet. Use your usual private coaching chat if you need Calum.</p>')+action('support','Your coaching hub')+'</section></div><section class="panel priority-progress"><div><span class="eyebrow">PROGRESS THAT COUNTS</span><h2>See your lifts build.</h2><p>Actual resistance sets, with weight and reps together. No food diary needed.</p></div>'+action('progress','Open strength progress')+'</section>';
  host.querySelectorAll('[data-priority-route]').forEach(b=>{const user=state.user?.id,id=c.id;b.onclick=()=>{if(b.isConnected&&state.user?.id===user&&state.client?.id===id)route(b.dataset.priorityRoute);};});
  host.querySelectorAll('[data-priority-session]').forEach(b=>{const user=state.user?.id,id=c.id;b.onclick=()=>{if(!b.isConnected||state.user?.id!==user||state.client?.id!==id)return;state.selectedSessionId=b.dataset.prioritySession;state.trainingCategory=['mobility','recovery'].includes(next.training_type)?'mobility':next.training_type==='cardio'?'cardio':'weights';route('training');};});
  const watch=window.LegalEdgeStrength?.watchMarkup?.();if(watch){const head=host.querySelector('.page-head,.client-page-head,.client-heading,.client-header');if(head)head.insertAdjacentHTML('afterend',watch);else host.insertAdjacentHTML('afterbegin',watch);const b=host.querySelector('[data-pf-route="health"]'),user=state.user?.id;b.onclick=()=>{if(b.isConnected&&state.user?.id===user&&state.client?.id===c.id)route('health');};}
 }
 const beforeToday=clientToday;clientToday=function(){beforeToday();home();};
 const beforeClient=renderClient;renderClient=function(){const r=beforeClient();const user=state.user?.id,id=state.client?.id;Promise.resolve(r).then(()=>{if(state.user?.id!==user||state.client?.id!==id||state.clientView!=='today')return;$('#csCoachReview')?.remove();});return r;};
 function eligible(){return state.role==='coach'&&!state.client&&['dashboard','clients'].includes(state.coachView);}
 async function attention(){
  if(!eligible()||state.preview)return;const host=$('#coachMain');if(!host)return;
  host.querySelector('#priorityAttention')?.remove();const panel=document.createElement('section');panel.id='priorityAttention';panel.className='panel priority-attention';panel.innerHTML='<div class="panel-head"><div><span class="eyebrow">COACH HOME</span><h2>Needs attention</h2></div><button class="btn ghost small" type="button">Refresh</button></div><div data-priority-status role="status">Checking saved records…</div>';host.prepend(panel);
  const user=state.user?.id,view=state.coachView,clients=state.clients.filter(c=>['active','ending'].includes(c.status)&&!c.deleted_at&&!/(demo|test)/i.test(c.display_name||''));
  async function load(){const token=++generation,active=()=>token===generation&&panel.isConnected&&eligible()&&state.user?.id===user&&state.coachView===view;const status=panel.querySelector('[role=status]'),button=panel.querySelector('button');button.disabled=true;status.textContent='Checking saved records…';
   try{const ids=clients.map(c=>c.id),dates=clients.map(c=>{try{return M.localDate(new Date(),c.timezone||'Europe/Dublin');}catch{return null;}}).filter(Boolean).sort(),start=dates[0]?new Date(+new Date(dates[0]+'T12:00:00Z')-6*864e5).toISOString().slice(0,10):null;
    if(!ids.length){status.textContent='No active clients to review.';return;}
    const results=await Promise.allSettled([
     query('Attention check-ins',db.from('checkins').select('id,client_id,period_start,submitted_at,reviewed_at,source_system').in('client_id',ids).gte('period_start',start).limit(1000)),
     query('Attention current plans',db.from('program_weeks').select('id,client_id,week_start,published,nutrition_days(nutrition_date,nutrition_plan_id,nutrition_plans(client_id))').in('client_id',ids).eq('published',true).gte('week_start',start).lte('week_start',dates.at(-1)).limit(500))
    ]);if(!active())return;
    const capped=results.some((r,i)=>r.status==='fulfilled'&&r.value.length>=(i?500:1000));
    const checks=results[0].status==='fulfilled'&&results[0].value.length<1000?results[0].value:null,weeks=results[1].status==='fulfilled'&&results[1].value.length<500?results[1].value:null;
    panel.dataset.homeCheckins=JSON.stringify({available:!!checks,checked_at:new Date().toISOString(),rows:checks?clients.map(c=>{const cs=currentCheckin(c,checks);return cs.saved?{client_id:c.id,submitted_at:cs.saved.submitted_at,reviewed_at:cs.saved.reviewed_at||null}:null;}).filter(Boolean):[]});
    const issues=clients.map(c=>{const notes=[];let date;try{date=M.localDate(new Date(),c.timezone||'Europe/Dublin');}catch{notes.push('Timezone needs setup');}
     const cs=checks?currentCheckin(c,checks):null;
     if(!checks)notes.push('Check-in status unavailable');else if(cs.saved&&!cs.saved.reviewed_at)notes.push('Check-in ready to review');else if(['Overdue','Deadline not configured','Timezone needs setup'].includes(cs.label)&&c.weekly_checkin_enabled!==false)notes.push(cs.label);
     if(!weeks)notes.push('Plan status unavailable');else if(date){const current=weeks.filter(w=>w.client_id===c.id&&w.week_start<=date&&date<=new Date(+new Date(w.week_start+'T12:00:00Z')+6*864e5).toISOString().slice(0,10));if(!current.length)notes.push('Current published week missing');else if(!current.some(w=>(w.nutrition_days||[]).some(d=>d.nutrition_date===date&&d.nutrition_plan_id&&d.nutrition_plans?.client_id===c.id)))notes.push('Today’s owned menu missing');}
     return {c,cs,notes};}).filter(r=>r.notes.length);
    status.innerHTML=(capped?'<p>Result limit reached. Open Check-ins and individual plans for complete evidence.</p>':'')+'<p>Saved records only. Disabled portals stay visible for setup; food logging is never an adherence requirement.</p>'+ (issues.length?issues.map(({c,cs,notes})=>'<article class="priority-issue"><div><strong>'+esc(c.display_name)+'</strong><p>'+notes.map(esc).join(' · ')+'</p>'+(cs?.saved?'<small>Submitted '+esc(M.stamp(cs.saved.submitted_at,c.timezone||'Europe/Dublin'))+'</small>':cs?.due?'<small>Due '+esc(M.stamp(cs.due,c.timezone||'Europe/Dublin'))+'</small>':'')+'</div><button type="button" class="btn ghost small" data-priority-client="'+esc(c.id)+'">Open client</button></article>').join(''):'<p>No outstanding item was found in these current-week records. This is not a device test.</p>')+'<small>Checked '+esc(M.stamp(new Date(),'Europe/Dublin'))+'</small><p><button type="button" class="btn primary" data-priority-reviews>Open check-in reviews & comparisons</button></p>';
    status.querySelectorAll('[data-priority-client]').forEach(b=>{b.dataset.clientId=b.dataset.priorityClient;});bindClientRows();status.querySelector('[data-priority-reviews]').onclick=()=>{if(!active())return;state.client=null;state.coachView='reviews';renderCoach();};
   }catch{if(active()){panel.dataset.homeCheckins=JSON.stringify({available:false,rows:[]});status.textContent='Attention status could not load. Refresh to retry; unavailable is not zero.';}}finally{if(active())button.disabled=false;}
  }
  panel.querySelector('button').onclick=load;load();
 }
 const beforeCoach=renderCoach;renderCoach=function(){const r=beforeCoach();Promise.resolve(r).then(attention).catch(()=>{});return r;};
 window.LegalEdgePriorities={currentCheckin,home};
})();

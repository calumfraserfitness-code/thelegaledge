/* Two coach-approved gym choices for the same scheduled workout slots. */
(function(){
 'use strict';
 const gyms={planet:'Planet Fitness Fishtown',edge:'The Edge Cherry Hill'};
 const names={planet:'Planet Fitness',edge:'The Edge'};
 const owner=()=>[state.user?.id,state.role,state.client?.id].join('|');
 function options(sessions){
  const days=new Map((state.data.programs||[]).filter(p=>(!p.client_id||p.client_id===state.client.id)&&(p.status==='active'||state.preview)).flatMap(p=>(p.days||[]).map(d=>[d.id,d])));
  return sessions.filter(s=>s.source_metadata?.gym_days).map(s=>({session:s,planet:days.get(s.source_metadata.gym_days.planet),edge:days.get(s.source_metadata.gym_days.edge)})).filter(o=>o.planet&&o.edge).sort((a,b)=>(a.session.sort_order||0)-(b.session.sort_order||0));
 }
 function activeGym(workouts){
  return workouts.every(o=>o.session.programme_day_id===o.edge.id)?'edge':'planet';
 }
 function markup(week,sessions,selected=null){
  const workouts=options(sessions);if(!workouts.length)return '';
  const focused=workouts.find(o=>o.session.id===selected);
  const gym=focused?(focused.session.programme_day_id===focused.edge.id?'edge':'planet'):activeGym(workouts);
  return '<section class="panel gym-plan" data-gym-plan="'+esc(week.id)+'"><div class="gym-plan-heading"><div><h2>Your two gym options</h2><p>Do full body A and B once each, plus one easy Peloton ride. Use the same gym for both or choose a different gym for one workout.</p></div></div><div class="head-actions" aria-label="Compare gyms">'+Object.keys(gyms).map(k=>'<button class="btn ghost small" type="button" data-gym-tab="'+k+'" aria-pressed="'+(k===gym)+'">'+esc(names[k])+'</button>').join('')+'</div><div data-gym-workouts></div><p data-gym-status role="status"></p></section>';
 }
 function bind(root,week,sessions,selected=null){
  const box=root.querySelector('[data-gym-plan]');if(!box)return;
  const account=owner(),workouts=options(sessions),output=box.querySelector('[data-gym-workouts]');
  const active=()=>box.isConnected&&owner()===account;
  const canChoose=state.role==='client'&&!state.preview;
  let pending=false;
  const logged=s=>s.status!=='planned'||(state.data.exerciseLogs||[]).some(row=>row.training_session_id===s.id);
  function show(gym){
   if(!active())return;
   box.querySelectorAll('[data-gym-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gymTab===gym)));
   const canUseBoth=workouts.length>1&&workouts.some(o=>o.session.programme_day_id!==o[gym].id)&&workouts.every(o=>o.session.programme_day_id===o[gym].id||!logged(o.session));
   output.innerHTML='<h3>'+esc(gyms[gym])+'</h3>'+(canChoose&&canUseBoth?'<button class="btn primary small" type="button" data-gym-select>Use this gym for both workouts</button>':'')+workouts.map((o,i)=>{
    const d=o[gym],s=o.session,isAssigned=d.id===s.programme_day_id;
    const button=canChoose&&!isAssigned&&!logged(s)?'<button class="btn ghost small" type="button" data-gym-select="'+esc(s.id)+'">Use this gym for workout '+String.fromCharCode(65+i)+'</button>':'';
    return '<details class="gym-workout" '+(selected===s.id?'open':'')+'><summary>'+esc(d.title)+(isAssigned?' <small>Selected</small>':'')+'</summary><ul>'+programDayExercises(d).map(ex=>'<li><span>'+esc(ex.name)+'</span><strong>'+esc(ex.sets)+' × '+esc(ex.reps)+'</strong></li>').join('')+'</ul>'+button+'</details>';
   }).join('');
   output.querySelectorAll('[data-gym-select]').forEach(b=>b.onclick=async()=>{
    if(!active()||!canChoose||pending)return;
    pending=true;box.querySelectorAll('button').forEach(button=>button.disabled=true);
    const status=box.querySelector('[data-gym-status]');status.textContent='Saving gym choice…';
    try{
     const rows=await query('Save gym choice',db.rpc('select_workout_gym',{p_week:week.id,p_gym:gym,p_session:b.dataset.gymSelect||null}));
     if(!active())return;
     const expected=b.dataset.gymSelect?workouts.filter(o=>o.session.id===b.dataset.gymSelect):workouts;
     if(!Array.isArray(rows)||rows.length!==expected.length||expected.some(o=>!rows.some(row=>row.id===o.session.id&&row.week_id===week.id&&row.programme_day_id===o[gym].id)))throw Error('Gym choice could not be confirmed. Refresh before retrying.');
     const byId=new Map(rows.map(row=>[row.id,row]));
     state.data.sessions=state.data.sessions.map(s=>byId.get(s.id)||s);
     toast('Gym choice saved');renderClient();
    }catch(error){if(active())status.textContent=error.message;}
    finally{pending=false;if(active())box.querySelectorAll('button').forEach(button=>button.disabled=false);}
   });
  }
  box.querySelectorAll('[data-gym-tab]').forEach(b=>b.onclick=()=>show(b.dataset.gymTab));
  show(box.querySelector('[aria-pressed=true]').dataset.gymTab);
 }
 const training=clientTraining;
 clientTraining=function(){
  const result=training(),host=$('#clientMain'),week=typeof clientTrainingWeek==='function'?clientTrainingWeek():currentWeek();
  if(!host||!week?.published||state.trainingCategory!=='weights')return result;
  const sessions=(state.data.sessions||[]).filter(s=>s.week_id===week.id),selected=state.selectedSessionId;
  if(!host.querySelector('[data-gym-plan]')){
   const html=markup(week,sessions,selected);if(html){host.insertAdjacentHTML('afterbegin',html);bind(host,week,sessions,selected);}
  }
  return result;
 };
 const coachMeals=coachNutrition;
 coachNutrition=function(){
  const result=coachMeals(),host=$('#clientWorkspaceBody');
  const plan=(state.data.nutritionPlans||[]).find(p=>p.is_active&&p.client_id===state.client?.id&&p.source_json?.food_brief);
  const brief=window.FoodPlanBrief?.markup(plan,{coach:true});
  if(host&&brief&&!host.querySelector('.food-plan-brief'))host.insertAdjacentHTML('afterbegin',brief);
  return result;
 };
 window.GymPlans={markup,bind};
})();

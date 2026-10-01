// Shared production coaching tools for direct and firm-sponsored clients.
const coachingMetrics={manual:'Coach-recorded progress',weight_kg:'Body weight (kg)',steps:'Average daily steps',weekly_sessions:'This week’s completed strength sessions',sleep_minutes:'Average sleep (minutes)',nutrition_adherence:'Nutrition adherence (%)',energy:'Energy (1–10)'};
const coachingCategories={busy_week:'Busy-week plan',eating_out:'Eating out',meal_example:'Meal example',recovery:'Recovery / mobility'};
function finiteRecorded(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function recentHealthRows(days=7){const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days+1);return preferredHealthDays().filter(r=>r.date>=iso(cutoff)&&r.date<=iso(new Date()));}
function recordedAverage(rows,key){const values=rows.filter(r=>finiteRecorded(r[key])).map(r=>Number(r[key]));return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}
function coachingGoalValue(goal){
 const latest=state.data.checkins[0],week=currentWeek();
 switch(goal.metric){
 case 'steps':{const cutoff=iso(new Date(Date.now()-6*864e5));const manual=(state.data.steps||[]).filter(r=>r.entry_date>=cutoff&&r.entry_date<=iso(new Date()));return recordedAverage(recentHealthRows(),'steps')??recordedAverage(manual,'actual_steps')??(finiteRecorded(latest?.average_steps)?Number(latest.average_steps):null);}
 case 'weight_kg':{const p=state.data.progress.find(p=>finiteRecorded(p.weight_kg));return p?Number(p.weight_kg):null;}
 case 'weekly_sessions':return week?state.data.sessions.filter(s=>s.week_id===week.id&&s.status==='completed'&&['weights','resistance'].includes(s.training_type)).length:null;
 case 'sleep_minutes':return recordedAverage(recentHealthRows(),'sleep_minutes')??(finiteRecorded(latest?.sleep_hours)?Number(latest.sleep_hours)*60:null);
 case 'nutrition_adherence':return finiteRecorded(latest?.nutrition_adherence)?Number(latest.nutrition_adherence):null;
 case 'energy':return finiteRecorded(latest?.energy)?Number(latest.energy):null;
 default:return finiteRecorded(goal.current_value)?Number(goal.current_value):null;
 }
}
function coachingGoalPercent(goal,value){if(!finiteRecorded(value))return null;const distance=Number(goal.target)-Number(goal.baseline);return distance===0?(Number(value)===Number(goal.target)?100:0):Math.max(0,Math.min(100,(Number(value)-Number(goal.baseline))/distance*100));}
function coachingGoalsMarkup(){
 const goals=(state.data.coachingGoals||[]).filter(g=>g.status!=='paused');
 return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">PERSONAL GOALS</span><h2>Your agreed targets</h2><p>Progress uses your recorded data. Missing measurements stay blank.</p></div></div><div class="cw-goals">${goals.map(g=>{const value=coachingGoalValue(g),pct=coachingGoalPercent(g,value);return `<article><span class="pill">${esc(g.status)}</span><h3>${esc(g.title)}</h3><p>${esc(g.reason||'')}</p><b>${value===null?'Awaiting data':Number(value.toFixed(1))} / ${esc(g.target)} ${esc(g.unit)}</b>${pct===null?'':`<progress value="${pct}" max="100" aria-label="${esc(g.title)} progress"></progress>`}<small>Baseline ${esc(g.baseline)} · target ${g.target_date?fmt(g.target_date):'date to agree'} · ${esc(coachingMetrics[g.metric])}</small></article>`;}).join('')||'<div class="empty">Your coach has not added a measurable goal yet.</div>'}</div></section>`;
}
function coachingCallsMarkup(){
 const calls=state.data.coachingCalls||[];
 return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">COACHING CALLS</span><h2>Your monthly reviews</h2><p>Times use the timezone shown beside each call. Setting a call here does not send a calendar invitation.</p></div></div>${calls.map(c=>`<article class="cw-call"><div><b>${esc(c.title)}</b><p>${new Date(c.scheduled_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})} (${Intl.DateTimeFormat().resolvedOptions().timeZone}) · ${c.duration_minutes} minutes · ${esc(c.status)}</p>${c.recap?`<p>${esc(c.recap)}</p>`:''}</div>${c.status==='scheduled'&&safeMediaUrl(c.join_url)?`<a class="btn primary" target="_blank" rel="noopener" href="${esc(safeMediaUrl(c.join_url))}">Join call</a>`:''}</article>`).join('')||'<div class="empty">No call time has been agreed yet. Raise availability in your weekly check-in.</div>'}</section>`;
}
function coachingGuidanceMarkup(){
 const rows=(state.data.coachingGuidance||[]).filter(g=>g.published);
 return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">YOUR PRACTICAL OPTIONS</span><h2>Food, recovery and demanding weeks</h2><p>Guidance selected for your restrictions, goals and schedule.</p></div><div class="nutrition-unit-switch"><button class="btn ghost small" data-guidance-unit="metric">Grams / metric</button><button class="btn ghost small" data-guidance-unit="us">Ounces / US</button></div></div><div class="cw-guidance">${rows.map(g=>`<article><span class="eyebrow">${esc(coachingCategories[g.category])}</span><h3>${esc(g.title)}</h3><p class="cw-lines">${esc(g.body)}</p>${g.ingredients?.length?`<ul>${g.ingredients.map(i=>`<li><b>${esc(i.name)}</b><span>${esc(nutritionUnit(i.quantity,i.unit)||'Portion to agree')}</span></li>`).join('')}</ul>`:''}</article>`).join('')||'<div class="empty">Your coach has not published personal busy-week or eating-out options yet.</div>'}</div></section>`;
}
function clientCoachingSupport(){
 $('#clientMain').innerHTML=clientHeader('YOUR COACHING','Goals, calls & practical support','Everything here belongs to your private coaching account.')+coachingGoalsMarkup()+coachingCallsMarkup()+coachingGuidanceMarkup()+`<section class="panel"><h3>Connected health</h3><p>Use imported steps and sleep to see progress alongside your check-ins. Apple and Google currently use file import; automatic phone sync is not connected.</p><button class="btn primary" id="cwHealth">Open health connections & import</button></section>`;
 $('#cwHealth').onclick=()=>{state.clientView='health';renderClient();};
 $$('[data-guidance-unit]').forEach(b=>b.onclick=()=>{state.foodUnits=b.dataset.guidanceUnit;clientCoachingSupport();});
}
function coachCoachingGoals(){
 $('#clientWorkspaceBody').innerHTML=coachingGoalsMarkup()+`<section class="panel"><h3>Create a personal goal</h3><form id="cwGoalForm" class="editor-grid"><label class="wide">Goal title<input name="title" maxlength="160" required></label><label>Progress source<select name="metric">${Object.entries(coachingMetrics).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label>Unit<input name="unit" placeholder="sessions, steps, kg…" maxlength="30"></label><label>Baseline<input name="baseline" type="number" step=".1" required></label><label>Target<input name="target" type="number" step=".1" required></label><label>Current (manual goals only)<input name="current_value" type="number" step=".1"></label><label>Target date<input name="target_date" type="date"></label><label class="wide">Why this matters to them<textarea name="reason" rows="2" maxlength="1000"></textarea></label><button class="btn primary wide">Save personal goal</button></form></section><section class="panel"><h3>Manage goals</h3>${(state.data.coachingGoals||[]).map(g=>`<form class="editor-grid" data-cw-goal="${g.id}"><label class="wide">Title<input name="title" value="${esc(g.title)}" required maxlength="160"></label><label>Target<input name="target" type="number" step=".1" value="${g.target}" required></label><label>Manual current value<input name="current_value" type="number" step=".1" value="${g.current_value??''}"></label><label>Target date<input name="target_date" type="date" value="${g.target_date||''}"></label><label>Status<select name="status">${['active','complete','paused'].map(v=>`<option ${v===g.status?'selected':''}>${v}</option>`).join('')}</select></label><label class="wide">Reason<textarea name="reason">${esc(g.reason||'')}</textarea></label><button class="btn ghost wide">Save goal changes</button></form>`).join('')}</section>`;
 $('#cwGoalForm').onsubmit=e=>saveCoachingRecord(e,'client_coaching_goals','coachingGoals',null,coachCoachingGoals);
 $$('[data-cw-goal]').forEach(f=>f.onsubmit=e=>saveCoachingRecord(e,'client_coaching_goals','coachingGoals',f.dataset.cwGoal,coachCoachingGoals));
}
function coachCoachingSupport(){
 $('#clientWorkspaceBody').innerHTML=coachingCallsMarkup()+`<section class="panel"><h3>Record an agreed call time</h3><form id="cwCallForm" class="editor-grid"><label>Title<input name="title" value="Monthly coaching call" required></label><label>Date & time (${Intl.DateTimeFormat().resolvedOptions().timeZone})<input name="scheduled_local" type="datetime-local" required></label><label>Duration (minutes)<input name="duration_minutes" type="number" min="5" max="180" value="30" required></label><label>HTTPS meeting link<input name="join_url" type="url" pattern="https://.*"></label><label class="wide">Recap / agreed priorities<textarea name="recap" rows="2"></textarea></label><button class="btn primary wide">Save agreed call</button></form><p class="muted">Record only an agreed time. This does not create a calendar event or send an invitation.</p>${(state.data.coachingCalls||[]).map(c=>`<form data-cw-call="${c.id}" class="editor-grid"><label>${esc(c.title)}<select name="status">${['scheduled','complete','cancelled'].map(v=>`<option ${c.status===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="wide">Participant-visible recap<textarea name="recap">${esc(c.recap||'')}</textarea></label><button class="btn ghost">Save call update</button></form>`).join('')}</section>${coachingGuidanceMarkup()}<section class="panel"><h3>Add personal guidance</h3><form id="cwGuidanceForm" class="editor-grid"><label>Category<select name="category">${Object.entries(coachingCategories).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label>Title<input name="title" maxlength="160" required></label><label class="wide">Specific instructions / meal choices<textarea name="body" rows="5" required></textarea></label><fieldset class="wide cw-ingredient-fields"><legend>Optional measured ingredients</legend>${Array.from({length:5},(_,i)=>`<div><label>Ingredient ${i+1}<input name="ingredient_name_${i}"></label><label>Quantity<input name="ingredient_quantity_${i}" type="number" min=".1" step=".1"></label><label>Unit<select name="ingredient_unit_${i}"><option>g</option><option>oz</option><option>ml</option><option>fl oz</option><option>count</option></select></label></div>`).join('')}</fieldset><label><input type="checkbox" name="published"> Publish to this client</label><button class="btn primary wide">Save personal guidance</button></form>${(state.data.coachingGuidance||[]).map(g=>`<form data-cw-guidance="${g.id}" class="editor-grid"><label class="wide">Title<input name="title" value="${esc(g.title)}" required maxlength="160"></label><label class="wide">Instructions<textarea name="body" rows="4" required>${esc(g.body)}</textarea></label><label><input type="checkbox" name="published" ${g.published?'checked':''}> Published</label><button class="btn ghost">Save guidance update</button></form>`).join('')}</section>`;
 $('#cwCallForm').onsubmit=e=>saveCoachingRecord(e,'client_coaching_calls','coachingCalls',null,coachCoachingSupport);
 $('#cwGuidanceForm').onsubmit=e=>saveCoachingRecord(e,'client_coaching_guidance','coachingGuidance',null,coachCoachingSupport);
 $$('[data-cw-call]').forEach(f=>f.onsubmit=e=>saveCoachingRecord(e,'client_coaching_calls','coachingCalls',f.dataset.cwCall,coachCoachingSupport));
 $$('[data-cw-guidance]').forEach(f=>f.onsubmit=e=>saveCoachingRecord(e,'client_coaching_guidance','coachingGuidance',f.dataset.cwGuidance,coachCoachingSupport));
}
async function saveCoachingRecord(event,table,key,id,render){
 event.preventDefault();const fd=new FormData(event.target),row=Object.fromEntries(fd),clientId=state.client.id;
 for(const field of ['baseline','target','current_value','duration_minutes'])if(fd.has(field))row[field]=fd.get(field)===''?null:Number(fd.get(field));
 if(fd.has('target_date'))row.target_date=fd.get('target_date')||null;
 if(table==='client_coaching_calls'&&fd.has('scheduled_local')){row.scheduled_at=new Date(fd.get('scheduled_local')).toISOString();delete row.scheduled_local;row.join_url=row.join_url||null;}
 if(table==='client_coaching_guidance'){
 row.published=fd.has('published');
 if(!id){row.ingredients=[];for(let i=0;i<5;i++){const name=String(fd.get('ingredient_name_'+i)||'').trim(),quantity=Number(fd.get('ingredient_quantity_'+i)),unit=fd.get('ingredient_unit_'+i);if(name){if(!(quantity>0))return toast('Add a positive quantity for '+name,'error');row.ingredients.push({name,quantity,unit});}delete row['ingredient_name_'+i];delete row['ingredient_quantity_'+i];delete row['ingredient_unit_'+i];}}
 }
 if(!id)row.client_id=clientId;
 setBusy(event.submitter,true);
 try{
 const saved=state.preview?{...row,id:id||'sample-'+Date.now(),status:row.status||(table==='client_coaching_calls'?'scheduled':'active')}:(await query('Personal coaching record',id?db.from(table).update(row).eq('id',id).eq('client_id',clientId).select():db.from(table).insert(row).select()))[0];
 if(!saved?.id)throw new Error('Record was not saved. Reload and try again.');
 if(state.client.id!==clientId)return;
 const entries=state.data[key]||[],index=entries.findIndex(x=>x.id===saved.id);if(index>=0)entries[index]={...entries[index],...saved};else entries.push(saved);state.data[key]=entries;
 render();toast(state.preview?'Sample updated locally':'Personal coaching record saved');
 }catch(error){toast(error.message,'error');setBusy(event.submitter,false);}
}
function clientScheduleMarkup(){
 const week=currentWeek();if(!week)return '';
 return `<section class="panel" id="cwTimingPanel"><div class="panel-head"><div><span class="eyebrow">FIT YOUR WEEK</span><h2>Choose when to train</h2><p>Move planned activities within this week. Your prescribed exercises stay attached; meal assignments stay on their dates.</p></div></div>${state.data.sessions.filter(s=>s.week_id===week.id&&s.status!=='completed').map(s=>`<form class="cw-schedule" data-cw-session="${s.id}"><b>${esc(s.title)}</b><label>Day<input name="session_date" type="date" min="${week.week_start}" max="${iso(new Date(new Date(week.week_start+'T12:00:00').getTime()+6*864e5))}" value="${s.session_date}" required></label><label>Time<input name="scheduled_time" type="time" value="${s.scheduled_time?.slice(0,5)||''}"></label><label>Timezone<select name="schedule_timezone">${['Europe/Dublin','Europe/London','America/New_York','America/Chicago','America/Los_Angeles',Intl.DateTimeFormat().resolvedOptions().timeZone].filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<option ${v===(s.schedule_timezone||Intl.DateTimeFormat().resolvedOptions().timeZone)?'selected':''}>${v}</option>`).join('')}</select></label><button class="btn ghost">Save timing</button></form>`).join('')||'<div class="empty">No uncompleted scheduled activities to move.</div>'}</section>`;
}
function bindClientScheduling(){
 $$('[data-cw-session]').forEach(form=>form.onsubmit=async event=>{
 event.preventDefault();const id=form.dataset.cwSession,session=state.data.sessions.find(s=>s.id===id),fd=new FormData(form),clientId=state.client.id;setBusy(event.submitter,true);
 try{const saved=state.preview?{...session,session_date:fd.get('session_date'),scheduled_time:fd.get('scheduled_time')||null,schedule_timezone:fd.get('schedule_timezone')} :await query('Personal session timing',db.rpc('schedule_client_session',{target_session_id:id,new_date:fd.get('session_date'),new_time:fd.get('scheduled_time')||null,new_timezone:fd.get('schedule_timezone')}));if(!saved?.id)throw new Error('Session was not updated');if(state.client.id!==clientId)return;Object.assign(session,saved);clientPlanner();toast(state.preview?'Sample timing updated':'Session timing saved');}catch(error){toast(error.message,'error');setBusy(event.submitter,false);}
 });
}
const originalLoadCoachingClient=loadClientData;
loadClientData=async function(id){await originalLoadCoachingClient(id);if(state.client?.id!==id)return;
 const result=await Promise.all([['client_coaching_goals','coachingGoals','created_at'],['client_coaching_calls','coachingCalls','scheduled_at'],['client_coaching_guidance','coachingGuidance','created_at']].map(async([table,key,order])=>[key,await query('Personal coaching '+key,db.from(table).select('*').eq('client_id',id).order(order).limit(200))]));
 if(state.client?.id===id)for(const[key,rows]of result)state.data[key]=rows;
};
COACH_TABS.push('goals','support');
const originalCoachingWorkspace=renderClientWorkspace;
renderClientWorkspace=function(){if(['goals','support'].includes(state.clientTab)){
 const tab=state.clientTab;state.clientTab='overview';originalCoachingWorkspace();state.clientTab=tab;$$('[data-client-tab]').forEach(b=>b.classList.toggle('active',b.dataset.clientTab===tab));(tab==='goals'?coachCoachingGoals:coachCoachingSupport)();
 }else originalCoachingWorkspace();};
const originalRenderCoachingClient=renderClient;
renderClient=function(){
 if(state.clientView==='support'&&(state.preview||(state.client?.onboarding_status==='complete'&&state.client?.plan_status==='published'))){$('#clientNav').classList.remove('hidden');clientCoachingSupport();$$('#clientNav button').forEach(b=>b.classList.toggle('active',b.dataset.clientView==='support'));}else originalRenderCoachingClient();
};
const originalCoachingPlanner=clientPlanner;
clientPlanner=function(){originalCoachingPlanner();if(!currentWeek()?.published&&!state.preview)return;
 const week=currentWeek(),panel=document.createElement('div');panel.innerHTML=`${week?.coach_note?`<section class="panel coach-note"><h3>This week’s priorities</h3><p>${esc(week.coach_note)}</p></section>`:''}${clientScheduleMarkup()}${clientManualStepsMarkup()}${coachingGoalsMarkup()}`;$('#clientMain').append(panel);bindClientScheduling();$('.planner-adherence')?.insertAdjacentHTML('beforebegin','<button class="btn primary cw-arrange" id="cwArrangeWeek">Arrange my week</button>');$('#cwArrangeWeek').onclick=()=>$('#cwTimingPanel')?.scrollIntoView({behavior:'smooth',block:'start'});bindManualSteps();
 $$('[data-open-session]').forEach(button=>{const session=state.data.sessions.find(s=>s.id===button.dataset.openSession);if(session?.scheduled_time)button.insertAdjacentHTML('beforebegin',`<small class="cw-session-time">${esc(session.scheduled_time.slice(0,5))} · ${esc(session.schedule_timezone)}</small>`);});
};
const originalCoachingProgress=clientProgress;
clientProgress=function(){originalCoachingProgress();$('#clientMain').insertAdjacentHTML('afterbegin',healthSummaryMarkup()+coachingGoalsMarkup());};
const originalCoachingCheckin=clientCheckin;
clientCheckin=function(){originalCoachingCheckin();const form=$('#checkinForm');form.querySelector('.checkin-grid').insertAdjacentHTML('beforeend',`<label class="field">Week beginning (Monday)<input name="period_start" type="date" value="${iso(monday())}" max="${iso(monday())}" required></label><label class="field">Average sleep hours<input name="sleep_hours" type="number" min="0" max="24" step=".1"></label>`);form.querySelector('.checkin-sliders').insertAdjacentHTML('beforeend',slider('workload','Workload pressure',5,true));form.querySelector('[name="support_needed"]').closest('label').insertAdjacentHTML('beforebegin',`<label class="field wide">How did deadlines, travel or meetings change your plan?<textarea name="busy_week" rows="2"></textarea></label><label class="field wide">What training windows are realistic next week?<textarea name="next_week_availability" rows="2"></textarea></label>`);const output=form.querySelector('[data-slider-output="workload"]');form.workload.oninput=()=>output.textContent=form.workload.value;
 const sleep=recordedAverage(recentHealthRows(),'sleep_minutes');if(sleep!==null)form.sleep_hours.value=(sleep/60).toFixed(1);
 form.onsubmit=submitAtomicCoachingCheckin;
};
async function submitAtomicCoachingCheckin(event){
 event.preventDefault();const fd=new FormData(event.target),answers={},clientId=state.client.id;
 for(const[key,value]of fd){if(key.startsWith('photo_')||key==='weight_display')continue;answers[key]=value===''?null:value;}
 if(fd.get('weight_display'))answers.weight_kg=Number(fd.get('weight_display'))/(state.client.weight_unit==='lbs'?2.2046226218:1);
 const period=answers.period_start;if(!period||new Date(period+'T12:00:00').getDay()!==1)return toast('Choose the Monday for this check-in','error');
 const photos=['front','side','back'].map(view=>({view,file:fd.get('photo_'+view)})).filter(x=>x.file instanceof File&&x.file.size);
 if(photos.some(x=>x.file.size>10*1024*1024))return toast('Each photo must be under 10 MB','error');
 setBusy(event.submitter,true,'Saving…');let saved=null;
 try{
 const result=state.preview?{checkin:{...answers,id:'sample-checkin-'+Date.now(),client_id:clientId,submitted_at:new Date().toISOString()},already_submitted:state.data.checkins.some(c=>c.period_start===period)}:await query('Weekly check-in and progress',db.rpc('submit_client_checkin',{target_client_id:clientId,answers}));
 saved=result.checkin;if(!saved?.id)throw new Error('Check-in response incomplete');if(state.client.id!==clientId)return;
 if(!result.already_submitted){state.data.checkins.unshift(saved);if(result.progress){const index=state.data.progress.findIndex(p=>p.id===result.progress.id);if(index>=0)state.data.progress[index]=result.progress;else state.data.progress.unshift(result.progress);}for(const photo of photos){if(!state.preview)await storeProgressPhoto(photo.file,photo.view,Number(answers.week_number)||null,saved.id);}}
 toast(result.already_submitted?'This week was already submitted; no duplicate saved':state.preview?'Sample check-in saved locally':'Check-in and progress saved together');clientCheckin();
 }catch(error){toast(saved?'Check-in saved; photo upload failed: '+error.message:error.message,'error');setBusy(event.submitter,false);}
}
document.addEventListener('DOMContentLoaded',()=>{
 const nav=$('#clientNav');if(nav&&!nav.querySelector('[data-client-view="support"]')){nav.insertAdjacentHTML('beforeend','<button data-client-view="support"><span>◎</span>Coaching</button>');nav.querySelector('[data-client-view="support"]').onclick=()=>{state.clientView='support';renderClient();};}
});
function fullCoachingSample(index=0){
 const data=demoData(),start=monday(),date=n=>iso(new Date(+start+n*864e5));
 data.weeks[0].coach_note='Aim for two strength sessions and one easy cardio session. Move the days around your diary. If a deadline removes a training window, use the agreed short session and flag it in your check-in.';
 const prescriptions=[['Strength A','weights',0,[['Goblet squat',3,'8–12',90],['Seated cable row',3,'10–12',75],['Incline push-up',3,'8–12',60]]],['Strength B','weights',3,[['Dumbbell split squat',3,'8 each side',90],['Lat pulldown',3,'10–12',75],['Dumbbell shoulder press',2,'8–12',75]]],['Comfortable cardio','cardio',5,[['Brisk walk',1,'25 minutes at a conversational pace',0]]],['Mobility reset','mobility',1,[['Hip flexor stretch',2,'30 seconds each side',15],['Thoracic rotation',2,'6 each side',15]]]];
 data.programs=[{id:'sample-program',name:'Sample individual programme',status:'active',days:prescriptions.map(([title,type,day,exercises],i)=>({id:'sample-day-'+i,program_id:'sample-program',title,training_type:type,day_index:day,coach_notes:'Illustrative prescription. A real programme requires your equipment, experience and health limitations.',exercises:exercises.map(([name,sets,reps,rest],j)=>({id:'sample-exercise-'+i+'-'+j,program_day_id:'sample-day-'+i,name,sets,reps,rest_seconds:rest,sort_order:j,rpe:type==='weights'?7:null,coach_instructions:'Use a comfortable range. Stop if painful and contact your coach.',video_url:null}))}))}];
 data.exercises=data.programs[0].days.flatMap(d=>d.exercises);
 data.sessions=prescriptions.map(([title,type,day],i)=>({id:'sample-session-'+i,week_id:'demo-week',programme_day_id:'sample-day-'+i,session_date:date(day),training_type:type,title,status:'planned',duration_minutes:type==='weights'?35:type==='cardio'?25:8,scheduled_time:type==='weights'?'07:00:00':null,schedule_timezone:'America/New_York'}));
 const meal=(name,type,ingredients,method)=>({name,meal_type:type,ingredients:ingredients.map(([name,quantity,unit='g'])=>({name,quantity,unit})),cooking_instructions:method});
 const breakfasts=[meal('Yogurt, oats & berries','breakfast',[['Greek yogurt',200],['Oats',50],['Berries',100]],'1. Spoon yogurt into a bowl.\n2. Mix in oats.\n3. Add berries and serve, or refrigerate overnight.'),meal('Eggs & wholegrain toast','breakfast',[['Eggs',2,'count'],['Wholegrain bread',80],['Tomatoes',100]],'1. Toast the bread.\n2. Cook eggs thoroughly in a non-stick pan.\n3. Serve with sliced tomatoes.'),meal('Overnight oats','breakfast',[['Oats',60],['Milk',180,'ml'],['Greek yogurt',150],['Banana',100]],'1. Mix oats, milk and yogurt in a container.\n2. Refrigerate overnight.\n3. Add sliced banana before eating.')];
 const lunchNames=['Chicken rice box','Turkey wrap','Chickpea couscous bowl','Chicken potato bowl','Tuna rice bowl','Tofu noodle box','Egg & bean wrap'];
 const lunchProteins=[['Cooked chicken',150],['Cooked turkey',150],['Cooked chickpeas',200],['Cooked chicken',150],['Drained tuna',150],['Firm tofu',180],['Cooked beans',180]];
 const lunchCarbs=[['Cooked rice',180],['Wholegrain wrap',80],['Cooked couscous',180],['Cooked potatoes',250],['Cooked rice',180],['Cooked noodles',180],['Wholegrain wrap',80]];
 const dinnerNames=['Salmon, potatoes & greens','Chicken pasta','Turkey rice skillet','Tofu rice bowl','White fish & potatoes','Chickpea pasta','Chicken couscous'];
 const dinnerProteins=[['Salmon',150],['Chicken breast',150],['Turkey mince',150],['Firm tofu',200],['White fish',180],['Cooked chickpeas',200],['Chicken breast',150]];
 const dinnerCarbs=[['Potatoes',250],['Dry pasta',75],['Cooked rice',180],['Cooked rice',180],['Potatoes',250],['Dry pasta',75],['Cooked couscous',180]];
 data.nutritionPlans=[];data.mealAssignments=[];data.nutritionDays=[];
 for(let i=0;i<7;i++){
 const plan={id:'sample-menu-'+i,name:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i]+' menu',day_type:data.sessions.some(s=>s.session_date===date(i)&&['weights','cardio'].includes(s.training_type))?'Training Day':'Rest Day',weekday_index:i,is_active:true,days_per_week:1,coach_notes:'Fictional menu for review. Portions and food choices must be adjusted to a real participant’s goals, allergies and requirements; these are not automatically calculated targets.'};
 data.nutritionPlans.push(plan);data.nutritionDays.push({id:'sample-nutrition-'+i,week_id:'demo-week',nutrition_date:date(i),nutrition_plan_id:plan.id,adhered:false});
 const lunch=meal(lunchNames[i],'lunch',[lunchProteins[i],lunchCarbs[i],['Mixed vegetables',150],['Olive oil',10]],'1. Use the listed cooked protein and cooked carbohydrate, except wraps which are ready to use.\n2. Wash or cook the vegetables.\n3. Combine in a bowl or wrap and add olive oil.\n4. Chill promptly if preparing ahead; reheat cooked food thoroughly when needed.');
 const dinner=meal(dinnerNames[i],'dinner',[dinnerProteins[i],dinnerCarbs[i],['Green vegetables',150],['Olive oil',10]],'1. Cook the protein thoroughly, following safe handling instructions for the food.\n2. Cook potatoes or dry pasta until ready; use the listed cooked portion for rice or couscous.\n3. Steam the vegetables.\n4. Serve with olive oil.');
 [breakfasts[i%3],lunch,dinner].forEach((item,j)=>{const id='sample-meal-'+i+'-'+j;data.mealAssignments.push({id:'sample-assignment-'+i+'-'+j,nutrition_plan_id:plan.id,client_id:'sample-client-'+index,meal_id:id,sort_order:j,historical:false,meal:{...item,id}});});
 }
 data.coachingGoals=[{id:'sample-goal-1',title:'Complete two strength sessions this week',metric:'weekly_sessions',baseline:0,target:2,unit:'sessions',target_date:date(6),reason:'Keep a manageable training rhythm during office weeks.',status:'active'},{id:'sample-goal-2',title:'Build daily movement',metric:'steps',baseline:4500,target:7000,unit:'steps / day',target_date:date(6),reason:'Use two short walking breaks around meetings.',status:'active'}];
 data.coachingCalls=[{id:'sample-call',title:'Monthly coaching review · sample',scheduled_at:new Date(date(4)+'T14:00:00Z').toISOString(),duration_minutes:30,status:'scheduled',recap:'Review the next month’s workload, exercise progression and food routine. No real meeting is booked.'}];
 data.coachingGuidance=[{id:'sample-guidance-1',category:'busy_week',title:'When a deadline removes your gym window',body:'Tell your coach which sessions are affected. Move one strength day to an available morning using the planner. The agreed short option is two sets of the three prescribed main movements, with the same rest periods. Do not double up missed sessions. Keep a portable lunch prepared for the longest office day.',published:true,ingredients:[]},{id:'sample-guidance-2',category:'eating_out',title:'Lunch when you cannot bring food',body:'Three example options to discuss with your coach: a grilled chicken rice bowl with vegetables and sauce on the side; a turkey sandwich with fruit; or a bean-and-rice bowl with vegetables. Check allergens and dietary restrictions with the venue. Restaurant portions are estimates, not weighed equivalents to your home plan.',published:true,ingredients:[]},{id:'sample-guidance-3',category:'meal_example',title:'A portable yogurt lunch add-on',body:'Combine in a sealable bowl and refrigerate. Use only if it fits the person’s dietary restrictions. This fictional example is not a substitution automatically added to their daily menu.',published:true,ingredients:[{name:'Greek yogurt',quantity:200,unit:'g'},{name:'Oats',quantity:40,unit:'g'},{name:'Berries',quantity:100,unit:'g'}]}];
 data.healthDaily=[];data.healthConnections=[];return data;
}
function startFullCoachingDemo(){
 const index=Math.min(9,Math.max(0,Number(new URLSearchParams(location.search).get('person'))||0));
 state.preview=true;state.role='coach';state.client=normalizeClient({id:'sample-client-'+index,display_name:pilotPeople[index][0]+' · sample',status:'active',weight_unit:'lbs',start_weight_kg:84,goal_weight_kg:80,daily_steps_goal:7000,cardio_enabled:true,mobility_enabled:true,checkin_day:4,track_weight:true,onboarding_status:'complete',plan_status:'published',profile_id:'sample-profile',market_region:'us'});state.clients=[state.client];state.data=fullCoachingSample(index);state.clientTab='planner';state.coachView='clients';state.clientView='planner';state.selectedNutritionPlanId=null;
 $('#coachName').textContent='Calum · full coaching example';show('#coachApp');renderCoach();
 const banner=document.createElement('div');banner.className='cw-demo-banner';banner.innerHTML='FULL COACHING WORKSPACE · FICTIONAL DATA · CHANGES RESET ON RELOAD <a href="?pilot=demo">Back to firm preview</a>';document.body.prepend(banner);
}
if(new URLSearchParams(location.search).get('workspace')==='demo')document.addEventListener('DOMContentLoaded',startFullCoachingDemo,{once:true});

function slider(name,label,value=5,highIsHard=false){
 return `<label class="field checkin-rating"><span>${esc(label)} <output data-slider-output="${esc(name)}">${value}</output> / 10</span><input name="${esc(name)}" type="range" min="1" max="10" step="1" value="${value}" aria-label="${esc(label)} rating"><small>1 ${highIsHard?'low':'poor'} · 10 ${highIsHard?'high':'excellent'}</small></label>`;
}

function clientManualStepsMarkup(){
 return `<section class="panel"><h3>Record your actual steps</h3><p>If you do not use a connected tracker, record the count shown on your phone or watch.</p><form id="cwStepsForm" class="editor-grid"><label>Date<input name="entry_date" type="date" value="${iso(new Date())}" max="${iso(new Date())}" required></label><label>Actual steps<input name="actual_steps" type="number" min="0" max="100000" step="1" required></label><button class="btn primary">Save step count</button></form></section>`;
}
function bindManualSteps(){
 $('#cwStepsForm').onsubmit=async event=>{event.preventDefault();const fd=new FormData(event.target),clientId=state.client.id,row={client_id:clientId,entry_date:fd.get('entry_date'),actual_steps:Number(fd.get('actual_steps')),target_steps:safeStepGoal()};setBusy(event.submitter,true);try{const saved=state.preview?{...row,id:'sample-steps-'+Date.now()}:(await query('Actual step count',db.from('step_entries').upsert(row,{onConflict:'client_id,entry_date'}).select()))[0];if(!saved)throw new Error('Steps were not saved');if(state.client.id!==clientId)return;const old=state.data.steps.find(s=>s.entry_date===saved.entry_date);if(old)Object.assign(old,saved);else state.data.steps.unshift(saved);clientPlanner();toast(state.preview?'Sample step count updated':'Actual step count saved');}catch(error){toast(error.message,'error');setBusy(event.submitter,false);}};
}

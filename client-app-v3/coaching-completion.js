/* Complete daily coaching workflows without copying prescribed work into actual logs. */
function workoutSetRows(exercise,session,formData,client){
 if(!session||!exercise)throw Error('Open an assigned workout first.');
 const value=(name)=>{const raw=formData.get(name);if(raw===null||raw==='')return null;const n=Number(raw);if(!Number.isFinite(n)||n<0)throw Error('Use a valid non-negative number.');return n;};
 return Array.from({length:Math.max(1,Number(exercise.sets||1))},(_,i)=>{const set=i+1,reps=value('reps_'+set),load=value('load_'+set),rir=value('rir_'+set),duration=value('duration_'+set);if(reps!==null&&!Number.isInteger(reps))throw Error('Reps must be whole numbers.');if(duration!==null&&(!Number.isInteger(duration)||duration<1||duration>86400))throw Error('Enter actual seconds from 1 to 86400.');if(rir!==null&&rir>10)throw Error('RIR must be between zero and ten.');return {client_id:client.id,training_session_id:session.id,program_exercise_id:exercise.id,exercise_bank_id:exercise.exercise_bank_id||null,performed_at:new Date().toISOString(),set_number:set,reps,load,load_unit:client.weight_unit==='lbs'?'lb':'kg',rir,duration_seconds:duration,completed:reps!==null||load!==null||duration!==null};}).filter(r=>r.completed);
}
saveExerciseLog=async function(event){
 event.preventDefault();const client=state.client,session=state.data.sessions.find(s=>s.id===state.selectedSessionId),exercise=state.data.exercises.find(e=>e.id===event.target.dataset.exerciseLog);let rows;
 try{if(!session||!exercisesForSession(session).some(e=>e.id===exercise?.id))throw Error('This exercise is not part of the selected workout.');rows=workoutSetRows(exercise,session,new FormData(event.target),client);if(!rows.length)throw Error('Enter your actual reps or seconds before saving.');}catch(e){return toast(e.message,'error');}
 setBusy(event.submitter,true);
 try{const saved=state.preview?rows.map(r=>({...r,id:'sample-'+session.id+'-'+exercise.id+'-'+r.set_number})):await query('Save workout sets',db.from('exercise_set_logs').upsert(rows,{onConflict:'client_id,training_session_id,program_exercise_id,set_number'}).select());if(state.client?.id!==client.id)return;const keys=new Set(saved.map(r=>r.training_session_id+'|'+r.program_exercise_id+'|'+r.set_number));state.data.exerciseLogs=[...saved,...state.data.exerciseLogs.filter(r=>!keys.has(r.training_session_id+'|'+r.program_exercise_id+'|'+r.set_number))];toast(state.preview?'Actual sample sets saved':'Workout sets saved');clientTraining();}catch(e){toast(e.message,'error');}finally{setBusy(event.submitter,false);}
};
const completionExerciseCard=exerciseCard;
exerciseCard=function(ex,loggable=false){
 let html=completionExerciseCard(ex,loggable),mode=exerciseTrackingMode(ex);
 if(mode==='completion'&&typeof rpDemoForExercise==='function'){const demo=rpDemoForExercise(ex);if(demo)html=html.replace('</article>',rpDemoMarkup(demo)+'</article>');else if(typeof safeMediaUrl==='function'&&safeMediaUrl(ex.video_url||ex.bank?.video_url))html=html.replace('</article>',`<a class="btn ghost small" href="${esc(ex.video_url||ex.bank.video_url)}" target="_blank" rel="noopener noreferrer">Watch coach video ↗</a></article>`);}
 if(loggable&&mode==='duration'&&!/breaths/i.test(ex.reps||'')){
  html=html.replace('<span>REPS</span>','<span>TIME</span>').replace(/<p class="previous">[\s\S]*?<\/p><details class="exercise-history">[\s\S]*?<\/details>/,'');
  const logs=(state.data.exerciseLogs||[]).filter(l=>l.training_session_id===state.selectedSessionId&&l.program_exercise_id===ex.id);
  const form='<details><summary>Log my timed sets</summary><form class="set-log" data-exercise-log="'+esc(ex.id)+'">'+Array.from({length:Math.max(1,Number(ex.sets||1))},(_,i)=>'<div class="set-log-row"><b>Set '+(i+1)+'</b><label>Actual seconds<input name="duration_'+(i+1)+'" type="number" min="1" max="86400" step="1" value="'+(logs.find(r=>r.set_number===i+1)?.duration_seconds??'')+'"></label></div>').join('')+'<button class="btn primary small">Save timed sets</button></form></details>';
  const history=(state.data.exerciseLogs||[]).filter(l=>l.program_exercise_id===ex.id&&finiteRecorded(l.duration_seconds)).slice(0,12);
  return html.replace('</article>',form+(history.length?'<details><summary>Timed exercise history</summary>'+history.map(r=>'<p>'+esc(fmt(r.performed_at))+' · Set '+r.set_number+': '+r.duration_seconds+' seconds</p>').join('')+'</details>':'')+'</article>');
 }
 if(!loggable||mode!=='reps')return html;
 const sessionId=state.selectedSessionId,logs=(state.data.exerciseLogs||[]).filter(l=>l.training_session_id===sessionId&&l.program_exercise_id===ex.id);
 html=html.replace(/name="(reps|load|rir)_(\d+)"([^>]*?)value="[^"]*"/g,(all,field,set,attrs)=>{const row=logs.find(r=>r.set_number===Number(set));let n=row?.[field];if(field==='load'&&finiteRecorded(n)&&row.load_unit!==(state.client.weight_unit==='lbs'?'lb':'kg'))n=(Number(n)*(row.load_unit==='lb'?1/2.2046226218:2.2046226218)).toFixed(1);return 'name="'+field+'_'+set+'"'+attrs+'value="'+(n??'')+'"';});
 if(!finiteRecorded(ex.rir))html=html.replace(/<label>RIR<input[^>]*><\/label>/g,'');
 if(/dumbbell|\bdb\b/i.test(ex.name))html=html.replace('<form class="set-log"','<p class="muted">Load is the combined weight when using two dumbbells: 2 × 20 = 40. For one dumbbell, enter its weight. Use '+(state.client.weight_unit==='lbs'?'lb':'kg')+'.</p><form class="set-log"');
 return html;
};
function checkinWeekChoices(){const now=iso(monday()),date=new Date(now+'T12:00:00');const past=Array.from({length:52},(_,i)=>iso(new Date(+date-i*7*86400000))).filter(d=>!state.client.start_date||d>=state.client.start_date);return [...new Set([now,...past,...state.data.weeks.filter(w=>w.week_start<=now).map(w=>w.week_start)])].sort().reverse();}
const completionCheckin=clientCheckin;
clientCheckin=function(){
 completionCheckin();const host=$('#clientMain'),weeks=checkinWeekChoices(),selected=state.checkinWeek||iso(monday());
 host.insertAdjacentHTML('afterbegin','<section class="panel"><label>Week to review<select id="checkinWeekChoice">'+weeks.map(d=>'<option value="'+d+'" '+(d===selected?'selected':'')+'>Week beginning '+esc(fmt(d))+'</option>').join('')+'</select></label></section>');
 $('#checkinWeekChoice').onchange=e=>{state.checkinWeek=e.target.value;clientCheckin();};
 if(selected===iso(monday()))return;
 const record=state.data.checkins.find(c=>c.period_start===selected);
 if(record){host.innerHTML='<section class="panel"><button id="checkinChooseAnother" class="btn ghost">Choose another week</button><h2>Week beginning '+esc(fmt(selected))+'</h2>'+checkinCard(record)+'</section>';$('#checkinChooseAnother').onclick=()=>{state.checkinWeek=null;clientCheckin();};return;}
 // Reuse the established staged form for an unsubmitted past week, without current-week readings.
 const current=state.data.checkins,now=iso(monday());state.data.checkins=current.filter(c=>c.period_start!==now);completionCheckin();state.data.checkins=current;
 host.insertAdjacentHTML('afterbegin','<section class="panel"><h2>Missed check-in · '+esc(fmt(selected))+'</h2><p>Your answers will be saved against this week.</p><button id="checkinChooseAnother" class="btn ghost">Choose another week</button></section>');$('#checkinChooseAnother').onclick=()=>{state.checkinWeek=null;clientCheckin();};
 const form=$('#checkinForm');form.elements.namedItem('period_start').value=selected;form.elements.namedItem('week_number').value=state.data.weeks.find(w=>w.week_start===selected)?.week_number||1;form.querySelector('[name="average_steps"]')?.remove();form.querySelector('.refresh-connected')?.remove();
};
const completionCoachNutrition=coachNutrition;
coachNutrition=function(){
 completionCoachNutrition();const form=$('#refreshTargetForm');if(!form)return;
 const metric=state.client.weight_unit==='kg',record=state.data.onboarding.find(r=>r.client_id===state.client.id),sections=legacyIntakeSections(record),answers=Object.assign({},...Object.values(sections||{}).filter(v=>v&&typeof v==='object'));
 const lookup=(...keys)=>{for(const [k,v]of Object.entries(answers)){if(keys.includes(k.toLowerCase().replace(/[^a-z0-9]/g,''))){const match=String(v).match(/^\s*(\d+(?:\.\d+)?)\s*(?:cm|years?|yrs?)?\s*$/i);if(match)return Number(match[1]);}}return null;};
 form.elements.namedItem('weight').closest('label').firstChild.textContent='Current weight ('+(metric?'kg':'lb')+')';form.elements.namedItem('height').closest('label').firstChild.textContent='Height ('+(metric?'cm':'inches')+')';
 const latest=[...state.data.progress].filter(p=>finiteRecorded(p.weight_kg)).sort((a,b)=>String(b.entry_date).localeCompare(String(a.entry_date)))[0]?.weight_kg;
 const kg=latest??state.client.start_weight_kg,cm=lookup('heightcm','height'),age=lookup('age');if(finiteRecorded(kg))form.weight.value=(Number(kg)*(metric?1:2.2046226218)).toFixed(1);if(cm)form.height.value=(cm/(metric?1:2.54)).toFixed(1);if(age)form.age.value=age;
 form.insertAdjacentHTML('afterbegin','<p class="muted wide">Saved measurements are prefilled where available. Confirm they are current before calculating.</p>');
 const old=form.onsubmit;form.onsubmit=e=>{const w=form.weight.value,h=form.height.value;if(metric){form.weight.value=Number(w)*2.2046226218;form.height.value=Number(h)/2.54;}try{old(e);}finally{form.weight.value=w;form.height.value=h;}};
};
const completionPrompt=nutritionImportPrompt;
nutritionImportPrompt=function(){const prompt=completionPrompt();return state.client?.weight_unit==='kg'?prompt.replace('using US ounces, cups, teaspoons, tablespoons and whole-food counts','using grams, millilitres and whole-food counts; distinguish raw, dry and cooked amounts'):prompt;};
const completionOnboarding=coachOnboarding;
coachOnboarding=function(){
 completionOnboarding();const record=state.data.onboarding.find(r=>r.client_id===state.client.id);if(!record)return;
 const sections=legacyIntakeSections(record),fields=[];
 for(const [section,answers]of Object.entries(sections||{})){if(!answers||typeof answers!=='object'||Array.isArray(answers))continue;for(const [key,value]of Object.entries(answers)){if(value!==null&&typeof value==='object')continue;fields.push({section,key,value});}}
 if(!fields.length)return;
 $('#clientWorkspaceBody').insertAdjacentHTML('beforeend','<details class="panel"><summary>Edit coaching profile</summary><p>Saved answers stay attached to this client. The original imported text is retained.</p><form id="completionProfile" class="editor-grid">'+fields.map((f,i)=>'<label>'+esc(title(f.section)+' · '+f.key.replaceAll('_',' '))+'<textarea name="answer_'+i+'" rows="2">'+esc(f.value??'')+'</textarea></label>').join('')+'<button class="btn primary wide">Save profile changes</button></form></details>');
 $('#completionProfile').onsubmit=async e=>{e.preventDefault();const id=state.client.id,fd=new FormData(e.target),edited=JSON.parse(JSON.stringify(sections));for(let i=0;i<fields.length;i++)edited[fields[i].section][fields[i].key]=fd.get('answer_'+i);const responses={...record.responses,sections:edited};setBusy(e.submitter,true);try{const saved=state.preview?{...record,responses}:(await query('Save client profile',db.from('onboarding_responses').update({responses}).eq('id',record.id).eq('client_id',id).select()))[0];if(!saved)throw Error('The profile was not saved.');if(state.client?.id!==id)return;state.data.onboarding=state.data.onboarding.map(r=>r.id===record.id?saved:r);toast('Profile saved');coachOnboarding();}catch(err){toast(err.message,'error');}finally{setBusy(e.submitter,false);}};
};
const completionLoadClient=loadClientData;
loadClientData=async function(id){if(state.client?.id!==id||integrityLoadedClient!==id)state.checkinWeek=null;return completionLoadClient(id);};
function nutritionTargetPatch(formData,plan){
 const patch={name:String(formData.get('name')||'').trim(),day_type:String(formData.get('day_type')||plan.day_type),days_per_week:Number(formData.get('days_per_week'))};
 if(!patch.name||!['Training Day','Rest Day','Busy Day'].includes(patch.day_type)||!Number.isInteger(patch.days_per_week)||patch.days_per_week<0||patch.days_per_week>7)throw Error('Check the menu name, day type and days per week.');
 for(const key of ['calories','protein_g','carbs_g','fat_g']){const raw=formData.get(key);if(raw===null||raw===''||!Number.isFinite(Number(raw))||Number(raw)<0)throw Error('Enter all four nutrition targets.');patch[key]=Number(raw);}return patch;
}
saveNutritionTargets=async function(event){
 event.preventDefault();const clientId=state.client.id,plan=state.data.nutritionPlans.find(p=>p.id===event.target.dataset.planEditor);let patch;
 try{if(!plan)throw Error('Menu not found.');patch=nutritionTargetPatch(new FormData(event.target),plan);}catch(e){return toast(e.message,'error');}
 setBusy(event.submitter,true);
 try{const saved=state.preview?{...plan,...patch}:await query('Save menu and planner targets',db.rpc('save_client_nutrition_plan',{p_client:clientId,p_plan:plan.id,p_values:patch}));if(state.client?.id!==clientId)return;Object.assign(plan,saved);for(const d of state.data.nutritionDays)if(d.nutrition_plan_id===plan.id&&!d.adhered&&d.nutrition_date>=iso(new Date()))Object.assign(d,{calorie_target:plan.calories,protein_target_g:plan.protein_g,carbs_target_g:plan.carbs_g,fat_target_g:plan.fat_g});toast(state.preview?'Sample menu targets saved':'Menu and upcoming planner targets saved');coachNutrition();}catch(e){toast(e.message,'error');}finally{setBusy(event.submitter,false);}
};
// Applying a calculated draft uses the selected menu's existing safe save workflow.
const completionCalculatorRender=coachNutrition;
coachNutrition=function(){
 completionCalculatorRender();const f=$('#refreshTargetForm');if(!f)return;const metric=state.client.weight_unit==='kg',clientId=state.client.id;
 f.onsubmit=e=>{e.preventDefault();try{const fd=new FormData(f),t=estimatedNutritionTargets({weightKg:Number(fd.get('weight'))/(metric?1:2.2046226218),heightCm:Number(fd.get('height'))*(metric?1:2.54),age:Number(fd.get('age')),sex:fd.get('sex'),factor:Number(fd.get('factor')),adjustment:Number(fd.get('adjustment')),proteinPerKg:Number(fd.get('protein'))});$('#refreshTargetResult').innerHTML='<p><b>'+t.calorie_goal+' kcal</b> · Protein '+t.protein_goal_g+' g · Carbs '+t.carbs_goal_g+' g · Fat '+t.fat_goal_g+' g</p><button class="btn primary" id="completionUseTargets">Approve & save to this menu</button><p class="muted">Saves the selected menu and its upcoming planner targets. Ingredient portions still need to match these targets.</p>';$('#completionUseTargets').onclick=()=>{if(state.client?.id!==clientId)return;const editor=$('[data-plan-editor="'+state.selectedNutritionPlanId+'"]');if(!editor)return toast('Create a menu before applying targets.','error');for(const [field,key]of [['calories','calorie_goal'],['protein_g','protein_goal_g'],['carbs_g','carbs_goal_g'],['fat_g','fat_goal_g']])editor.elements.namedItem(field).value=t[key];editor.requestSubmit();};}catch(err){toast(err.message,'error');}};
};

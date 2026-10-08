/* Session-specific alternatives preserve the coach's programme and actual history. */
const equipmentAlternatives=[
 {names:['Flat Machine Press or Flat Dumbbell Press','Dumbbell bench press','Flat dumbbell bench press','Seated Machine Chest Press'],options:['Flat dumbbell bench press','Machine chest press']},
 {names:['Chest Supported Row','Chest Supported Dumbbell Row','Chest-Supported Dumbbell Row'],options:['Chest Supported Dumbbell Row','Machine chest-supported row']},
 {names:['Seated DB Shoulder Press','Seated Dumbbell Shoulder Press','Dumbbell Shoulder Press','Shoulder Press Machine','Seated Machine Shoulder Press'],options:['Seated dumbbell shoulder press','Shoulder Press Machine']},
 {names:['Seated DB Bicep Curl','Seated Dumbbell Bicep Curl','Dumbbell Bicep Curl'],options:['Seated Dumbbell Bicep Curl','Dumbbell Bicep Curl']},
 {names:['Pull-Ups or Assisted Pull-Ups'],options:['Normal-grip pull-up','Band-Assisted Pull-Up']},
 {names:['DB Flat press'],options:['Flat dumbbell bench press','Machine chest press']},
 {names:['Chest-Supported T-Bar Row','Cable Row','Seated Cable Row'],options:['Seated cable row','Chest Supported Dumbbell Row']},
 {names:['Dumbbell Lateral Raise','Cable Lateral Raise','Seated DB Lateral Raise'],options:['Dumbbell lateral raise','Cable lateral raise']},
 {names:['Cable Triceps Pressdown','Tricep Cable Pushdown','Tricep Cable Pushdowns','Tricep Rope Pushdown','Cable triceps pushdown'],options:['Cable triceps pushdown','Dumbbell Overhead Triceps Extension']},
 {names:['Dumbbell Hammer Curl','Cable Hammer Curl'],options:['Dumbbell hammer curl','Cable Hammer Curl']},
 {names:['Seated Hamstring Curl','Seated Leg Curl','Lying Leg Curl'],options:['Seated leg curl','Lying leg curl']},
 {names:['Incline Dumbbell Press','Incline Dumbbell Bench Press','Smith Machine Incline Press'],options:['Incline dumbbell press','Smith machine incline press']},
 {names:['Standing Calf Raises','Standing Dumbbell Calf Raise','Calf Raises'],options:['Standing Dumbbell Calf Raise','Calf raise machine']},
 {names:['Preacher Curl Machine'],options:['Preacher curl machine','Seated Dumbbell Bicep Curl']}
];
function approvedExerciseOptions(ex){
 const raw=String(ex.alternatives||'').trim();
 const list=raw?raw.split('|').map(s=>s.trim()).filter(Boolean):state.preview?(equipmentAlternatives.find(g=>g.names.some(n=>n.toLowerCase()===String(ex.name).trim().toLowerCase()))?.options||[]):[];
 return [...new Set([ex.name,...list])].filter(n=>n&&n.length<=160);
}
function currentExerciseChoice(ex,sessionId=state.selectedSessionId){
 const choice=(state.data.exerciseChoices||[]).find(r=>r.client_id===state.client.id&&r.training_session_id===sessionId&&r.program_exercise_id===ex.id);
 return choice?.exercise_name||ex.name;
}
function swapChoiceMarkup(ex){
 const options=approvedExerciseOptions(ex),name=currentExerciseChoice(ex);if(name!==ex.name&&!options.includes(name))options.push(name);if(options.length<2)return '';
 const logged=(state.data.exerciseLogs||[]).some(l=>l.training_session_id===state.selectedSessionId&&l.program_exercise_id===ex.id);
 return `<details class="gym-swap"><summary>Equipment busy? Swap exercise</summary><label>Exercise for this session<select data-exercise-choice="${esc(ex.id)}" ${logged?'disabled':''}>${options.map(n=>`<option value="${esc(n)}" ${name===n?'selected':''}>${esc(n)}</option>`).join('')}</select></label><p class="muted">${logged?'This session already has logged sets. Your recorded exercise stays attached to them.':'Keep the prescribed sets, reps and effort. Choose a comfortable starting weight for the different equipment. This changes only this session.'}</p></details>`;
}
const gymLoadBefore=loadClientData;
loadClientData=async function(id){await gymLoadBefore(id);if(state.client?.id!==id)return;const choices=state.preview?[]:await query('Saved exercise choices',db.from('session_exercise_choices').select('*').eq('client_id',id));if(state.client?.id===id)state.data.exerciseChoices=choices;};
const gymRowsBefore=workoutSetRows;
workoutSetRows=function(ex,session,fd,client){return gymRowsBefore(ex,session,fd,client).map(row=>({...row,exercise_name:currentExerciseChoice(ex,session.id)}));};
const gymCardBefore=exerciseCard;
exerciseCard=function(ex,loggable=false){
 if(!loggable){let html=gymCardBefore(ex,false);const logs=(state.data.exerciseLogs||[]).filter(l=>l.program_exercise_id===ex.id);if(logs.some(l=>l.exercise_name&&l.exercise_name!==ex.name)){html=html.replace(/<p class="previous">[\s\S]*?<\/p><details class="exercise-history">[\s\S]*?<\/details>/,'');html=html.replace('</article>','<details class="exercise-history"><summary>Recorded exercise choices</summary>'+logs.slice(0,12).map(l=>'<p>'+esc(l.exercise_name||ex.name)+' · '+esc(fmt(l.performed_at))+' · Set '+l.set_number+': '+(l.reps??'—')+' reps · '+(l.load??'—')+' '+esc(l.load_unit||'')+'</p>').join('')+'</details></article>');}return html;}
 const name=currentExerciseChoice(ex),swapped=name!==ex.name,logs=state.data.exerciseLogs;
 // Prior weights from a different movement must never become this movement's history.
 state.data.exerciseLogs=(logs||[]).filter(l=>l.program_exercise_id!==ex.id||(l.exercise_name||ex.name)===name);
 let html;try{html=gymCardBefore(swapped?{...ex,name,exercise_bank_id:null,bank:null,video_url:null,image_url:null,coach_instructions:null,notes:null,previous_performance:null}:ex,true);}finally{state.data.exerciseLogs=logs;}
 if(swapped)html=html.replace('<div class="prescription-grid">','<p class="gym-original">Instead of '+esc(ex.name)+' · this session only</p><div class="prescription-grid">');
 return html.replace('</article>',swapChoiceMarkup(ex)+'</article>');
};
const techniqueVideoLinks={
 superset:{label:'Supersets explained',url:'https://www.muscleandstrength.com/videos/how-to-use-supersets-trisets-and-giant-sets'},
 triset:{label:'Tri-sets explained',url:'https://www.muscleandstrength.com/videos/how-to-use-supersets-trisets-and-giant-sets'},
 drop:{label:'Drop sets explained',url:'https://www.muscleandstrength.com/videos/3-intensity-techniques'}
};
function techniqueVideoMarkup(kind){const v=techniqueVideoLinks[kind];return v?`<a class="btn ghost small technique-video-link" href="${v.url}" target="_blank" rel="noopener noreferrer">▶ Watch: ${v.label}</a><small class="technique-source">Muscle & Strength · video explanation</small>`:'';}
const gymTrainingBefore=clientTraining;
clientTraining=function(){
 gymTrainingBefore();const client=state.client,session=state.data.sessions.find(s=>s.id===state.selectedSessionId);if(!session)return;
 const exercises=exercisesForSession(session),groupCards=$$('#clientMain .training-rounds article');
 const groups=[...new Set(exercises.filter(e=>e.superset_group).map(e=>e.superset_group))];
 groupCards.forEach((node,i)=>{const group=exercises.filter(e=>e.superset_group===groups[i]);node.insertAdjacentHTML('beforeend',techniqueVideoMarkup(group[0]?.combination_type==='triset'?'triset':'superset'));const names=node.querySelector('p');if(names)names.textContent=group.map((e,j)=>groups[i]+(j+1)+': '+currentExerciseChoice(e)).join(' → ');});
 $$('#clientMain .technique-note').forEach(node=>node.insertAdjacentHTML('beforeend',techniqueVideoMarkup('drop')));
 $$('[data-exercise-choice]').forEach(select=>select.onchange=async()=>{
  const ex=exercises.find(e=>e.id===select.dataset.exerciseChoice),old=currentExerciseChoice(ex),name=select.value,form=select.closest('.exercise-card')?.querySelector('[data-exercise-log]');
  if(form&&[...form.querySelectorAll('input')].some(input=>input.value!=='')){select.value=old;return toast('Save your entered sets first. Swap an exercise before logging it.','error');}
  if(!approvedExerciseOptions(ex).includes(name)){select.value=old;return;}
  select.disabled=true;
  try{
   const row={client_id:client.id,training_session_id:session.id,program_exercise_id:ex.id,exercise_name:name};
   const saved=state.preview?row:(await query('Save exercise choice',db.from('session_exercise_choices').upsert(row,{onConflict:'client_id,training_session_id,program_exercise_id'}).select()))[0];
   if(!saved)throw Error('The exercise choice was not saved.');if(state.client?.id!==client.id)return;
   state.data.exerciseChoices=[saved,...(state.data.exerciseChoices||[]).filter(r=>!(r.training_session_id===session.id&&r.program_exercise_id===ex.id))];
   if(state.selectedSessionId===session.id&&select.isConnected){clientTraining();toast(state.preview?'Sample exercise switched':'Exercise choice saved');}
  }catch(e){select.value=old;select.disabled=false;toast(e.message,'error');}
 });
};
const gymTodayBefore=clientToday;
clientToday=function(){gymTodayBefore();const form=$('#todayStepForm');if(!form)return;const link=document.createElement('button');link.type='button';link.className='btn ghost';link.textContent='View steps in Schedule';link.onclick=()=>{state.clientView='planner';renderClient();};form.replaceWith(link);};
const gymStepsBefore=clientSteps;
clientSteps=function(){state.clientView='planner';clientPlanner();};
const gymEditorBefore=exerciseEditorMarkup;
exerciseEditorMarkup=function(ex){return gymEditorBefore(ex).replace('</div><div class="editor-actions">',`<label class="wide">Optional equipment alternatives<input name="alternatives" value="${esc(ex.alternatives||'')}" placeholder="Flat dumbbell bench press | Machine chest press"><small>Separate names with |. These appear in the client’s swap menu.</small></label></div><div class="editor-actions">`);};

const gymBuilderBefore=programDayBuilderMarkup;
programDayBuilderMarkup=function(day){return gymBuilderBefore(day).replace('<button class="btn primary small">Add exercise</button>','<label class="wide">Optional equipment alternatives<input name="alternatives" placeholder="Exercise one | Exercise two"></label><button class="btn primary small">Add exercise</button>');};
const gymPromptBefore=trainingPrompt;
trainingPrompt=function(){return gymPromptBefore()+'\nFor each exercise, optionally include alternatives as a string of equipment alternatives separated by |. Use up to six named, appropriate alternatives; respect recorded restrictions, available equipment, movement and training experience. Do not add alternatives that conflict with an injury limitation. Clients can switch before logging a session; original prescriptions remain saved.';};

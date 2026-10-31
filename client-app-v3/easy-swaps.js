/* Suggestions are coach-reviewed, never automatic prescriptions. */
(function(){
 'use strict';
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const groups=[
  {aliases:['Flat Machine Press or Flat Dumbbell Press','DB Flat press'],moves:['Dumbbell bench press','Flat dumbbell bench press','Machine chest press','Barbell bench press','Smith machine flat bench press','Seated Machine Chest Press']},
  {aliases:[],moves:['Incline dumbbell press','Incline Dumbbell Bench Press','Smith Machine Incline Press','Incline barbell bench press','Incline machine chest press']},
  {aliases:['Chest Supported Row','Cable Row','Chest-Supported T-Bar Row'],moves:['Chest Supported Dumbbell Row','Chest-Supported Dumbbell Row','Seated Cable Row','Machine chest-supported row','Chest-supported T-bar row','Single-Arm Dumbbell Row']},
  {aliases:['Pull-Ups or Assisted Pull-Ups'],moves:['Normal-grip pull-up','Band-Assisted Pull-Up','Assisted pull-up machine','Lat pulldown','Neutral-grip lat pulldown']},
  {aliases:['Seated DB Shoulder Press','Dumbbell Shoulder Press'],moves:['Seated Dumbbell Shoulder Press','Shoulder Press Machine','Seated Machine Shoulder Press','Smith machine seated shoulder press','Barbell seated overhead press']},
  {aliases:['Seated DB Lateral Raise','Lateral raises'],moves:['Dumbbell Lateral Raise','Cable Lateral Raise','Machine lateral raise','Seated dumbbell lateral raise','Single-arm cable lateral raise']},
  {aliases:['Seated DB Bicep Curl','Seated Incline Dumbbell Curl'],moves:['Seated Dumbbell Bicep Curl','Dumbbell Bicep Curl','Incline dumbbell curl','Cable biceps curl','Preacher Curl Machine']},
  {aliases:[],moves:['Dumbbell Hammer Curl','Cable Hammer Curl','Rope hammer curl','Cross-body dumbbell hammer curl','Seated dumbbell hammer curl']},
  {aliases:['Cable Triceps Pressdown','Tricep Cable Pushdown','Tricep Cable Pushdowns','Tricep Rope Pushdown'],moves:['Cable triceps pushdown','Rope triceps pushdown','Single-arm cable triceps pushdown','V-bar cable triceps pushdown','Reverse-grip cable triceps pushdown']},
  {aliases:[],moves:['Dumbbell Overhead Triceps Extension','Cable overhead triceps extension','Single-arm cable overhead triceps extension','Single-arm dumbbell overhead triceps extension','EZ-bar overhead triceps extension']},
  {aliases:['Double-Leg Leg Press','Kettlebell Goblet Squat','Goblet Dumbbell Squat','Goblet Squats'],moves:['Leg press','Hack squat machine','Goblet squat','Smith machine squat','Belt squat']},
  {aliases:[],moves:['Dumbbell Bulgarian Split Squat','Smith machine split squat','Supported dumbbell split squat','Rear-foot-elevated split squat','Dumbbell split squat']},
  {aliases:['Walking Dumbbell Lunge','Reverse Lunges'],moves:['Dumbbell reverse lunge','Dumbbell walking lunge','Smith machine reverse lunge','Supported reverse lunge','Dumbbell forward lunge']},
  {aliases:['Seated Hamstring Curl'],moves:['Seated Leg Curl','Lying Leg Curl','Standing single-leg curl machine','Cable leg curl','Single-leg seated leg curl']},
  {aliases:[],moves:['Dumbbell Romanian Deadlift','Barbell Romanian deadlift','Smith machine Romanian deadlift','Cable Romanian deadlift','Kettlebell Romanian deadlift']},
  {aliases:['Standing Calf Raises','Calf Raises'],moves:['Standing Dumbbell Calf Raise','Calf raise machine','Smith machine standing calf raise','Leg-press calf raise','Single-leg standing calf raise']},
  {aliases:[],moves:['Seated Calf Raise','Seated dumbbell calf raise','Smith machine seated calf raise','Single-leg seated calf raise','Seated calf press machine']},
  {aliases:['Glute Bridge with weight'],moves:['Barbell hip thrust','Dumbbell hip thrust','Smith machine hip thrust','Machine hip thrust','Weighted glute bridge']}
 ];
 function suggestions(ex){const key=norm(ex.name),group=groups.find(g=>[...g.aliases,...g.moves].some(n=>norm(n)===key));if(!group)return [];
  const seen=new Set([key]);return group.moves.filter(n=>{const k=norm(n);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,4);
 }
 window.LegalEdgeSwapSuggestions={suggestions};
 const editor=exerciseEditorMarkup;exerciseEditorMarkup=function(ex){const html=editor(ex),options=suggestions(ex);if(!options.length)return html;
  const box='<details class="swap-suggestions"><summary>Choose up to 4 similar strength alternatives</summary><p>Coach review required: check equipment, skill, pain and limitations. Similar training role does not guarantee identical muscle growth. Keep sets/reps/effort appropriate; choose a new starting load.</p>'+options.map(n=>'<label><input type="checkbox" data-swap-suggestion value="'+esc(n)+'">'+esc(n)+'</label>').join('')+'<button type="button" class="btn ghost small" data-use-swaps>Use selected alternatives</button><small>Replaces the alternatives field only. Review it, then Save exercise to publish the choices.</small></details>';
  return html.replace('<div class="editor-actions">',box+'<div class="editor-actions">');
 };
 const training=coachTraining;coachTraining=function(){const result=training();const user=state.user?.id,client=state.client?.id;$('#clientWorkspaceBody')?.querySelectorAll('[data-use-swaps]').forEach(button=>button.onclick=()=>{
  if(state.role!=='coach'||state.user?.id!==user||state.client?.id!==client||!button.isConnected)return;
  const form=button.closest('form'),field=form?.querySelector('[name=alternatives]'),selected=[...form.querySelectorAll('[data-swap-suggestion]:checked')].map(n=>n.value);if(!field||!selected.length)return toast('Select at least one alternative.','error');field.value=selected.slice(0,4).join(' | ');field.dispatchEvent(new Event('input',{bubbles:true}));toast('Alternatives filled. Review and Save exercise.');
 });return result;};
 const swap=swapChoiceMarkup;swapChoiceMarkup=function(ex){const html=swap(ex);return html?html.replace('Equipment busy? Swap exercise','Swap exercise · '+(approvedExerciseOptions(ex).length-1)+' approved options'):('<details class="gym-swap"><summary>Exercise alternatives</summary><p>No coach-approved swaps yet. Ask your coach to add suitable options; do not train through pain.</p></details>');};
 const prompt=trainingPrompt;trainingPrompt=function(){return prompt()+'\nFor resistance exercises, propose 3–4 distinct alternatives with a comparable movement and target-muscle role. Match equipment and limitations; no automatic equivalence or injury-safety claim. Keep mobility, rehabilitation and cardio separate. Coach must review before publishing.';};
})();

/* Client-bound views and clear evidence for imported records. */
let integrityLoadedClient=null;
const integrityLoad=loadClientData;
loadClientData=async function(id){
 if(integrityLoadedClient!==id){state.data=emptyData();state.selectedNutritionPlanId=null;state.selectedNutritionDate=null;state.selectedSessionId=null;state.mealKind=null;state.mealBatchPortions=1;state.progressRange='all';state.foodUnits=state.client?.weight_unit==='kg'?'metric':'us';}
 integrityLoadedClient=null;
 await integrityLoad(id);
 if(state.client?.id!==id)return false;
 integrityLoadedClient=id;return true;
};
function legacyIntakeSections(record){
 if(record?.responses?.sections)return record.responses.sections;
 const text=record?.responses?.text;if(!text)return record?.responses||{};
 const sections={},labels=['TRAINING','NUTRITION','LIFESTYLE'];let group=null,key=null;
 const body=text.slice(text.indexOf('TRAINING\n\n'));
 for(const raw of body.split(/\n/)){const line=raw.trim();if(!line)continue;
  if(labels.includes(line)){group=line.toLowerCase();sections[group]={};key=null;continue;}
  if(!group)continue;
  if(/^[A-Z][A-Z0-9 /()–&?-]+$/.test(line)){key=line;sections[group][key]='';}
  else if(key)sections[group][key]+=(sections[group][key]?' ':'')+line;
 }
 return Object.values(sections).some(x=>Object.keys(x).length)?sections:record.responses;
}
coachOnboarding=function(){
 const record=state.data.onboarding.find(r=>r.client_id===state.client.id);
 $('#clientWorkspaceBody').innerHTML='<section class="panel"><h2>'+esc(state.client.display_name)+' · Coaching profile</h2><p class="muted">'+(record?.source_system?'Imported answers. Unanswered fields remain blank.':'Saved intake answers.')+'</p>'+responseTree(legacyIntakeSections(record))+'</section>';
};
function consentEvidenceMarkup(record){
 const imported=!!record.source_system,snapshot=String(record.visible_content||'').trim(),signed=!!record.signature_name;
 const evidence=imported?'IMPORTED RECORD':signed&&snapshot?'SIGNED SNAPSHOT':'RECORD NEEDS REVIEW';
 return '<section class="panel legal-record"><div class="panel-head"><h3>'+esc(record.document_name||'Legacy coaching consent')+'</h3><span class="pill">'+evidence+'</span></div><dl class="detail-list"><div><dt>Client</dt><dd>'+esc(state.client.display_name)+'</dd></div><div><dt>Accepted by</dt><dd>'+esc(record.signature_name||'Not recorded')+'</dd></div><div><dt>Signature date</dt><dd>'+fmt(record.signature_date||(!imported?record.signed_at:null))+'</dd></div><div><dt>Document version</dt><dd>'+esc(record.document_version||'Not recovered')+'</dd></div></dl>'+(snapshot?'<details open><summary>Document accepted</summary><p style="white-space:pre-wrap">'+esc(snapshot)+'</p></details>':'<p class="source-gap">The original signed document text was not recovered. This imported record is not a verified signed copy.</p>')+'</section>';
}
coachLegal=function(){
 const records=state.data.legal.filter(r=>state.preview&&!r.client_id||r.client_id===state.client.id);
 $('#clientWorkspaceBody').innerHTML='<section class="panel"><h2>'+esc(state.client.display_name)+' · Agreements & privacy</h2><p>Signatures belong to the client who accepted the document. A new signature must be made by that client in their own account.</p></section>'+(records.length?records.map(consentEvidenceMarkup).join(''):'<section class="panel source-gap"><h3>No verified agreement available</h3><p>The incorrect imported record has been removed from this account. Recover the correct signed copy or arrange a new agreement for this client.</p></section>');
};
clientLegal=function(){$('#clientMain').innerHTML=clientHeader('','Agreements & privacy','Your own agreement records.')+(state.data.legal.length?state.data.legal.filter(r=>state.preview&&!r.client_id||r.client_id===state.client.id).map(consentEvidenceMarkup).join(''):'<section class="panel">Your coach is arranging your correct agreement record.</section>');};
const integrityExerciseCard=exerciseCard;
function exerciseTrackingMode(ex){
 const day=state.data.programs.flatMap(p=>p.days||[]).find(d=>d.id===ex.program_day_id);
 if(['mobility','recovery'].includes(day?.training_type)||ex.tracking_type==='completion')return 'completion';
 if(ex.tracking_type==='duration'||/seconds|minutes|breaths|hold/i.test(ex.reps||''))return 'duration';
 return 'reps';
}
exerciseCard=function(ex,loggable=false){
 const mode=exerciseTrackingMode(ex);
 if(mode==='completion')return '<article class="exercise-card"><h3>'+esc(ex.name)+'</h3><p>'+esc(ex.reps||'Move gently through the prescribed range')+'</p><p>'+esc(ex.coach_instructions||ex.notes||'')+'</p><small>Complete the mobility session using the tick above. No rep or weight entry is needed.</small></article>';
 if(mode==='duration')return integrityExerciseCard(ex,false);
 let html=integrityExerciseCard(ex,loggable);
 if(/push.?up|sit.?up|bodyweight|glute bridge|dead bug|bird dog|reverse lunge/i.test(ex.name)){html=html.replace(/<label>Load<input[^>]*><\/label>/g,'').replace(/<label>RIR<input[^>]*><\/label>/g,'');}
 return html;
};
const integrityAssignments=assignedMealsForPlan;
assignedMealsForPlan=function(plan){return integrityAssignments(plan).filter(a=>!a.historical);};
const integrityMealCard=mealCardMarkup;
mealCardMarkup=function(meal,editable=false){
 let html=integrityMealCard(meal,editable);
 if(meal.tags?.includes('generic-nutrition-estimate')){const fibre=(meal.ingredients||[]).reduce((n,i)=>n+Number(i.fibre_g||0),0);html=html.replace('<h4 class="food-heading">','<p class="muted">Estimated nutrition · '+fibre.toFixed(1)+' g fibre. Use package labels for exact brand values.</p><h4 class="food-heading">');}
 return html;
};
const integrityPlan=nutritionPlanMarkup;
nutritionPlanMarkup=function(plan){
 const meals=assignedMealsForPlan(plan).map(a=>a.meal).filter(Boolean);
 const totals=meals.reduce((n,m)=>({k:n.k+Number(m.calories||0),p:n.p+Number(m.protein_g||0),c:n.c+Number(m.carbs_g||0),f:n.f+Number(m.fat_g||0)}),{k:0,p:0,c:0,f:0});
 return (meals.length?'<section class="panel"><h3>Menu totals</h3><p>'+Math.round(totals.k)+' kcal · '+Math.round(totals.p)+' g protein · '+Math.round(totals.c)+' g carbs · '+Math.round(totals.f)+' g fat</p><small>Estimated totals of the listed foods. Daily coaching targets are shown separately below.</small></section>':'')+integrityPlan(plan);
};
// Received data is refreshed without requiring a reload or copying another client's state.
let integrityHealthTimer;
renderWeeklyNutrition=function(){renderWeeklyNutritionMeasured();};
function renderWeeklyNutritionMeasured(){
 const {plans,days,selected,visibleWeek}=weeklyNutritionSelection();
 state.foodUnits=state.foodUnits||(state.client?.weight_unit==='kg'?'metric':'us');
 state.selectedNutritionPlanId=selected?.id||null;
 $('#clientMain').innerHTML=clientHeader('','Your meals','Measured ingredients, preparation and your shopping list.')+
 '<section class="panel nutrition-week"><h3>Your week</h3><div class="nutrition-week-days">'+days.map(day=>'<button data-open-meal-plan="'+esc(day.plan?.id||'')+'" data-meal-date="'+day.date+'" '+(day.plan?'':'disabled')+'><b>'+DAYS[day.dateObject.getDay()].slice(0,3)+'</b><span>'+esc(day.plan?nutritionDayLabel(day.plan):'No menu')+'</span></button>').join('')+'</div></section>'+
 (selected?'<div class="nutrition-day-tabs">'+plans.map(p=>'<button data-integrity-menu="'+p.id+'">'+esc(nutritionDayLabel(p))+'</button>').join('')+'</div><section class="panel"><label>Food measurements<select id="integrityFoodUnits"><option value="metric" '+(state.foodUnits==='metric'?'selected':'')+'>Grams / ml</option><option value="us" '+(state.foodUnits==='us'?'selected':'')+'>Ounces</option></select></label><label>Batch portions<select id="integrityBatch">'+[1,2,3,4,7].map(n=>'<option '+(Number(state.mealBatchPortions||1)===n?'selected':'')+'>'+n+'</option>').join('')+'</select></label></section>'+nutritionPlanMarkup(selected)+integrityShopping(days):'<section class="panel">No meal menu available.</section>');
 $$('[data-integrity-menu]').forEach(b=>b.onclick=()=>{state.selectedNutritionPlanId=b.dataset.integrityMenu;state.selectedNutritionDate=null;renderWeeklyNutritionMeasured();});
 $('#integrityFoodUnits')?.addEventListener('change',e=>{state.foodUnits=e.target.value;renderWeeklyNutritionMeasured();});
 $('#integrityBatch')?.addEventListener('change',e=>{state.mealBatchPortions=Number(e.target.value);renderWeeklyNutritionMeasured();});
 bindMealPlanLinks();
}
function integrityShopping(days){
 const totals=new Map();let assigned=0;
 for(const day of days){if(!day.plan)continue;assigned++;for(const meal of mealsForNutritionPlan(day.plan))for(const i of usableIngredients(meal)){const q=Number(i.quantity);if(!q||!i.unit)continue;const key=i.name.toLowerCase()+'|'+i.unit;const old=totals.get(key)||{...i,quantity:0};old.quantity+=q;totals.set(key,old);}}
 return '<details class="panel shopping-list" open><summary>Shopping list · '+assigned+'/7 days</summary><div class="ingredient-list">'+[...totals.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(i=>'<div><b>'+esc(i.name)+'</b><span>'+esc(nutritionUnit(Math.round(i.quantity),i.unit))+'</span></div>').join('')+'</div></details>';
}
document.addEventListener('DOMContentLoaded',()=>{
 clearInterval(integrityHealthTimer);
 integrityHealthTimer=setInterval(async()=>{
  if(state.preview||document.hidden||!state.client||!db)return;
  const id=state.client.id;
  try{const rows=await query('Latest shared readings',db.from('client_health_daily').select('*').eq('client_id',id).order('date',{ascending:false}).limit(90));if(state.client?.id!==id)return;
   const changed=JSON.stringify(rows)!==JSON.stringify(state.data.healthDaily);state.data.healthDaily=rows;
   if(changed&&!document.activeElement?.matches('input,textarea,select')){if(state.role==='coach'&&state.clientTab==='overview'){const summary=$('#clientWorkspaceBody .health-summary');if(summary)summary.outerHTML=healthSummaryMarkup();}else if(state.clientView==='today')clientToday();}
  }catch{}
 },30000);
});

const integrityToday=clientToday;
clientToday=function(){integrityToday();if(!$('#clientMain .health-summary'))$('#clientMain').insertAdjacentHTML('beforeend',healthSummaryMarkup());};
const integrityTargets=nutritionTargets;
nutritionTargets=function(plan){let html=integrityTargets(plan);if(!finiteRecorded(state.client.nutrition_settings?.water_litres))html=html.replace(/<div><small>Water<\/small><strong>To agree<\/strong><\/div>/,'');return html;};

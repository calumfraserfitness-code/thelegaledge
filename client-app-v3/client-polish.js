/* Keep imported source records intact; render only useful coaching instructions. */
function cleanCoachingText(value){
 const text=String(value??'').trim();
 if(/(?:SAVE TARGETS|IMPORT WITH AI|Import meal-plan JSON|source_system|\"(?:days|meals|ingredients)\"\s*:|<\/?(?:html|script|div)\b)/i.test(text)||text.length>2500)return '';
 return text;
}
const polishNutritionMarkup=nutritionPlanMarkup;
nutritionPlanMarkup=function(plan){return polishNutritionMarkup({...plan,coach_notes:cleanCoachingText(plan.coach_notes)});};
const polishExerciseCard=exerciseCard;
exerciseCard=function(ex,loggable=false){
 let html=polishExerciseCard({...ex,coach_instructions:cleanCoachingText(ex.coach_instructions),notes:cleanCoachingText(ex.notes),previous_performance:cleanCoachingText(ex.previous_performance)},loggable);
 if(!loggable)return html;
 const history=(state.data.exerciseLogs||[]).filter(r=>r.training_session_id!==state.selectedSessionId&&(r.program_exercise_id===ex.id||(ex.exercise_bank_id&&r.exercise_bank_id===ex.exercise_bank_id))).sort((a,b)=>String(b.performed_at).localeCompare(String(a.performed_at)));
 html=html.replace(/<b>Set (\d+)<\/b>/g,(match,n)=>{const previous=history.find(r=>r.set_number===Number(n));const detail=previous?(previous.duration_seconds!=null?previous.duration_seconds+' seconds':[(previous.reps!=null?previous.reps+' reps':''),(previous.load!=null?previous.load+' '+(previous.load_unit||'kg'):'')].filter(Boolean).join(' · ')):'No previous set';return match+'<small class="last-set">Last: '+esc(detail)+(previous?' · '+esc(fmt(previous.performed_at)):'')+'</small>';});
 return html.replace('<button class="btn primary small">Save','<p class="set-save-status" role="status" aria-live="polite">Your entries save when you leave a field.</p><button class="btn primary small">Save');
};
const polishTraining=clientTraining;
clientTraining=function(){
 polishTraining();const client=state.client,session=state.data.sessions.find(r=>r.id===state.selectedSessionId);
 if(!client||!session)return;
 document.querySelectorAll('#clientMain form[data-exercise-log]').forEach(form=>{
 const exercise=exercisesForSession(session).find(r=>r.id===form.dataset.exerciseLog);if(!exercise)return;
 let chain=Promise.resolve(),pending=0;const manual=form.querySelector('button');
 form.addEventListener('change',event=>{
 if(!event.target.matches('input'))return;const set=Number(event.target.name.split('_').pop());let rows;
 const status=form.querySelector('.set-save-status');
 try{rows=workoutSetRows(exercise,session,new FormData(form),client).filter(r=>r.set_number===set&&(r.reps!==null||r.duration_seconds!==null));}catch(error){if(status)status.textContent=error.message;return;}
 if(!rows.length){if(status)status.textContent='Enter actual reps or seconds to save this set.';return;}
 if(status)status.textContent='Saving…';pending++;if(manual)manual.disabled=true;
 chain=chain.catch(()=>{}).then(async()=>{
 try{
 const saved=state.preview?rows.map(r=>({...r,id:'sample-'+session.id+'-'+exercise.id+'-'+r.set_number})):await query('Autosave workout set',db.from('exercise_set_logs').upsert(rows,{onConflict:'client_id,training_session_id,program_exercise_id,set_number'}).select());
 if(saved.length!==rows.length)throw Error('Save was not confirmed.');
 if(state.client?.id!==client.id)return;
 const keys=new Set(saved.map(r=>r.training_session_id+'|'+r.program_exercise_id+'|'+r.set_number));state.data.exerciseLogs=[...saved,...(state.data.exerciseLogs||[]).filter(r=>!keys.has(r.training_session_id+'|'+r.program_exercise_id+'|'+r.set_number))];
 if(status&&form.isConnected)status.textContent='Saved ✓';
 }catch(error){if(status&&form.isConnected)status.textContent='Not saved. Use Save workout sets to retry. '+error.message;}finally{pending--;if(manual&&pending===0)manual.disabled=false;}
 });
 });
 });
};
const polishImportPanel=nutritionImportPanel;
nutritionImportPanel=function(){return polishImportPanel().replace('<form id="nutritionJsonForm">','<div class="editor-grid"><label>Different menus<select id="mealVariantCount"><option value="3">3 menus across 7 days</option><option value="5">5 menus across 7 days</option></select></label><label>Changes to make<textarea id="mealPromptChanges" rows="3" placeholder="For example: portable lunches, no fish, batch-cook dinners"></textarea></label></div><p class="muted">Copy the prompt into ChatGPT, then paste its meal plan below. Review the measured meals before saving.</p><form id="nutritionJsonForm">');};
const polishNutritionPrompt=nutritionImportPrompt;
nutritionImportPrompt=function(){const count=Number(document.querySelector('#mealVariantCount')?.value||3),changes=document.querySelector('#mealPromptChanges')?.value||'';return polishNutritionPrompt()+'\n\nCreate exactly '+count+' genuinely different menus, scheduled over all seven weekdays (weekday 0–6, days_per_week:1 each). Include variant_count:'+count+' and variant_index in each day. Match existing day-specific targets; do not change agreed targets without flagging the proposed change. Weigh every ingredient and show raw/dry/cooked basis. Reconcile daily totals with the meals. Respect allergies, preferences and kosher separation if stated.\nREQUESTED CHANGES: '+changes+'\nRECENT CHECK-INS: '+JSON.stringify((state.data.checkins||[]).slice(0,4))+'\nRECORDED GOALS: '+JSON.stringify(state.data.coachingGoals||[])+'\nCOACHING REVIEWS: '+JSON.stringify((state.data.coachingCalls||[]).filter(r=>['complete','completed'].includes(r.status)).map(r=>({title:r.title,recap:r.recap})))+'\nFATHOM REVIEW NOTES: '+JSON.stringify((state.data.coachingGuidance||[]).filter(r=>/^Fathom review ·/.test(r.title)).map(r=>({title:r.title,body:r.body})))+'\nCURRENT MENUS: '+JSON.stringify((state.data.nutritionPlans||[]).filter(r=>r.is_active!==false).map(r=>({name:r.name,calories:r.calories,protein_g:r.protein_g,carbs_g:r.carbs_g,fat_g:r.fat_g})));};
const polishAddClient=showAddClient;
showAddClient=function(){polishAddClient();const form=document.querySelector('#addClientForm');if(form)form.insertAdjacentHTML('beforebegin','<section class="onboarding-roadmap"><b>One clear next step at a time</b><ol><li>Payment confirmation</li><li>Welcome video</li><li>Agreement & consent</li><li>Intake answers</li><li>Coach plan review</li><li>Coaching access</li></ol><a class="btn ghost small" href="?onboarding=demo" target="_blank" rel="noopener">Preview the client onboarding</a></section>');};
const polishImportJson=importNutritionJson;
importNutritionJson=async function(event){const id=state.client?.id;await polishImportJson(event);const button=document.querySelector('#confirmNutritionImport');if(button){const payload=state.pendingNutritionImport;button.onclick=e=>{if(state.client?.id!==id)return toast('Reopen the import for this client.','error');persistNutritionImport(payload,e.currentTarget);};}};
persistNutritionImport=async function(payload,button){
 if(state.preview)return toast('Plan validated. Sign in to import it.');const id=state.client.id;setBusy(button,true,'Importing…');
 try{await query('Complete nutrition import',db.rpc('import_client_nutrition',{target_client_id:id,payload}));for(const week of (state.data.weeks||[]).filter(w=>w.client_id===id&&w.week_start>iso(monday())))await query('Assign upcoming meal menus',db.rpc('assign_client_week_nutrition',{p_client_id:id,p_week_id:week.id}));if(state.client?.id!==id)return;await loadClientData(id);if(state.client?.id!==id)return;state.selectedNutritionPlanId=state.data.nutritionPlans.find(p=>p.is_active!==false)?.id;state.pendingNutritionImport=null;toast('Measured weekly meal plan saved');coachNutrition();}catch(error){toast(error.message||'Import failed','error');}finally{setBusy(button,false);}
};
const polishLoad=loadClientData;
loadClientData=async function(id){await polishLoad(id);if(state.client?.id!==id)return;for(const key of ['sessions','exercises'])state.data[key]=(state.data[key]||[]).map(row=>({...row,notes:cleanCoachingText(row.notes),coach_instructions:cleanCoachingText(row.coach_instructions)}));};
const polishCallsMarkup=coachingCallsMarkup;
coachingCallsMarkup=function(){const reviews=(state.data.coachingGuidance||[]).filter(r=>r.published&&/^Fathom review ·/.test(r.title));return polishCallsMarkup()+ (reviews.length?'<section class="panel"><span class="eyebrow">RECORDED REVIEWS</span><h2>Agreed priorities from your calls</h2>'+reviews.map(r=>'<article class="cw-call"><div><b>'+esc(r.title.replace('Fathom review · ',''))+'</b><p class="cw-lines">'+esc(r.body)+'</p></div></article>').join('')+'</section>':'');};
const polishGuidanceMarkup=coachingGuidanceMarkup;
coachingGuidanceMarkup=function(){const rows=state.data.coachingGuidance;state.data.coachingGuidance=(rows||[]).filter(r=>!/^Fathom review ·/.test(r.title));try{return polishGuidanceMarkup();}finally{state.data.coachingGuidance=rows;}};

const polishDiagnosticCard=diagnosticCard;
diagnosticCard=function(report){const markers=report.data?.markers||[];const flagged=markers.filter(m=>['high','low','out of range','abnormal','flagged'].includes(String(m.status||m.classification||'').toLowerCase())).length;const html=polishDiagnosticCard({...report,summary:cleanCoachingText(report.summary),data:{...report.data,coach_summary:cleanCoachingText(report.data?.coach_summary)}});return html.replace(/(\d+ tested · )\d+ requiring attention/,'$1'+flagged+' marked outside range');};
clientDiagnostics=function(){const reports=state.data.diagnostics||[];$('#clientMain').innerHTML=clientHeader('PRIVATE REPORTS','Blood work & reports','Your results, reference ranges and coach review in one place.')+(reports.length?diagnosticsMarkup():'<section class="panel"><span class="eyebrow">AWAITING YOUR REPORT</span><h2>Your report will appear here</h2><p>Your coach can add your laboratory report and review notes. Each marker will show its recorded result, units and reference range.</p><p class="muted">No results have been added to this account yet.</p></section>');};
const polishCoachNutrition=coachNutrition;
coachNutrition=function(){polishCoachNutrition();const plan=state.data.nutritionPlans.find(r=>r.id===state.selectedNutritionPlanId),original=plan?.source_json?.original_targets;if(!original)return;$('#clientWorkspaceBody').insertAdjacentHTML('beforeend','<section class="panel"><span class="eyebrow">COACH REVIEW</span><h3>Original targets and measured meal totals</h3><p>Original saved target: '+esc(original.calories)+' kcal · P '+esc(original.protein_g)+' g · C '+esc(original.carbs_g)+' g · F '+esc(original.fat_g)+' g.</p><p>Measured menu estimate: '+esc(plan.calories)+' kcal · P '+esc(plan.protein_g)+' g · C '+esc(plan.carbs_g)+' g · F '+esc(plan.fat_g)+' g.</p><p class="muted">Confirm target changes with the client before treating this example as a newly agreed prescription.</p></section>');};

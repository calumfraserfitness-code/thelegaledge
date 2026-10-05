/* Versioned intake; private server drafts, no health details in browser storage. */
const profileSections=[
 {key:'health',title:'Your health',intro:'A short safety screen for your coach. These answers do not replace a medical assessment.',fields:[
 ['heart_condition','Has a clinician told you that you have a heart condition or high blood pressure?','yesno'],
 ['chest_pain','Do you experience chest pain during activity or at rest?','yesno'],
 ['fainting','Have you had unexplained fainting, dizziness or loss of balance?','yesno'],
 ['medical_restriction','Have you been told to restrict exercise, or do you have a condition requiring supervision?','yesno'],
 ['pregnancy','Are you pregnant, recently postpartum, or returning after surgery?','yesno'],
 ['joint_condition','Do you have a bone, joint or muscle problem that activity could worsen?','yesno'],
 ['medication','Do you take medication that could affect exercise, appetite or recovery?','yesno'],
 ['health_details','Anything your coach should know about the answers above?','text'],
 ['injuries','Current pain, injuries or movement limitations — enter none if there are none.','text',true],
 ['medical_support','Relevant clinician advice or exercise restrictions, if any.','text']]},
 {key:'training',title:'Your training',intro:'Tell us what you have done before and what fits your week.',fields:[
 ['training_days','How many training days can you realistically manage?','number',true,0,7],
 ['training_experience','Training experience','select',true,['New to training','Returning after a break','1–3 years','3+ years']],
 ['training_history','What have you trained over the last six months? Include frequency and activities.','text',true],
 ['preferred_training_time','When does training usually fit?','short',true],
 ['session_minutes','Realistic minutes for a normal session','number',true,5,180],
 ['busy_day_training','What is realistic on your busiest day?','text',true],
 ['preferred_style','Activities you enjoy — and anything you dislike','text',true],
 ['equipment','Where will you train and what equipment can you use?','text',true],
 ['gym_name','Gym name, if applicable','short'],['gym_location','Gym town or city','short'],
 ['training_barriers','What has stopped you staying consistent before?','text',true]]},
 {key:'nutrition',title:'Your nutrition',intro:'We will build around your preferences, schedule and comfort with tracking.',fields:[
 ['current_weight','Current body weight','number',true,1,1500],['weight_unit','Weight unit','select',true,['lb','kg']],
 ['height','Height','number',true,1,300],['height_unit','Height unit','select',true,['inches','cm']],
 ['nutrition_target_context','Relevant sex-related factors for energy estimates, if you are comfortable sharing','select',false,['Prefer not to say','Female','Male','Other / discuss with coach']],
 ['typical_eating','A normal day of food and drinks — breakfast, lunch, dinner and snacks','text',true],
 ['food_restrictions','Food allergies, intolerances and dietary requirements — enter none if there are none','text',true],
 ['foods_to_include','Foods and meals you enjoy','text',true],['foods_to_avoid','Foods you dislike or avoid','text'],
 ['meals_per_day','Preferred meals per day','number',true,1,8],
 ['meal_prep_time','Usual cooking time','select',true,['Under 15 minutes','Up to 30 minutes','Up to 60 minutes']],
 ['meal_routine','Kitchen access, food shopping and meal preparation routine','text',true],
 ['workday_meals','Meals out, business travel, late meetings and delivery habits','text',true],
 ['nutrition_approach','Which food approach feels manageable?','select',true,['Visual portions','Weighed ingredients','Calories and macros','Discuss with my coach']],
 ['nutrition_history','Previous diets or coaching: what worked and what did not?','text'],
 ['tracking_safety','Would calorie or weight tracking feel uncomfortable or unsuitable?','select',true,['No','Yes — please discuss privately','Not sure']],
 ['supplements','Current supplements, caffeine and usual water intake','text']]},
 {key:'lifestyle',title:'Your lifestyle',intro:'The practical details help us make a plan you can use.',fields:[
 ['work_pattern','Work pattern','select',true,['Office','Hybrid','Remote','Shift work','Travel frequently','Other']],
 ['work_hours','Typical hours, commute and busiest days','text',true],
 ['sleep_hours','Usual hours of sleep','number',true,0,24],
 ['sleep_quality','How does your sleep feel?','select',true,['Usually restorative','Mixed','Often tired','Irregular schedule']],
 ['current_steps','Current daily steps, if known — leave blank if unknown','number',false,0,100000],
 ['wearable','Phone or watch','select',true,['None','iPhone / Apple Watch','Android / Health Connect','Garmin','Fitbit','WHOOP','Oura','Other']],
 ['stress','Current stress: 1 low, 10 high','number',true,1,10],
 ['lifestyle_factors','Family commitments, travel and alcohol: what should the plan account for?','text',true],
 ['pressure_pattern','When work gets intense, what changes first?','select',true,['Sleep','Meals','Movement','Training','Several of these']],
 ['support_preferences','How do you prefer feedback and accountability?','text',true]]},
 {key:'goals',title:'Your direction',intro:'Finish with what matters to you. There is no perfect answer.',fields:[
 ['goals','Your main goal and why it matters now','text',true],
 ['success_measure','What would progress look like in 12 weeks?','text',true],
 ['goal_deadline','Any event or deadline we should know about?','short'],
 ['confidence','Confidence you can follow a realistic plan: 1 low, 10 high','number',true,1,10],
 ['non_negotiables','What must your plan make room for?','text',true],
 ['anything_else','Anything else you would like Calum to understand?','text']]}
];
let profileDraft={},profileStep=0,profileLoad=0;
function profileField(f){const [name,label,type,required,min,max]=f,r=required?'required':'',a=`name="${name}" ${r}`;
 const control=type==='text'?`<textarea ${a} rows="3"></textarea>`:type==='select'||type==='yesno'?`<select ${a}><option value="">Choose an answer</option>${(type==='yesno'?['no','yes']:min).map(v=>`<option value="${esc(v)}">${esc(v==='yes'?'Yes':v==='no'?'No':v)}</option>`).join('')}</select>`:`<input ${a} type="${type==='number'?'number':'text'}" ${type==='number'?`min="${min}" max="${max}" step="any"`:''}>`;
 return `<label class="${type==='text'||type==='yesno'?'wide':''}">${esc(label)}${required?'':' <small>Optional</small>'}${control}</label>`;}
const originalJourneyWizard=renderOnboardingWizard;
renderOnboardingWizard=function(){
 if(!journeyCurrent&&!journeyDemo)return originalJourneyWizard();
 show('#clientApp');$('#clientNav').classList.add('hidden');const request=++profileLoad;profileDraft={};profileStep=0;
 $('#clientMain').innerHTML=clientHeader('YOUR COACHING PROFILE','Let’s get to know you.','Five short sections. Your answers save securely when you continue.')+`<form id="onboardingWizard" class="panel onboarding-wizard" novalidate><div class="profile-progress"><div id="profileProgress"></div></div><p id="profileSave" role="status">${journeyDemo?'Fictional preview · answers stay only in this page.':'You can return to completed sections before submitting.'}</p>${profileSections.map(s=>`<h2>${esc(s.title)}<small>${esc(s.intro)}</small></h2><div class="editor-grid" data-profile-section="${s.key}">${s.fields.map(profileField).join('')}</div>`).join('')}<button type="submit" class="btn primary">Send my profile to Calum</button></form>`;
 $('#onboardingWizard').onsubmit=profileSubmit;
 if(!journeyDemo&&journeyCurrent?.stage==='intake')query('Saved profile',db.from('onboarding_drafts').select('responses,step').eq('client_id',state.client.id)).then(rows=>{if(request!==profileLoad||!$('#onboardingWizard'))return;const row=rows[0];if(!row)return;profileDraft=row.responses||{};profileStep=row.step||0;for(const [k,v] of Object.entries(profileDraft)){const field=$('#onboardingWizard').elements.namedItem(k);if(field)field.value=String(v??'');}$('#profileSave').textContent='Your saved answers have been restored.';window.profilePaint?.();}).catch(()=>{if(request===profileLoad&&$('#profileSave'))$('#profileSave').textContent='Unable to restore saved answers. Refresh before continuing if you saved earlier.';});
};
async function profileSave(step){
 const form=$('#onboardingWizard');profileDraft=Object.fromEntries(new FormData(form));profileStep=step;
 if(!journeyDemo&&journeyCurrent?.stage==='intake')await query('Save profile progress',db.from('onboarding_drafts').upsert({client_id:state.client.id,responses:profileDraft,step,updated_at:new Date().toISOString()},{onConflict:'client_id'}));
 $('#profileSave').textContent=journeyDemo?'Preview progress retained on this page.':'✓ Progress saved securely';
}
function profileValidate(grid){grid.querySelector('[name=health_details]')?.setCustomValidity('');const invalid=[...grid.querySelectorAll('input,textarea,select')].find(x=>!x.checkValidity());if(invalid){invalid.reportValidity();return false;}if(grid.dataset.profileSection==='health'&&[...grid.querySelectorAll('select')].some(x=>x.value==='yes')&&!grid.querySelector('[name=health_details]').value.trim()){grid.querySelector('[name=health_details]').setCustomValidity('Please add details for your coach to review.');grid.querySelector('[name=health_details]').reportValidity();return false;}return true;}
journeyIntakePages=function(){
 const f=$('#onboardingWizard'),headings=[...f.querySelectorAll('h2')],grids=[...f.querySelectorAll('.editor-grid')],submit=f.querySelector('button[type=submit]');
 f.querySelector('[name=health_details]').oninput=e=>e.target.setCustomValidity('');
 const controls=document.createElement('div');controls.className='journey-intake-controls';controls.innerHTML='<button type="button" class="btn ghost" id="journeyBack">Back</button><button type="button" class="btn primary" id="journeyNext">Save & continue</button>';f.append(controls);
 function paint(){headings.forEach((h,i)=>h.hidden=i!==profileStep);grids.forEach((g,i)=>g.hidden=i!==profileStep);submit.hidden=profileStep!==grids.length-1;$('#journeyBack').hidden=profileStep===0;$('#journeyNext').hidden=profileStep===grids.length-1;$('#profileProgress').style.width=((profileStep+1)/grids.length*100)+'%';($('#journeyExisting .eyebrow')||$('#clientMain .eyebrow')).textContent=`COACHING PROFILE · ${profileStep+1} OF ${grids.length}`;}
 window.profilePaint=paint;
 $('#journeyBack').onclick=()=>{profileStep--;paint();};$('#journeyNext').onclick=async e=>{if(!profileValidate(grids[profileStep]))return;setBusy(e.target,true);try{await profileSave(profileStep+1);paint();}catch(err){toast(err.message,'error');}finally{setBusy(e.target,false);}};paint();
};
async function profileSubmit(e){
 e.preventDefault();const grids=[...e.target.querySelectorAll('.editor-grid')];for(let i=0;i<grids.length;i++){profileStep=i;window.profilePaint?.();if(!profileValidate(grids[i]))return;}
 const f=Object.fromEntries(new FormData(e.target)),sections={};for(const s of profileSections)sections[s.key]=Object.fromEntries(s.fields.map(([key])=>[key,f[key]??'']));
 // Existing coach exports read these section keys too.
 Object.assign(sections.training,{experience:f.training_experience,preferred_time:f.preferred_training_time,style:f.preferred_style,injuries:f.injuries});Object.assign(sections.nutrition,{restrictions:f.food_restrictions});sections.lifestyle.goals=f.goals;
 setBusy(e.submitter,true);try{if(journeyDemo){journeyCurrent.stage='review';journeyCurrent.intake_completed_at=new Date().toISOString();journeyCurrent.screening_status=profileSections[0].fields.filter(f=>f[2]==='yesno').some(([k])=>f[k]==='yes')?'needs_review':'no_flags';return renderJourney(journeyCurrent);}
 const now=new Date().toISOString();await query('Coaching profile',db.from('onboarding_responses').upsert({client_id:state.client.id,version:3,submitted_at:now,completed_at:now,responses:{sections}},{onConflict:'client_id,version'}));state.client.onboarding_status='complete';state.client.plan_status='coach_building';await renderClient();
 }catch(err){toast(err.message,'error');setBusy(e.submitter,false);}
}
const originalJourneyLegal=renderLegalGate;
renderLegalGate=function(){
 const j=journeyCurrent;if(!j?.privacy_body&&!journeyDemo)return originalJourneyLegal();
 const body=j.privacy_body||'Fictional privacy notice preview. The published notice must identify the controller and contact details, purposes and lawful bases, health data processing, recipients, storage and retention, international transfers, rights and how to contact the relevant supervisory authority. This is not an approved legal document.';
 show('#clientApp');$('#clientNav').classList.add('hidden');$('#clientMain').innerHTML=clientHeader('HEALTH & PRIVACY','Your information. Your choices.','Read your notice before providing health information.')+`<form id="legalGate" class="panel legal-gate"><article class="journey-contract"><h2>Privacy notice</h2><small>Version ${esc(j.privacy_version||'DEMO')}</small><pre>${esc(body)}</pre></article><p>Coaching does not replace diagnosis or medical treatment. Please tell your coach about relevant restrictions and changes to your health.</p><label class="toggle-field"><input name="health" type="checkbox" required>I will give accurate information and report relevant health changes.</label><label class="toggle-field"><input name="privacy" type="checkbox" required>I have read the privacy notice and explicitly consent to processing my health information for my coaching as described in it.</label><p class="muted">Device sharing is optional and chosen separately. No marketing photo permission is included here. You can discuss withdrawal of consent with your coach; the notice explains its effect on the service.</p><label>Full legal name<input name="signature_name" required></label><label>Country of residence<input name="country" autocomplete="country-name" required></label><label>Date of birth<input name="date_of_birth" type="date" max="${iso(new Date())}" required></label><button class="btn primary">Save consent & continue</button></form>`;
 $('#legalGate').onsubmit=async e=>{e.preventDefault();if(journeyDemo){j.stage='intake';return renderJourney(j);}const fd=new FormData(e.target),now=new Date().toISOString();setBusy(e.submitter,true);try{await query('Privacy consent',db.from('legal_consents').upsert({client_id:state.client.id,consent_type:'coaching_privacy_health',document_name:'Coaching privacy notice',document_version:j.privacy_version,visible_content:body,signed_at:now,accepted_at:now,signature_name:fd.get('signature_name'),signature_date:iso(new Date()),country:fd.get('country'),date_of_birth:fd.get('date_of_birth'),details:{health_confirmed:true,privacy_accepted:true,health_data_explicit_consent:true,privacy_version:j.privacy_version}},{onConflict:'client_id,document_version'}));state.client.onboarding_status='pending_onboarding';await renderClient();}catch(err){toast(err.message,'error');setBusy(e.submitter,false);}};
};

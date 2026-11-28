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
 ['health_details','If you answered Yes above, briefly explain what Calum needs to know.','text'],
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
 {key:'nutrition',title:'Your nutrition',intro:'Describe what you eat now, then tell Calum what meals would work for you. Examples help; exact calorie numbers are not needed.',fields:[
 ['current_weight','Current body weight','number',true,1,1500],['weight_unit','Weight unit','select',true,['lb','kg']],
 ['height','Height','number',true,1,300],['height_unit','Height unit','select',true,['inches','cm']],
 ['nutrition_target_context','Relevant sex-related factors for energy estimates, if you are comfortable sharing','select',false,['Prefer not to say','Female','Male','Other / discuss with coach']],
 ['typical_eating','What did you eat and drink yesterday? List breakfast, lunch, dinner and snacks, with rough amounts.','text',true],
 ['food_restrictions','Do you have any food allergies, intolerances, religious rules or dietary requirements? Write none if not.','text',true],
 ['foods_to_include','Which foods or meals would you like included in your plan? Give a few examples.','text',true],['foods_to_avoid','Which foods do you dislike or never want in your plan? Write none if not.','text'],
 ['meals_per_day','How many main meals would you like each day? Do not count snacks.','number',true,1,8],
 ['meal_prep_time','How much time can you spend preparing one meal?','select',true,['Under 15 minutes','Up to 30 minutes','Up to 60 minutes']],
 ['meal_routine','Can you cook at home and prepare leftovers for another day? Tell us what kitchen equipment you have.','text',true],
 ['workday_meals','Where do you usually get lunch on a workday: home, packed lunch, restaurant or delivery? Name any regular places.','text',true],
 ['nutrition_approach','How would you prefer your meal portions shown?','select',true,['Visual portions','Weighed ingredients','Calories and macros','Discuss with my coach']],
 ['snack_preferences','Would you like snacks in your plan? What snacks do you enjoy?','text'],
 ['food_budget','Any food budget or shopping limits Calum should plan around?','text'],
 ['weekend_meals','How is weekend eating different from your workdays? Include takeaways or meals out.','text'],
 ['caffeine','How many coffees, energy drinks or other caffeinated drinks do you usually have each day?','short'],
 ['water_intake','Roughly how much water do you drink daily? Cups or bottles are fine.','short'],
 ['nutrition_history','Have you tried a diet or meal plan before? What helped, and what was hard to keep doing?','text'],
 ['tracking_safety','Would weighing food, counting calories or regular weigh-ins feel uncomfortable for you?','select',true,['No','Yes — please discuss privately','Not sure']],
 ['supplements','Which supplements do you take, if any?','text']]},
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
let profileDraft={},profileStep=0,profileLoad=0,profileSubmitting=false;
function profileField(f){const [name,label,type,required,min,max]=f,r=(required||type==='yesno')?'required':'',a=`name="${name}" ${r}`;
 const control=type==='text'?`<textarea ${a} rows="3"></textarea>`:type==='select'||type==='yesno'?`<select ${a}><option value="">Choose an answer</option>${(type==='yesno'?['no','yes']:min).map(v=>`<option value="${esc(v)}">${esc(v==='yes'?'Yes':v==='no'?'No':({'Visual portions':'Simple portions: cups, handfuls and food counts','Weighed ingredients':'Ingredients weighed in grams or ounces','Calories and macros':'Calories and protein to aim for','Discuss with my coach':'Help me choose with Calum'}[v]||v))}</option>`).join('')}</select>`:`<input ${a} type="${type==='number'?'number':'text'}" ${type==='number'?`min="${min}" max="${max}" step="any"`:''}>`;
 return `<label class="${type==='text'||type==='yesno'?'wide':''}">${esc(label)}${required||type==='yesno'?'':' <small>Optional</small>'}${control}</label>`;}
const originalJourneyWizard=renderOnboardingWizard;
renderOnboardingWizard=function(){
 if(!journeyCurrent&&!journeyDemo)return originalJourneyWizard();
 show('#clientApp');$('#clientNav').classList.add('hidden');const request=++profileLoad;profileDraft={};profileStep=0;
 $('#clientMain').innerHTML=clientHeader('YOUR COACHING PROFILE','Let’s get to know you.','Five short sections. Your answers save securely when you continue.')+`<form id="onboardingWizard" class="panel onboarding-wizard" novalidate><div class="profile-progress"><div id="profileProgress"></div></div><p id="profileSave" role="status">${journeyDemo?'Fictional preview · answers stay only in this page.':'You can return to completed sections before submitting.'}</p>${profileSections.map(s=>`<h2>${esc(s.title)}<small>${esc(s.intro)}</small></h2><div class="editor-grid" data-profile-section="${s.key}">${s.fields.map(profileField).join('')}</div>`).join('')}<button type="submit" class="btn primary">Send my profile to Calum</button></form>`;
 $('#onboardingWizard').onsubmit=profileSubmit;
 if(!journeyDemo&&journeyCurrent?.stage==='intake')query('Saved profile',db.from('onboarding_drafts').select('responses,step').eq('client_id',state.client.id)).then(rows=>{if(request!==profileLoad||!$('#onboardingWizard'))return;const row=rows[0];if(!row)return;profileDraft=row.responses||{};profileStep=row.step||0;for(const [k,v] of Object.entries(profileDraft)){const field=$('#onboardingWizard').elements.namedItem(k);if(field)field.value=String(v??'');}$('#profileSave').textContent='Your saved answers have been restored.';window.profilePaint?.();}).catch(()=>{if(request===profileLoad&&$('#profileSave'))$('#profileSave').textContent='Unable to restore saved answers. Refresh before continuing if you saved earlier.';});
};
async function profileSave(step){
 const form=$('#onboardingWizard');const answers=Object.fromEntries(new FormData(form)),clientId=state.client.id,userId=state.user?.id;
 if(!journeyDemo&&journeyCurrent?.stage==='intake')await query('Save profile progress',db.from('onboarding_drafts').upsert({client_id:state.client.id,responses:answers,step,updated_at:new Date().toISOString()},{onConflict:'client_id'}));
 if(!form.isConnected||state.client?.id!==clientId||state.user?.id!==userId)return false;profileDraft=answers;profileStep=step;
 $('#profileSave').textContent=journeyDemo?'Preview progress retained on this page.':'✓ Progress saved securely';return true;
}
function profileValidate(grid){
 const details=grid.querySelector('[name=health_details]');details?.setCustomValidity('');
 if(details&&[...grid.querySelectorAll('select')].some(x=>x.value==='yes')&&details.value.trim().length<3)details.setCustomValidity('Briefly explain your Yes answer so Calum can review it. Please use at least three characters.');
 const invalid=[...grid.querySelectorAll('input,textarea,select')].find(x=>!x.checkValidity());
 if(!invalid)return true;
 const status=$('#profileSave');if(status){status.textContent=invalid===details?invalid.validationMessage:'Please complete: '+invalid.closest('label').childNodes[0].textContent.trim();status.style.color='var(--red)';}
 invalid.setAttribute('aria-invalid','true');invalid.scrollIntoView({block:'center'});invalid.focus();invalid.reportValidity();return false;
}
journeyIntakePages=function(){
 const f=$('#onboardingWizard'),headings=[...f.querySelectorAll('h2')],grids=[...f.querySelectorAll('.editor-grid')],submit=f.querySelector('button[type=submit]');
 f.querySelector('[name=health_details]').oninput=e=>e.target.setCustomValidity('');f.addEventListener('input',e=>{e.target.removeAttribute('aria-invalid');$('#profileSave').style.color='';});
 const controls=document.createElement('div');controls.className='journey-intake-controls';controls.innerHTML='<button type="button" class="btn ghost" id="journeyBack">Back</button><button type="button" class="btn primary" id="journeyNext">Save & continue</button>';f.append(controls);
 function paint(){headings.forEach((h,i)=>h.hidden=i!==profileStep);grids.forEach((g,i)=>g.hidden=i!==profileStep);submit.hidden=profileStep!==grids.length-1;$('#journeyBack').hidden=profileStep===0;$('#journeyNext').hidden=profileStep===grids.length-1;$('#profileProgress').style.width=((profileStep+1)/grids.length*100)+'%';($('#journeyExisting .eyebrow')||$('#clientMain .eyebrow')).textContent=`COACHING PROFILE · ${profileStep+1} OF ${grids.length}`;}
 window.profilePaint=paint;
 $('#journeyBack').onclick=()=>{profileStep--;paint();f.scrollIntoView({block:'start'});};$('#journeyNext').onclick=async e=>{if(!profileValidate(grids[profileStep]))return;setBusy(e.target,true);try{if(!await profileSave(profileStep+1))return;paint();f.scrollIntoView({block:'start'});}catch(err){toast(err.message,'error');}finally{setBusy(e.target,false);}};paint();
};
async function profileSubmit(e){
 e.preventDefault();if(profileSubmitting)return;
 const form=e.target,grids=[...form.querySelectorAll('.editor-grid')],clientId=state.client.id,userId=state.user?.id;
 const active=()=>form.isConnected&&state.client?.id===clientId&&state.user?.id===userId;
 for(let i=0;i<grids.length;i++){profileStep=i;window.profilePaint?.();if(!profileValidate(grids[i]))return;}
 const answers=Object.fromEntries(new FormData(form)),sections={};for(const section of profileSections)sections[section.key]=Object.fromEntries(section.fields.map(([key])=>[key,answers[key]??'']));
 Object.assign(sections.training,{experience:answers.training_experience,preferred_time:answers.preferred_training_time,style:answers.preferred_style,injuries:answers.injuries});Object.assign(sections.nutrition,{restrictions:answers.food_restrictions});sections.lifestyle.goals=answers.goals;
 profileSubmitting=true;setBusy(e.submitter,true,'Sending profile…');$('#profileSave').textContent='Sending your profile to Calum…';
 try{
  if(journeyDemo){journeyCurrent.stage='review';journeyCurrent.intake_completed_at=new Date().toISOString();journeyCurrent.screening_status=profileSections[0].fields.filter(field=>field[2]==='yesno').some(([key])=>answers[key]==='yes')?'needs_review':'no_flags';return renderJourney(journeyCurrent);}
  const now=new Date().toISOString();const saved=await query('Coaching profile',db.from('onboarding_responses').upsert({client_id:clientId,version:3,submitted_at:now,completed_at:now,responses:{sections}},{onConflict:'client_id,version'}).select('id,client_id,completed_at').single());
  if(saved?.client_id!==clientId||!saved.id||!saved.completed_at)throw Error('Your profile submission was not confirmed. Your answers are still here; please retry.');
  if(!active())return;state.client.onboarding_status='complete';state.client.plan_status='coach_building';await renderClient();
 }catch(err){
  if(!active())return;
  if(/health screening|health.*details/i.test(err.message)){profileStep=0;window.profilePaint?.();}
  $('#profileSave').textContent='Not submitted yet: '+err.message;$('#profileSave').style.color='var(--red)';$('#profileSave').scrollIntoView({block:'center'});toast(err.message,'error');
 }finally{profileSubmitting=false;if(e.submitter?.isConnected)setBusy(e.submitter,false);}
}
const originalJourneyLegal=renderLegalGate;
renderLegalGate=function(){
 const j=journeyCurrent;if(!j?.privacy_body&&!journeyDemo)return originalJourneyLegal();
 const body=j.privacy_body||'Fictional privacy notice preview. The published notice must identify the controller and contact details, purposes and lawful bases, health data processing, recipients, storage and retention, international transfers, rights and how to contact the relevant supervisory authority. This is not an approved legal document.';
 show('#clientApp');$('#clientNav').classList.add('hidden');$('#clientMain').innerHTML=clientHeader('HEALTH & PRIVACY','Your information. Your choices.','Read your notice before providing health information.')+`<form id="legalGate" class="panel legal-gate"><article class="journey-contract"><h2>Privacy notice</h2><small>Version ${esc(j.privacy_version||'DEMO')}</small><pre>${esc(body)}</pre></article><p>Coaching does not replace diagnosis or medical treatment. Please tell your coach about relevant restrictions and changes to your health.</p><label class="toggle-field"><input name="health" type="checkbox" required>I will give accurate information and report relevant health changes.</label><label class="toggle-field"><input name="privacy" type="checkbox" required>I have read the privacy notice and explicitly consent to processing my health information for my coaching as described in it.</label><p class="muted">Device sharing is optional and chosen separately. No marketing photo permission is included here. You can discuss withdrawal of consent with your coach; the notice explains its effect on the service.</p><label>Full legal name<input name="signature_name" required></label><label>Country of residence<input name="country" autocomplete="country-name" required></label><label>Date of birth<input name="date_of_birth" type="date" max="${iso(new Date())}" required></label><button class="btn primary">Save consent & continue</button></form>`;
 $('#legalGate').onsubmit=async e=>{e.preventDefault();if(journeyDemo){j.stage='intake';return renderJourney(j);}const fd=new FormData(e.target),now=new Date().toISOString();setBusy(e.submitter,true);try{await query('Privacy consent',db.from('legal_consents').upsert({client_id:state.client.id,consent_type:'coaching_privacy_health',document_name:'Coaching privacy notice',document_version:j.privacy_version,visible_content:body,signed_at:now,accepted_at:now,signature_name:fd.get('signature_name'),signature_date:iso(new Date()),country:fd.get('country'),date_of_birth:fd.get('date_of_birth'),details:{health_confirmed:true,privacy_accepted:true,health_data_explicit_consent:true,privacy_version:j.privacy_version}},{onConflict:'client_id,document_version'}));state.client.onboarding_status='pending_onboarding';await renderClient();}catch(err){toast(err.message,'error');setBusy(e.submitter,false);}};
};

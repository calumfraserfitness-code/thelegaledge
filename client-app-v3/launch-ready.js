/* Confirm persistence before changing local state; retain the client that initiated a save. */
async function launchSave(table,id,patch){
 if(state.preview)return {...patch,id};
 const rows=await query('Save '+table,db.from(table).update(patch).eq('id',id).select());
 if(rows.length!==1||rows[0].id!==id)throw Error('Save was not confirmed. Your changes have not been applied.');
 return rows[0];
}
function launchApplyClient(id,saved){
 const roster=state.clients.find(c=>c.id===id);if(roster)Object.assign(roster,saved);
 if(state.client?.id===id)Object.assign(state.client,saved);
}
saveClientControls=async function(event){
 event.preventDefault();const client=state.client,button=event.submitter,fd=new FormData(event.target),goal=Number(fd.get('goal_weight_display')||0),published=fd.has('plan_published');
 const patch={status:fd.get('status'),checkin_day:Number(fd.get('checkin_day')),daily_steps_goal:Number(fd.get('daily_steps_goal')),goal_weight_kg:goal?goal/(client.weight_unit==='lbs'?2.20462:1):null,track_weight:fd.has('track_weight'),cardio_enabled:fd.has('cardio_enabled'),mobility_enabled:fd.has('mobility_enabled'),weekly_checkin_enabled:fd.has('weekly_checkin_enabled'),midweek_checkin_enabled:fd.has('midweek_checkin_enabled'),plan_status:published?'published':'coach_building',plan_published_at:published?(client.plan_published_at||new Date().toISOString()):null,portal_enabled:published};
 if(!['active','ending','past','inactive','archived'].includes(patch.status)||!Number.isInteger(patch.daily_steps_goal)||patch.daily_steps_goal<1||!Number.isInteger(patch.checkin_day)||patch.checkin_day<0||patch.checkin_day>6||goal<0||!Number.isFinite(goal))return toast('Check the status, steps, goal weight and check-in day.','error');
 setBusy(button,true);try{const saved=await launchSave('clients',client.id,patch);launchApplyClient(client.id,saved);toast(state.preview?'Preview controls updated':'Client controls saved');if(state.client?.id===client.id&&event.target.isConnected)coachOverview();}catch(e){toast(e.message,'error');}finally{setBusy(button,false);}
};
const launchOverview=coachOverview;
coachOverview=function(){
 launchOverview();const client=state.client,form=$('#clientSettings');if(!form)return;
 form.elements.status.querySelector('[value="inactive"]').textContent='Inactive';form.elements.status.insertAdjacentHTML('beforeend','<option value="ending">Ending soon</option><option value="past">Past client</option>');form.elements.status.value=client.status||'active';
 form.querySelector('button[type="submit"],button.btn.primary').insertAdjacentHTML('beforebegin',`<label class="field"><input name="weekly_checkin_enabled" type="checkbox" ${client.weekly_checkin_enabled!==false?'checked':''}> Weekly check-ins</label><label class="field"><input name="midweek_checkin_enabled" type="checkbox" ${client.midweek_checkin_enabled?'checked':''}> Midweek check-ins</label><p class="muted">Publishing still requires this client's completed onboarding and any required health review.</p>`);
 $('#clientWorkspaceBody').insertAdjacentHTML('beforeend',`<section class="panel"><div class="panel-head"><h3>Client details & goals</h3></div><form id="launchProfile" class="editor-grid"><label>Name<input name="display_name" required value="${esc(client.display_name||'')}"></label><label>Phone<input name="phone" type="tel" value="${esc(client.phone||'')}"></label><label>Region<select name="market_region"><option value="us">United States</option><option value="ireland">Ireland</option></select></label><label>Weight display<select name="weight_unit"><option value="lbs">Pounds (lb)</option><option value="kg">Kilograms (kg)</option></select></label><label>Time zone<input name="timezone" required value="${esc(client.timezone||'UTC')}"></label><label>Start date<input name="start_date" type="date" value="${esc(client.start_date||'')}"></label><label class="wide">Agreed goals<textarea name="goal_summary" rows="3">${esc(client.goal_summary||'')}</textarea></label><label class="wide">Private coach notes<textarea name="coach_notes" rows="3">${esc(cleanCoachingText(client.coach_notes))}</textarea></label><p class="muted wide">Login email: ${esc(client.email||'Not linked')}. Saved signatures and logged weights retain their original records. Coach notes stay in the coach workspace.</p><button class="btn primary">Save client details</button></form></section>`);
 const profile=$('#launchProfile');profile.elements.market_region.value=client.market_region||'us';profile.elements.weight_unit.value=client.weight_unit||'lbs';
 profile.onsubmit=async event=>{event.preventDefault();const patch=Object.fromEntries(new FormData(profile));if(patch.coach_notes===cleanCoachingText(client.coach_notes))delete patch.coach_notes;patch.display_name=patch.display_name.trim();patch.start_date=patch.start_date||null;if(!patch.display_name)return toast('Enter the client name.','error');try{new Intl.DateTimeFormat('en',{timeZone:patch.timezone});}catch{return toast('Use a valid time zone, such as Europe/Dublin or America/New_York.','error');}setBusy(event.submitter,true);try{const saved=await launchSave('clients',client.id,patch);launchApplyClient(client.id,saved);toast('Client details saved');if(state.client?.id===client.id&&event.target.isConnected)renderCoach();}catch(e){toast(e.message,'error');}finally{setBusy(event.submitter,false);}};
};
saveWeekDetails=async function(event){
 event.preventDefault();const client=state.client,week=currentWeek(),fd=new FormData(event.target);if(!week)return toast('Select a week first.','error');const goal=Number(fd.get('goal_weight_display')||0);if(!Number.isFinite(goal)||goal<0)return toast('Enter a valid goal weight.','error');
 const patch={title:String(fd.get('title')||'').trim()||null,coach_note:String(fd.get('coach_note')||'').trim()||null,goal_weight_kg:goal?goal/(client.weight_unit==='lbs'?2.20462:1):null};setBusy(event.submitter,true);
 try{const saved=await launchSave('program_weeks',week.id,patch);Object.assign(week,saved);toast('Week saved');if(state.client?.id===client.id&&event.target.isConnected)coachPlanner();}catch(e){toast(e.message,'error');}finally{setBusy(event.submitter,false);}
};
savePlannerSession=async function(event){
 event.preventDefault();const clientId=state.client.id,id=event.target.dataset.sessionEditor,session=state.data.sessions.find(s=>s.id===id),fd=new FormData(event.target);if(!session)return toast('This activity is no longer available. Refresh the schedule.','error');
 const nextDate=String(fd.get('session_date')||''),duration=Number(fd.get('duration_minutes')||0);if(!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)||!Number.isFinite(duration)||duration<0)return toast('Check the activity date and duration.','error');
 const patch={training_type:fd.get('training_type'),session_date:nextDate,title:String(fd.get('title')||'').trim(),duration_minutes:duration||null,moved_from_date:nextDate!==session.session_date?(session.moved_from_date||session.session_date):session.moved_from_date};setBusy(event.submitter,true);
 try{Object.assign(session,await launchSave('training_sessions',id,patch));toast('Schedule saved');if(state.client?.id===clientId&&event.target.isConnected)coachPlanner();}catch(e){toast(e.message,'error');}finally{setBusy(event.submitter,false);}
};
linkSavedClientAccount=async function(event){
 event.preventDefault();const clientId=state.client.id,fd=new FormData(event.target);setBusy(event.submitter,true);
 try{const saved=state.preview?{id:clientId,profile_id:'preview-linked'}:await provisionClientAccount({client_id:clientId,email:String(fd.get('email')).trim(),password:String(fd.get('password'))});if(saved.id!==clientId)throw Error('Login link was not confirmed.');launchApplyClient(clientId,saved);toast(state.preview?'Example login linked locally':'Login linked to this saved client');if(state.client?.id===clientId)coachOverview();}catch(e){toast(e.message,'error');}finally{setBusy(event.submitter,false);}
};
const launchWorkoutRows=workoutSetRows;
workoutSetRows=function(...args){return launchWorkoutRows(...args).filter(r=>r.reps!==null||r.duration_seconds!==null);};
storeProgressPhoto=async function(file,view,week,checkinId=null){
 if(!file?.size)return null;if(file.size>10*1024*1024)throw Error('Each photo must be under 10 MB.');
 const clientId=state.client.id,userId=state.user.id,path=`${clientId}/${Date.now()}-${view}-${String(file.name).replace(/[^a-z0-9._-]/gi,'-')}`;
 const {error}=await db.storage.from('client-files').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
 try{const rows=await query('Photo record',db.from('client_files').insert({client_id:clientId,uploaded_by:userId,file_type:'progress_photo',storage_path:path,original_name:file.name,mime_type:file.type,week_number:week||null,photo_view:view,notes:checkinId?`Weekly check-in ${checkinId}`:null}).select());if(rows.length!==1)throw Error('Photo record was not confirmed.');if(state.client?.id===clientId)state.data.files.unshift(rows[0]);return rows[0];}catch(e){await db.storage.from('client-files').remove([path]);throw e;}
};
deletePlannerSession=async function(id){
 const clientId=state.client.id,session=state.data.sessions.find(s=>s.id===id);if(!session)return;
 try{
 const logs=state.preview?(state.data.exerciseLogs||[]).filter(r=>r.training_session_id===id):await query('Check saved workout history',db.from('exercise_set_logs').select('id').eq('training_session_id',id).limit(1));
 if(session.status==='completed'||session.completed_at||logs.length)return toast('This activity has saved workout history. Edit its details instead of deleting it.','error');
 if(!confirm('Remove this unlogged activity from the week?'))return;
 if(!state.preview){const rows=await query('Remove activity',db.from('training_sessions').delete().eq('id',id).select());if(rows.length!==1)throw Error('Removal was not confirmed.');}
 if(state.client?.id===clientId){state.data.sessions=state.data.sessions.filter(s=>s.id!==id);coachPlanner();}toast('Unlogged activity removed');
 }catch(e){toast(e.message,'error');}
};

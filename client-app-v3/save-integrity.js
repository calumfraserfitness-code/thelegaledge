/* Blank progress inputs leave prior readings intact; saves stay with their account. */
(function(){
 'use strict';
 function patchFrom(form,client){
  const fd=new FormData(form),patch={};
  for(const key of ['weight_display','waist_cm','chest_cm','hips_cm','arm_cm','thigh_cm','steps','training_adherence','nutrition_adherence']){
   const raw=fd.get(key);if(raw==null||String(raw).trim()==='')continue;
   const n=Number(raw);if(!Number.isFinite(n)||n<0||key==='weight_display'&&n<=0)throw Error('Enter a valid '+title(key.replaceAll('_',' '))+'.');
   if(['steps','training_adherence','nutrition_adherence'].includes(key)&&!Number.isInteger(n))throw Error('Use a whole number for '+title(key.replaceAll('_',' '))+'.');
   if(['training_adherence','nutrition_adherence'].includes(key)&&n>100)throw Error('Adherence must be between 0 and 100.');
   patch[key==='weight_display'?'weight_kg':key]=key==='weight_display'?n/(client.weight_unit==='lbs'?2.2046226218:1):n;
  }
  const notes=String(fd.get('notes')||'').trim();if(notes)patch.notes=notes;
  if(!Object.keys(patch).length)throw Error('Add a measurement or note before saving.');
  return patch;
 }
 async function save(event,coach){
  event.preventDefault();const form=event.target;if(form.dataset.saving==='true')return;
  const client={...state.client},user=state.user?.id,fd=new FormData(form),date=coach?fd.get('entry_date'):localCoachingDate();
  let patch;try{patch=patchFrom(form,client);if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('Choose a valid date.');}catch(error){return toast(error.message,'error');}
  const active=()=>state.client?.id===client.id&&state.user?.id===user;
  form.dataset.saving='true';setBusy(event.submitter,true,'Saving…');
  try{
   const previous=state.data.progress.find(p=>p.entry_date===date);
   const rows=state.preview?[{...previous,...patch,id:previous?.id||'preview-progress-'+Date.now(),client_id:client.id,entry_date:date}]:await query('Save progress',db.rpc('save_progress_entry',{p_client:client.id,p_date:date,p_values:patch}));
   if(rows.length!==1||rows[0].client_id!==client.id||rows[0].entry_date!==date)throw Error('Save was not confirmed. Your entries are still here; retry.');
   if(!active())return;const saved=rows[0],index=state.data.progress.findIndex(p=>p.entry_date===date);if(index<0)state.data.progress.push(saved);else state.data.progress[index]=saved;
   toast(state.preview?'Sample progress updated locally':'Progress saved');(coach?coachProgress:clientProgress)();
  }catch(error){if(active())toast(error.message,'error');}
  finally{delete form.dataset.saving;setBusy(event.submitter,false);}
 }
 submitProgress=event=>save(event,false);addCoachProgress=event=>save(event,true);
 for(const name of ['clientProgress','coachProgress']){
  const previous=window[name];window[name]=function(...args){const result=previous(...args),form=$(name==='clientProgress'?'#progressForm':'#coachProgressForm');if(form){const note=document.createElement('p');note.className='muted wide';note.textContent='Blank fields leave your saved measurements unchanged.';form.append(note);}return result;};
 }
})();

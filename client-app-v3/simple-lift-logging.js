/* Preserve existing save handlers; make actual weight/reps the primary inputs. */
(function(){
 'use strict';
 const before=exerciseCard;
 exerciseCard=function(ex,loggable=false){
  const html=before(ex,loggable);
  if(!loggable||exerciseTrackingMode(ex)!=='reps')return html;
  const template=document.createElement('template');template.innerHTML=html;
  const form=template.content.querySelector('form[data-exercise-log]');if(!form)return html;
  form.classList.add('simple-lift-log');
  for(let parent=form.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  const unit=state.client?.weight_unit==='lbs'?'lb':'kg';
  const history=(state.data.exerciseLogs||[]).filter(r=>(!r.client_id||r.client_id===state.client?.id)&&r.training_session_id!==state.selectedSessionId&&(r.program_exercise_id===ex.id||(ex.exercise_bank_id&&r.exercise_bank_id===ex.exercise_bank_id))).sort((a,b)=>String(b.performed_at).localeCompare(String(a.performed_at)));
  const last=history[0],prior=last?history.filter(r=>last.training_session_id?r.training_session_id===last.training_session_id:String(r.performed_at).slice(0,10)===String(last.performed_at).slice(0,10)):[];
  const targets=String(ex.reps||'').split(',').map(s=>s.trim());
  form.querySelectorAll('.set-log-row').forEach(row=>{
   const reps=row.querySelector('input[name^="reps_"]'),load=row.querySelector('input[name^="load_"]');if(!reps||!load)return;
   const set=Number(reps.name.split('_').at(-1)),saved=prior.find(r=>Number(r.set_number)===set);
   row.querySelector('.last-set')?.remove();
   const note=document.createElement('small');note.className='last-set';
   const validLoad=saved?.load!==null&&saved?.load!==undefined&&saved?.load!==''&&Number.isFinite(Number(saved.load));
   const weight=validLoad?Number(saved.load)*((saved.load_unit||unit)===unit?1:unit==='lb'?2.2046226218:1/2.2046226218):null;
   note.textContent=saved?'Last: '+(weight===null?'Weight not recorded':Number(weight.toFixed(1))+' '+unit)+' × '+(saved.reps??'—')+' reps · '+fmt(saved.performed_at):'Last: no recorded set';
   row.querySelector('b')?.after(note);
   const target=document.createElement('small');target.className='lift-target';target.textContent='Target: '+(targets.length===Number(ex.sets)?targets[set-1]||ex.reps:ex.reps||'As prescribed')+' reps';note.after(target);
   const weightLabel=load.closest('label'),repLabel=reps.closest('label');row.append(weightLabel,repLabel);
   load.setAttribute('inputmode','decimal');reps.setAttribute('inputmode','numeric');load.placeholder='Weight';reps.placeholder='Reps';
   const rir=row.querySelector('input[name^="rir_"]')?.closest('label');if(rir){const detail=document.createElement('details');detail.className='lift-effort';const summary=document.createElement('summary');summary.textContent='Effort (optional)';detail.append(summary,rir);row.append(detail);}
  });
  form.querySelector('button[type="submit"],button.btn.primary')?.replaceChildren(document.createTextNode('Save sets'));
  return template.innerHTML;
 };
})();

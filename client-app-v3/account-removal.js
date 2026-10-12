/* Recoverable account removal. Only the assigned coach can change server access. */
(function(){
 'use strict';
 const prior=coachOverview;
 coachOverview=function(){
  prior();const client=state.client;if(!client||state.role!=='coach')return;
  const panel=$('#psClientStatus')?.closest('.panel');if(!panel)return;
  if(client.deleted_at){panel.querySelector('p').textContent='Removed account · client access closed · coaching records retained';$('#psClientStatus').remove();}
  const button=document.createElement('button');button.className='btn ghost';button.id='removeClientAccount';button.textContent=client.deleted_at?'Restore removed account':'Delete account…';panel.querySelector('.panel-head').append(button);
  button.onclick=()=>review(client);
 };
 function review(client){
  const id=client.id,user=state.user?.id,restoring=Boolean(client.deleted_at),modal=document.createElement('div');modal.className='modal-backdrop';
  modal.innerHTML=`<section class="modal-card" role="dialog" aria-modal="true" aria-label="${restoring?'Restore':'Delete'} client account" tabindex="-1"><h2>${restoring?'Restore':'Delete'} ${esc(client.display_name)}’s account?</h2><p>${restoring?'Restore their original login link and previous portal settings.':'This removes their access to the client app and moves them to Past clients. Their plans, check-ins, photos and history are retained so you can restore the account. This does not permanently erase their records.'}</p><form><label>Type the client’s full name to confirm<input name="confirmation" autocomplete="off" required></label><p role="status"></p><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="submit" class="btn primary" disabled>${restoring?'Restore account':'Delete account'}</button></form></section>`;
  document.body.append(modal);const form=modal.querySelector('form'),submit=form.querySelector('[type=submit]'),input=form.elements.confirmation,status=form.querySelector('[role=status]');let pending=false;
  const cancel=()=>{if(!pending){modal.remove();$('#removeClientAccount')?.focus();}};form.querySelector('[data-cancel]').onclick=cancel;
  input.oninput=()=>submit.disabled=pending||input.value!==client.display_name;
  modal.onkeydown=e=>{if(e.key==='Escape')cancel();if(e.key==='Tab'){const nodes=[...modal.querySelectorAll('input,button:not(:disabled)')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};input.focus();
  form.onsubmit=async e=>{
   e.preventDefault();if(pending||input.value!==client.display_name)return;
   if(state.user?.id!==user||state.client?.id!==id){status.textContent='The selected account changed. Close this dialog and try again.';return;}
   if(state.preview){status.textContent='Sign in as coach to change account access.';return;}
   pending=true;submit.disabled=true;status.textContent='Saving account access…';
   try{const {data,error}=await db.rpc('manage_client_account',{p_client:id,p_action:restoring?'restore':'remove',p_confirmation:input.value});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row||row.id!==id||(restoring?row.deleted_at!==null:!row.deleted_at))throw Error('Account change was not confirmed. Retry.');if(state.user?.id!==user){modal.remove();return;}launchApplyClient(id,row);modal.remove();toast(restoring?'Account restored':'Account removed · records retained');if(state.client?.id===id)coachOverview();}
   catch(err){status.textContent=err.message||'Account change failed. Please retry.';}
   finally{pending=false;submit.disabled=input.value!==client.display_name;}
  };
 }
})();

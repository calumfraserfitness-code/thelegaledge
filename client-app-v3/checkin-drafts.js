/* Private server drafts: no photos, audio or health data in local storage. */
(function(){
 'use strict';
 const before=clientCheckin;let generation=0;
 clientCheckin=function(){
  before();const form=$('#checkinForm'),version=++generation;if(!form)return;
  for(const name of ['energy','sleep','stress','workload']){const inputs=[...form.querySelectorAll(`[name="${name}"]`)];if(inputs.length===10){inputs.forEach(input=>{if(Number(input.value)%2)input.closest('label').remove();else{input.closest('label').querySelector('span').textContent=String(Number(input.value)/2);input.setAttribute('aria-label',`${name}: ${Number(input.value)/2} of 5`);}});const group=form.querySelector(`[name="${name}"]`)?.closest('div');if(group)group.style.gridTemplateColumns='repeat(5,minmax(0,1fr))';}}
  const client=state.client.id,profile=state.user?.id,period=form.elements.period_start.value;
  const active=()=>generation===version&&state.client?.id===client&&state.user?.id===profile&&form.isConnected;
  const status=document.createElement('p');status.setAttribute('role','status');status.className='muted';status.textContent=state.preview?'Sample draft stays on this screen.':'Your answers save privately as you type. Photos and audio attach when you submit.';form.prepend(status);
  let dirty=false,timer=null,chain=Promise.resolve(),submitted=false;
  function answers(){const a={};for(const [k,v] of new FormData(form)){if(typeof v==='string'&&!['photo_front'].includes(k))a[k]=v.slice(0,8000);}return a;}
  function persist(){if(state.preview||submitted||!active())return chain;const snapshot=answers();chain=chain.then(async()=>{if(submitted)return;const {error}=await db.from('client_checkin_drafts').upsert({client_id:client,period_start:period,answers:snapshot,updated_at:new Date().toISOString()},{onConflict:'client_id,period_start'});if(active())status.textContent=error?'Draft could not save. Keep this screen open and try again.':'Draft saved. Photos and audio attach when you submit.';});return chain;}
  function changed(){dirty=true;if(!state.preview)status.textContent='Saving draft…';clearTimeout(timer);timer=setTimeout(persist,700);}
  form.addEventListener('input',changed);form.addEventListener('change',changed);
  const submit=form.onsubmit;
  form.onsubmit=async function(e){e.preventDefault();clearTimeout(timer);await persist();if(!active())return;await submit.call(this,e);const confirmed=state.data.checkins.some(c=>c.period_start===period);if(confirmed&&!state.preview){submitted=true;await chain;await db.from('client_checkin_drafts').delete().eq('client_id',client).eq('period_start',period);}};
  // Suppress the browser's default submit before waiting for the server draft.
  form.addEventListener('submit',e=>e.preventDefault());
  if(!state.preview)db.from('client_checkin_drafts').select('answers').eq('client_id',client).eq('period_start',period).maybeSingle().then(({data,error})=>{
   if(!active()||dirty)return;if(error){status.textContent='Draft unavailable. You can still submit your check-in.';return;}
   if(data){for(const [k,v] of Object.entries(data.answers||{})){const nodes=form.querySelectorAll('[name]');nodes.forEach(n=>{if(n.name!==k||n.type==='file'||n.type==='hidden')return;if(n.type==='radio')n.checked=n.value===String(v);else n.value=String(v);});}status.textContent='Your saved draft has been restored.';}
  });
 };
})();

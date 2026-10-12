/* Private, matching-view comparisons. Source evidence stays in saved records. */
function clientGoalText(value){return String(value||'').replace(/\bSource:\s*https?:\/\/\S+/gi,'').replace(/https?:\/\/fathom\.video\/\S+/gi,'').trim();}
(function(){
 'use strict';
 function enhance(){
  const host=state.role==='coach'?$('#clientWorkspaceBody'):$('#clientMain');if(!host)return;
  const summary=clientGoalText(state.client?.goal_summary);
  if(summary&&!host.querySelector('[data-agreed-goal]')){const p=document.createElement('p');p.dataset.agreedGoal='';p.className='panel';p.textContent=summary;host.querySelector('.progress-hero')?.before(p);}
  if(!finiteRecorded(state.client?.goal_weight_kg)||Number(state.client.goal_weight_kg)<=0){const hero=host.querySelector('.goal-progress');if(hero)hero.innerHTML='<span>Goal focus</span><strong>Your agreed goals</strong><small>No target weight set</small>';}
  const cards=host.querySelectorAll('[data-photo-path]');if(!cards.length)return;
  const photos=(state.data.files||[]).filter(p=>p.file_type==='progress_photo'&&p.week_number&&p.photo_view).sort((a,b)=>Number(a.week_number)-Number(b.week_number)||String(a.created_at).localeCompare(String(b.created_at)));
  const weeks=[...new Set(photos.map(p=>Number(p.week_number)))];if(!weeks.length)return;
  const panel=document.createElement('section');panel.className='panel photo-comparison';panel.innerHTML='<h3>Weekly photo comparison</h3><p>Compare the same view in two weeks.</p><div class="photo-compare-controls"><label>Before<select data-photo-before></select></label><label>After<select data-photo-after></select></label><label>View<select data-photo-view><option value="front">Front</option><option value="side">Side</option><option value="back">Back</option></select></label></div><div class="photo-compare-pair"></div>';
  for(const select of panel.querySelectorAll('[data-photo-before],[data-photo-after]'))select.innerHTML=weeks.map(w=>`<option value="${w}">Week ${w}</option>`).join('');
  const before=panel.querySelector('[data-photo-before]'),after=panel.querySelector('[data-photo-after]'),view=panel.querySelector('[data-photo-view]');after.value=String(weeks.at(-1));before.value=String(weeks.length>1?weeks.at(-2):weeks[0]);
  function paint(){const selected=view.value;panel.querySelector('.photo-compare-pair').innerHTML=[['Before',before.value],['After',after.value]].map(([label,week])=>{const p=photos.filter(p=>Number(p.week_number)===Number(week)&&p.photo_view===selected).at(-1);return `<article><h4>${label} · Week ${esc(week)}</h4>${p?`<div data-photo-path="${esc(p.storage_path)}"><div class="photo-placeholder">Loading private photo…</div></div><small>${esc(fmt(p.created_at))}</small>`:`<p>No ${esc(selected)} photo for this week.</p>`}</article>`;}).join('');hydrateProgressPhotos();}
  before.onchange=after.onchange=view.onchange=paint;cards[0].closest('section').before(panel);paint();
 }
 const coach=coachProgress;coachProgress=function(){coach();enhance();};
 const client=clientProgress;clientProgress=function(){client();enhance();cameraInputs($('#clientMain'));};
 function cameraInputs(host){if(!host)return;for(const input of host.querySelectorAll('input[type=file][accept^="image/"]')){
  if(input.dataset.cameraReady)continue;input.dataset.cameraReady='true';const camera=document.createElement('input');camera.type='file';camera.accept='image/*';camera.setAttribute('capture','environment');camera.hidden=true;camera.setAttribute('aria-label','Take progress photo');
  const button=document.createElement('button');button.type='button';button.className='btn ghost small';button.textContent='Take a photo';button.onclick=()=>camera.click();camera.onchange=()=>{if(camera.files?.length){input.files=camera.files;input.dispatchEvent(new Event('change',{bubbles:true}));}};input.after(button,camera);
 }}
 const checkin=clientCheckin;clientCheckin=function(){const result=checkin();cameraInputs($('#clientMain'));return result;};
 const overview=coachOverview;coachOverview=function(){const result=overview();const host=$('#clientWorkspaceBody');if(host&&(state.data.coachingCalls||[]).some(c=>c.status==='scheduled'&&Date.parse(c.scheduled_at)>=Date.now()))host.insertAdjacentHTML('afterbegin',coachingCallsMarkup());return result;};
})();

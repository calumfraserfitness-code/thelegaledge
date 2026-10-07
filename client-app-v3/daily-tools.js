/* Practical client tools. Shopping checks and timers never write health or workout records. */
const shoppingChecks = new Map();
function shoppingAmount(item) {
 const quantity=Number(item.quantity),unit=String(item.unit||'').trim().toLowerCase();
 if(!Number.isFinite(quantity)||quantity<=0||!unit)return null;
 const conversion={kg:['g',1000],g:['g',1],oz:['g',28.349523125],lb:['g',453.59237],lbs:['g',453.59237],l:['ml',1000],ml:['ml',1],'fl oz':['ml',29.57352956]};
 const pair=conversion[unit]||[unit,1];
 return {quantity:quantity*pair[1],unit:pair[0]};
}
function weeklyShoppingData(days) {
 const totals=new Map(),missing=new Set();let assigned=0;
 for(const day of days){
  if(!day.plan)continue;assigned++;
  const meals=mealsForNutritionPlan(day.plan);
  if(!meals.length)missing.add(day.plan.name||'Assigned menu');
  for(const meal of meals){
   const ingredients=usableIngredients(meal).map(cleanIngredient);
   if(!ingredients.length)missing.add(meal.name||'Assigned meal');
   for(const item of ingredients){
    const amount=shoppingAmount(item);
    if(!amount){missing.add(item.name);continue;}
    // Keep raw/dry/cooked descriptions separate. Never estimate cooking yield or pack sizes.
    const basis=String(item.weight_basis||item.measurement_basis||item.description||'').trim();
    const key=[item.name.trim().toLowerCase().replace(/\s+/g,' '),amount.unit,basis.toLowerCase()].join('|');
    const old=totals.get(key)||{key,name:item.name,description:basis,quantity:0,unit:amount.unit};
    old.quantity+=amount.quantity;totals.set(key,old);
   }
  }
 }
 const items=[...totals.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.key.localeCompare(b.key));
 const week=days[0]?.date||currentWeek()?.week_start||'';
 const scope=[state.user?.id||'preview',state.client?.id||'sample',week].join('|');
 const fingerprint=JSON.stringify(items.map(i=>[i.key,Number(i.quantity.toFixed(4))]));
 let checks=shoppingChecks.get(scope);
 if(!checks||checks.fingerprint!==fingerprint){checks={fingerprint,selected:new Set()};shoppingChecks.set(scope,checks);}
 return {items,missing:[...missing].sort(),assigned,week,checks};
}
function shoppingListMarkup(days){
 const list=weeklyShoppingData(days),done=list.items.filter(i=>list.checks.selected.has(i.key)).length;
 return `<details class="panel shopping-list practical-shopping" open><summary>Shopping list · ${list.assigned}/7 days assigned</summary><p>Week beginning ${esc(fmt(list.week))}. These totals cover your assigned meals once, regardless of the batch portions selected above.</p><p class="muted">Keep raw, dry and cooked weights as listed. Cooked amounts are prepared-food amounts; no raw shopping equivalent has been guessed.</p>${list.assigned<7?'<p class="source-gap">Some days have no assigned menu. Their food is not included.</p>':''}${list.missing.length?`<p class="source-gap">Amounts still needed: ${list.missing.map(esc).join(', ')}. These foods are not included in the totals.</p>`:''}<div class="practical-shopping-actions"><strong data-shopping-progress>${done}/${list.items.length} picked up</strong><button class="btn ghost small" type="button" data-shopping-download ${list.items.length?'':'disabled'}>Download list</button><button class="text-btn" type="button" data-shopping-clear>Clear ticks</button></div><div class="practical-shopping-items">${list.items.map(i=>`<label class="practical-shopping-item"><input type="checkbox" data-shopping-item="${esc(i.key)}" ${list.checks.selected.has(i.key)?'checked':''}><span><b>${esc(i.name)}</b>${i.description?`<small>${esc(i.description)}</small>`:''}</span><strong>${esc(nutritionUnit(Number(i.quantity.toFixed(4)),i.unit))}</strong></label>`).join('')||'<p>No measured ingredients assigned yet.</p>'}</div><p class="muted">Ticks stay in this open page for this client and week. They do not mark meals eaten.</p></details>`;
}
integrityShopping=shoppingListMarkup;
function shoppingDownloadText(list){
 return ['THE LEGAL EDGE · WEEKLY SHOPPING','Week beginning '+list.week,list.assigned+'/7 days assigned','Totals for the assigned week; batch controls do not multiply this list.','Keep raw/dry/cooked weights as listed. Cooked weights are not raw purchase weights.','',...list.items.map(i=>(list.checks.selected.has(i.key)?'[x] ':'[ ] ')+i.name+(i.description?' ('+i.description+')':'')+' — '+nutritionUnit(Number(i.quantity.toFixed(4)),i.unit)),...(list.missing.length?['','AMOUNTS STILL NEEDED (excluded from totals)',...list.missing]:[]),...(list.assigned<7?['','Unassigned days are excluded.']:[])].join('\n');
}
document.addEventListener('change',event=>{
 if(!event.target.matches?.('[data-shopping-item]'))return;
 const list=weeklyShoppingData(weeklyNutritionSelection().days),key=event.target.dataset.shoppingItem;
 if(!list.items.some(i=>i.key===key))return;
 if(event.target.checked)list.checks.selected.add(key);else list.checks.selected.delete(key);
 event.target.closest('.practical-shopping').querySelector('[data-shopping-progress]').textContent=list.items.filter(i=>list.checks.selected.has(i.key)).length+'/'+list.items.length+' picked up';
});
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-shopping-download],[data-shopping-clear]');if(!button)return;
 const list=weeklyShoppingData(weeklyNutritionSelection().days);
 if(button.hasAttribute('data-shopping-clear')){list.checks.selected.clear();const host=button.closest('.practical-shopping');host.querySelectorAll('[data-shopping-item]').forEach(i=>i.checked=false);host.querySelector('[data-shopping-progress]').textContent='0/'+list.items.length+' picked up';return;}
 const url=URL.createObjectURL(new Blob([shoppingDownloadText(list)],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='legal-edge-shopping-'+list.week+'.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});

const restState={owner:null,exercise:null,label:'',remaining:0,deadline:null,interval:null};
function restOwner(){return [state.user?.id||'preview',state.role||'',state.client?.id||'',state.selectedSessionId||''].join('|');}
function restSecondsRemaining(now=Date.now()){return restState.deadline===null?restState.remaining:Math.max(0,Math.ceil((restState.deadline-now)/1000));}
function restTimeLabel(seconds){return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
function clearRestTimer(){clearInterval(restState.interval);Object.assign(restState,{owner:null,exercise:null,label:'',remaining:0,deadline:null,interval:null});document.getElementById('workoutRestTimer')?.remove();}
function drawRestTimer(){
 if(restState.owner!==restOwner()){clearRestTimer();return;}
 const seconds=restSecondsRemaining();
 if(!seconds&&restState.deadline!==null){restState.deadline=null;restState.remaining=0;clearInterval(restState.interval);restState.interval=null;}
 let host=document.getElementById('workoutRestTimer');
 if(!host){host=document.createElement('section');host.id='workoutRestTimer';host.className='workout-rest-timer';host.setAttribute('aria-label','Workout rest timer');document.body.append(host);}
 const mode=!seconds?'finished':restState.deadline===null?'paused':'running';
 if(host.dataset.mode!==mode){host.dataset.mode=mode;host.innerHTML=`<div><small>${esc(restState.label)} · Rest</small><strong data-rest-clock></strong><span role="status">${seconds?(restState.deadline===null?'Paused':'Time until your next set'):'Rest finished · start when ready'}</span></div><div><button class="btn ghost small" type="button" data-rest-control="${restState.deadline===null?'resume':'pause'}" ${seconds?'':'disabled'}>${restState.deadline===null?'Resume':'Pause'}</button><button class="btn ghost small" type="button" data-rest-control="dismiss">Dismiss</button></div>`;}
 host.querySelector('[data-rest-clock]').textContent=restTimeLabel(seconds);
}
function beginRestTimer(exercise){
 const seconds=Number(exercise.rest_seconds);
 if(!Number.isFinite(seconds)||seconds<=0||seconds>3600)return;
 clearRestTimer();Object.assign(restState,{owner:restOwner(),exercise:exercise.id,label:exercise.name,remaining:Math.ceil(seconds),deadline:Date.now()+Math.ceil(seconds)*1000});
 restState.interval=setInterval(drawRestTimer,500);drawRestTimer();
}
const dailyToolsExerciseCard=exerciseCard;
exerciseCard=function(exercise,loggable=false){
 const html=dailyToolsExerciseCard(exercise,loggable),seconds=Number(exercise.rest_seconds);
 if(!loggable||exerciseTrackingMode(exercise)==='completion'||!Number.isFinite(seconds)||seconds<=0||seconds>3600)return html;
 return html.replace('</article>',`<button class="btn ghost small" type="button" data-start-rest="${esc(exercise.id)}">Start ${esc(restTimeLabel(Math.ceil(seconds)))} rest</button></article>`);
};
document.addEventListener('click',event=>{
 if(event.target.closest?.('.logout')){clearRestTimer();shoppingChecks.clear();return;}
 const start=event.target.closest?.('[data-start-rest]');
 if(start){const session=state.data.sessions.find(s=>s.id===state.selectedSessionId),exercise=session&&exercisesForSession(session).find(e=>e.id===start.dataset.startRest);if(exercise)beginRestTimer(exercise);return;}
 const control=event.target.closest?.('[data-rest-control]');if(!control)return;
 if(restState.owner!==restOwner()||control.dataset.restControl==='dismiss'){clearRestTimer();return;}
 if(control.dataset.restControl==='pause'){restState.remaining=restSecondsRemaining();restState.deadline=null;clearInterval(restState.interval);restState.interval=null;}
 if(control.dataset.restControl==='resume'&&restState.remaining){restState.deadline=Date.now()+restState.remaining*1000;restState.interval=setInterval(drawRestTimer,500);}
 drawRestTimer();
});
document.addEventListener('visibilitychange',()=>{if(restState.owner)drawRestTimer();});
const dailyToolsLoadClient=loadClientData;
loadClientData=async function(id){clearRestTimer();shoppingChecks.clear();return dailyToolsLoadClient(id);};
const dailyToolsRenderClient=renderClient;
renderClient=function(){if(restState.owner&&restState.owner!==restOwner())clearRestTimer();return dailyToolsRenderClient();};
const dailyToolsClientTraining=clientTraining;
clientTraining=function(){if(restState.owner&&restState.owner!==restOwner())clearRestTimer();return dailyToolsClientTraining();};
window.addEventListener('pagehide',clearRestTimer);

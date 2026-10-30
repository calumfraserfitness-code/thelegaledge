/* Recorded lifts first. No inferred intake, invented goals or synthetic chart points. */
(function(){
 'use strict';const selected=new Map(),filters=new Map();
 const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 function classification(name){
  const n=String(name||'').toLowerCase();
  if(/boxing|treadmill|elliptic|cross.?trainer|cycling|\bbike\b|\bswim|\brun\b|jog|zumba|dance|warm.?up|cool.?down|stretch|mobility|breath/.test(n)||(/\bwalk(?:ing)?\b/.test(n)&&!/lunge/.test(n)))return null;
  if(/crunch|plank|dead.?bug|bird.?dog|leg raise|knee raise|sit.?up|russian twist/.test(n))return {area:'core',pattern:'core'};
  if(/squat|leg press|lunge|leg curl|hamstring|romanian|\brdl\b|deadlift|hip thrust|glute|calf|calves|leg extension|hip abduc|hip adduc/.test(n))return {area:'lower',pattern:'lower'};
  if(/upright row|lateral raise/.test(n))return {area:'upper',pattern:'shoulder'};
  if(/row|pull.?up|pull.?down|pulldown|bicep|hammer curl|preacher|incline.*curl|face pull|reverse fly/.test(n))return {area:'upper',pattern:'pull'};
  if(/press|push.?up|pushdown|tricep|fly|pec deck|lateral raise|upright row|\bdip\b/.test(n))return {area:'upper',pattern:'push'};
  return {area:'other',pattern:'other'};
 }
 function resistanceType(r,data){
  const session=(data.sessions||[]).find(s=>s.id===r.training_session_id),ex=(data.exercises||[]).find(e=>e.id===r.program_exercise_id),day=(data.programs||[]).flatMap(p=>p.days||[]).find(d=>d.id===ex?.program_day_id);
  const types=[session?.training_type,day?.training_type,r.source_metadata?.training_type].filter(Boolean).map(t=>String(t).toLowerCase());
  return types.length>0&&types.every(t=>['weights','resistance','strength'].includes(t));
 }
 function series(client,data,preview=false){
  const names=new Map((data.exercises||[]).map(e=>[e.id,e.name])),groups=new Map();
  for(const r of data.exerciseLogs||[]){
   if(r.client_id!==client.id&&!(preview&&!r.client_id))continue;
   if(!valid(r.load)||Number(r.load)<0||!valid(r.reps)||Number(r.reps)<=0||!Number.isFinite(+new Date(r.performed_at)))continue;
   const unit=['lb','lbs'].includes(r.load_unit)?'lb':r.load_unit==='kg'?'kg':!r.load_unit?(client.weight_unit==='lbs'?'lb':'kg'):null;if(!unit)continue;
   const name=String(r.exercise_name||names.get(r.program_exercise_id)||'Exercise name unavailable').trim(),kind=classification(name),key=(name==='Exercise name unavailable'?r.program_exercise_id||r.id:name.toLowerCase())+'|'+unit;
   if(!kind||!resistanceType(r,data))continue;
   if(!groups.has(key))groups.set(key,{key,name,unit,...kind,all:[]});
   let day;try{day=new Intl.DateTimeFormat('en-CA',{timeZone:client.timezone||'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.performed_at));}catch{day=String(r.performed_at).slice(0,10);}
   groups.get(key).all.push({...r,day,load:Number(r.load),reps:Number(r.reps)});
  }
  return [...groups.values()].map(g=>{const days=new Map();for(const r of g.all){const prior=days.get(r.day);if(!prior||r.load>prior.load||r.load===prior.load&&r.reps>prior.reps)days.set(r.day,r);}return {...g,rows:[...days.values()].sort((a,b)=>a.day.localeCompare(b.day))};}).sort((a,b)=>b.rows.at(-1).day.localeCompare(a.rows.at(-1).day)||a.name.localeCompare(b.name));
 }
 function plot(rows,field,unit){
  const values=rows.map(r=>r[field]),low=Math.min(...values),high=Math.max(...values),span=high-low||Math.max(high*.1,1),min=Math.max(0,low-span*.2),max=high+span*.2;
  const start=+new Date(rows[0].day+'T12:00:00Z'),end=+new Date(rows.at(-1).day+'T12:00:00Z');
  const y=v=>207-(v-min)/(max-min)*174,num=v=>Number(v.toFixed(1)),date=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
  const points=rows.map(r=>({x:end===start?300:66+(+new Date(r.day+'T12:00:00Z')-start)/(end-start)*480,y:y(r[field]),r}));
  const label=(field==='load'?'Recorded weight':'Recorded reps')+' · '+unit;
  const grid=[min,(min+max)/2,max].map(v=>'<path d="M66 '+y(v)+'H552" stroke="#e3e9f1" stroke-dasharray="4 5"/><text x="48" y="'+(y(v)+4)+'" text-anchor="end">'+num(v)+'</text>').join('');
  const line=points.map(p=>p.x+','+p.y).join(' '),last=points.at(-1);
  return '<figure class="pf-plot"><figcaption>'+esc(label)+'<strong>'+esc(num(last.r[field])+' '+unit)+'</strong></figcaption><svg viewBox="0 0 600 260" role="img" aria-label="'+esc(label)+': '+rows.length+' recorded training dates">'+grid+'<path d="M66 207H552" stroke="#aab9cb"/>'+(points.length>1?'<polygon points="'+points[0].x+',207 '+line+' '+last.x+',207" fill="#b59a641a"/><polyline points="'+line+'" fill="none" stroke="#173c66" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>':'')+points.map((p,i)=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="6" fill="#b59a64" stroke="#fff" stroke-width="2"><title>'+esc(p.r.day+' · '+p.r[field]+' '+unit)+'</title></circle>'+((points.length<=8||i===points.length-1)?'<text x="'+p.x+'" y="'+(p.y-13)+'" text-anchor="middle" class="pf-point-label">'+esc(num(p.r[field]))+'</text>':'')).join('')+'<text x="66" y="237">'+esc(date(rows[0].day))+'</text><text x="550" y="237" text-anchor="end">'+esc(date(rows.at(-1).day))+'</text></svg></figure>';
 }
 strengthProgressMarkup=function(){
  const all=series(state.client,state.data,state.preview),filter=filters.get(state.client.id)||'all',visible=all.filter(g=>filter==='all'||g.area===filter||g.pattern===filter),chosen=visible.find(g=>g.key===selected.get(state.client.id))||visible.find(g=>g.area!=='core')||visible[0];
  const tabs=[['all','All resistance'],['upper','Upper body'],['lower','Lower body'],['push','Push'],['pull','Pull'],['core','Core'],['other','Other resistance']].map(([key,label])=>{const count=all.filter(g=>key==='all'||g.area===key||g.pattern===key).length;return count||key==='all'?'<button type="button" data-strength-group="'+key+'" aria-pressed="'+(filter===key)+'">'+label+' <span>'+count+'</span></button>':'';}).join('');
  const top='<section class="panel strength-progress pf-strength"><span class="eyebrow">RESISTANCE TRAINING ONLY</span><h2>Your strength progress</h2><p>Compare the same lift over time. Boxing, walking and cardio stay out of these charts.</p><nav class="pf-groups" aria-label="Strength exercise groups">'+tabs+'</nav>';
  if(!chosen)return top+'<div class="pf-empty"><h3>Your first recorded set starts here.</h3><p>Open Training and save the weight and reps you actually complete. We won’t draw a trend until there are recorded sets.</p><button type="button" class="btn primary" data-pf-route="training">Open Training</button></div></section>';
  const last=chosen.rows.at(-1),prior=chosen.rows.at(-2),show=r=>Number(r.load.toFixed(1))+' '+chosen.unit+' × '+r.reps+' reps';
  return top+'<label class="pf-select">Choose an exercise<select data-strength-exercise>'+visible.map(g=>'<option value="'+esc(g.key)+'" '+(g.key===chosen.key?'selected':'')+'>'+esc(g.name+' · '+g.unit)+'</option>').join('')+'</select></label><div class="pf-lift-summary"><div><small>LATEST BEST SET · '+esc(last.day)+'</small><strong>'+esc(show(last))+'</strong></div><div><small>PREVIOUS TRAINING DATE</small><strong>'+esc(prior?show(prior):'First baseline')+'</strong></div><div><small>RECORDED DATES</small><strong>'+chosen.rows.length+'</strong></div></div>'+(chosen.rows.length===1?'<p class="pf-baseline">One training date recorded. This is a baseline, not a progress trend yet.</p>':'')+'<div class="pf-charts">'+plot(chosen.rows,'load',chosen.unit)+plot(chosen.rows,'reps','reps')+'</div><p class="pf-method">Each point uses the heaviest recorded set that day; highest reps break a tie. More weight with fewer reps does not automatically mean improved strength. Exercises are grouped for navigation, never summed into a misleading upper/lower strength score.</p><details><summary>View dated sets</summary>'+chosen.all.slice().sort((a,b)=>String(b.performed_at).localeCompare(String(a.performed_at))).slice(0,80).map(r=>'<div class="note-row"><b>'+esc(r.day)+' · set '+esc(r.set_number??'—')+'</b><span>'+esc(show(r))+'</span></div>').join('')+(chosen.all.length>80?'<p>Showing the latest 80 sets for this exercise.</p>':'')+'</details></section>';
 };
 function watchMarkup(){
  const rows=(state.data.healthDaily||[]).filter(r=>(r.client_id===state.client?.id||state.preview&&!r.client_id)&&['apple_health','health_connect','fitbit','google_health','garmin','whoop','oura'].includes(r.source)&&['steps','sleep_minutes','resting_heart_rate','weight_kg'].some(k=>valid(r[k]))).sort((a,b)=>String(b.date).localeCompare(String(a.date))),r=rows[0];if(!r)return '';
  const value=(k,unit)=>valid(r[k])?Number(Number(r[k]).toFixed(1)).toLocaleString()+' '+unit:'Not shared',lbs=state.client.weight_unit==='lbs';
  const metrics=[['STEPS',value('steps','steps')],['SLEEP',valid(r.sleep_minutes)?(Number(r.sleep_minutes)/60).toFixed(1)+' hours':'Not shared'],['RESTING HEART RATE',value('resting_heart_rate','bpm')],['BODY WEIGHT',valid(r.weight_kg)?(Number(r.weight_kg)*(lbs?2.2046226218:1)).toFixed(1)+(lbs?' lb':' kg'):'Not shared']];
  return '<section class="panel pf-watch"><span class="eyebrow">RECEIVED WATCH DATA</span><h2>Your latest readings</h2><p>Recorded '+esc(r.date)+' · '+esc(r.source.replaceAll('_',' '))+'. Received records, not a promise of live syncing.</p><div class="pf-lift-summary">'+metrics.map(([label,v])=>'<div><small>'+label+'</small><strong>'+esc(v)+'</strong></div>').join('')+'</div><button type="button" class="btn ghost" data-pf-route="health">View health reports</button></section>';
 }
 function datedTable(host){
  const chart=host.querySelector('.pf-strength');if(!chart||chart.querySelector('.pf-dates'))return;
  const all=series(state.client,state.data,state.preview),choice=chart.querySelector('[data-strength-exercise]')?.value,g=all.find(g=>g.key===choice);if(!g)return;
  const rows=g.rows.slice(-12).reverse();
  chart.querySelector('.pf-charts').insertAdjacentHTML('afterend','<div class="pf-dates"><table><caption>Weight and reps together · latest '+rows.length+' dates</caption><thead><tr><th>Date</th><th>Recorded load</th><th>Reps at that load</th></tr></thead><tbody>'+rows.map(r=>'<tr><th scope="row">'+esc(r.day)+'</th><td>'+esc(Number(r.load.toFixed(1))+' '+g.unit)+'</td><td>'+esc(r.reps)+'</td></tr>').join('')+'</tbody></table></div>');
 }
 window.LegalEdgeStrength={series,classification,watchMarkup};
 function bind(host){if(!host)return;const client=state.client?.id,user=state.user?.id,active=()=>state.client?.id===client&&state.user?.id===user;
  datedTable(host);
  host.querySelectorAll('[data-strength-exercise]').forEach(select=>select.onchange=()=>{if(!active()||!select.isConnected)return;selected.set(client,select.value);select.closest('.pf-strength').outerHTML=strengthProgressMarkup();bind(host);});
  host.querySelectorAll('[data-strength-group]').forEach(button=>button.onclick=()=>{if(!active()||!button.isConnected)return;filters.set(client,button.dataset.strengthGroup);button.closest('.pf-strength').outerHTML=strengthProgressMarkup();bind(host);});
  host.querySelectorAll('[data-pf-route]').forEach(b=>b.onclick=()=>{if(!active()||!b.isConnected)return;if(state.role==='coach'&&!document.querySelector('#clientApp:not(.hidden)')){state.clientTab=({training:'training',health:'connections',checkin:'check-ins'})[b.dataset.pfRoute]||'progress';renderCoach();}else{state.clientView=b.dataset.pfRoute;renderClient();}});
 }
 function first(host){const chart=host?.querySelector('.pf-strength');if(chart){const heading=host.querySelector('.page-head');if(heading)heading.after(chart);else host.prepend(chart);const watch=watchMarkup();host.querySelectorAll('.pf-watch').forEach(n=>n.remove());if(watch){host.querySelector('.health-summary')?.remove();chart.insertAdjacentHTML('beforebegin',watch);}}bind(host);}
 const client=clientProgress;clientProgress=function(){const r=client();first($('#clientMain'));return r;};
 const coach=coachProgress;coachProgress=function(){const r=coach();first($('#clientWorkspaceBody'));const panel=$('#coachProgressForm')?.closest('.panel');if(panel&&!panel.closest('details')){const detail=document.createElement('details');detail.className='pf-history-entry';detail.innerHTML='<summary>Add or backdate a progress entry</summary>';panel.before(detail);detail.append(panel);}return r;};
 const goals=coachingGoalsMarkup;coachingGoalsMarkup=function(){const box=document.createElement('div');box.innerHTML=goals();const heading=box.querySelector('h2');if(heading)heading.textContent='Your focus';box.querySelectorAll('.cw-lines').forEach(p=>{const full=p.textContent,at=full.search(/\b(?:Source:|Recorded:)/i);if(at<0)return;p.textContent=full.slice(0,at).trim();const detail=document.createElement('details');detail.innerHTML='<summary>Coach reference & recorded date</summary>';const text=document.createElement('p');text.textContent=full.slice(at);detail.append(text);p.after(detail);});return box.innerHTML;};
 const support=clientCoachingSupport;clientCoachingSupport=function(){const r=support(),host=$('#clientMain'),contact=host.querySelector('#coachContact');if(contact){contact.className='panel pf-coaching-hub';contact.innerHTML='<span class="eyebrow">YOUR COACHING</span><h2>Your next step, made simple.</h2><p>Complete your sessions, record your lifts and fill in your weekly check-in. Keep food tracking optional.</p><div class="pf-hub-actions"><button class="btn primary" data-pf-route="progress">View my progress</button><button class="btn ghost" data-pf-route="training">Open Training</button><button class="btn ghost" data-pf-route="checkin">Weekly check-in</button></div><p class="muted">Need Calum? Use your usual private coaching chat. Nothing on this page sends an email.</p>';contact.insertAdjacentHTML('afterend',strengthProgressMarkup());}first(host);return r;};
})();

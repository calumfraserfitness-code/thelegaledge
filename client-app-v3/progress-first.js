/* Recorded lifts first. No inferred intake, invented goals or synthetic chart points. */
(function(){
 'use strict';const selected=new Map();
 const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 function series(client,data,preview=false){
  const names=new Map((data.exercises||[]).map(e=>[e.id,e.name])),groups=new Map();
  for(const r of data.exerciseLogs||[]){
   if(r.client_id!==client.id&&!(preview&&!r.client_id))continue;
   if(!valid(r.load)||Number(r.load)<0||!valid(r.reps)||Number(r.reps)<=0||!Number.isFinite(+new Date(r.performed_at)))continue;
   const unit=['lb','lbs'].includes(r.load_unit)?'lb':r.load_unit==='kg'?'kg':!r.load_unit?(client.weight_unit==='lbs'?'lb':'kg'):null;if(!unit)continue;
   const name=String(r.exercise_name||names.get(r.program_exercise_id)||'Exercise name unavailable').trim(),key=(name==='Exercise name unavailable'?r.program_exercise_id||r.id:name.toLowerCase())+'|'+unit;
   if(!groups.has(key))groups.set(key,{key,name,unit,all:[]});
   let day;try{day=new Intl.DateTimeFormat('en-CA',{timeZone:client.timezone||'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.performed_at));}catch{day=String(r.performed_at).slice(0,10);}
   groups.get(key).all.push({...r,day,load:Number(r.load),reps:Number(r.reps)});
  }
  return [...groups.values()].map(g=>{const days=new Map();for(const r of g.all){const prior=days.get(r.day);if(!prior||r.load>prior.load||r.load===prior.load&&r.reps>prior.reps)days.set(r.day,r);}return {...g,rows:[...days.values()].sort((a,b)=>a.day.localeCompare(b.day))};}).sort((a,b)=>b.rows.at(-1).day.localeCompare(a.rows.at(-1).day)||a.name.localeCompare(b.name));
 }
 function plot(rows,field,unit){
  const values=rows.map(r=>r[field]),low=Math.min(...values),high=Math.max(...values),span=high-low||Math.max(high*.1,1),min=Math.max(0,low-span*.15),max=high+span*.15;
  const start=+new Date(rows[0].day+'T12:00:00Z'),end=+new Date(rows.at(-1).day+'T12:00:00Z');
  const points=rows.map(r=>({x:end===start?260:48+(+new Date(r.day+'T12:00:00Z')-start)/(end-start)*420,y:160-(r[field]-min)/(max-min)*116,r}));
  const label=(field==='load'?'Recorded weight':'Recorded reps')+' · '+unit;
  return '<figure class="pf-plot"><figcaption>'+esc(label)+'</figcaption><svg viewBox="0 0 520 200" role="img" aria-label="'+esc(label)+': '+rows.length+' recorded training dates"><path d="M48 26V164H474" fill="none" stroke="#c7d2df"/><text x="4" y="40">'+esc(Number(high.toFixed(1)))+'</text><text x="4" y="163">'+esc(Number(low.toFixed(1)))+'</text>'+(points.length>1?'<polyline points="'+points.map(p=>p.x+','+p.y).join(' ')+'" fill="none" stroke="#b59a64" stroke-width="3"/>':'')+points.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="5" fill="#10243c"><title>'+esc(p.r.day+' · '+p.r[field]+' '+unit)+'</title></circle>').join('')+'<text x="48" y="190">'+esc(rows[0].day)+'</text><text x="470" y="190" text-anchor="end">'+esc(rows.at(-1).day)+'</text></svg></figure>';
 }
 strengthProgressMarkup=function(){
  const all=series(state.client,state.data,state.preview),chosen=all.find(g=>g.key===selected.get(state.client.id))||all[0];
  const top='<section class="panel strength-progress pf-strength"><span class="eyebrow">YOUR LIFTING PROGRESS</span><h2>See your strength build.</h2><p>From saved weights and reps. Food logging is not required.</p>';
  if(!chosen)return top+'<div class="pf-empty"><h3>Your first recorded set starts here.</h3><p>Open Training and save the weight and reps you actually complete. We won’t draw a trend until there are recorded sets.</p><button type="button" class="btn primary" data-pf-route="training">Open Training</button></div></section>';
  const last=chosen.rows.at(-1),prior=chosen.rows.at(-2),show=r=>r.load+' '+chosen.unit+' × '+r.reps+' reps';
  return top+'<label class="pf-select">Choose an exercise<select data-strength-exercise>'+all.map(g=>'<option value="'+esc(g.key)+'" '+(g.key===chosen.key?'selected':'')+'>'+esc(g.name+' · '+g.unit)+'</option>').join('')+'</select></label><div class="pf-lift-summary"><div><small>LATEST BEST SET · '+esc(last.day)+'</small><strong>'+esc(show(last))+'</strong></div><div><small>PREVIOUS TRAINING DATE</small><strong>'+esc(prior?show(prior):'First baseline')+'</strong></div><div><small>RECORDED DATES</small><strong>'+chosen.rows.length+'</strong></div></div>'+(chosen.rows.length===1?'<p class="pf-baseline">One training date recorded. This is a baseline, not a progress trend yet.</p>':'')+'<div class="pf-charts">'+plot(chosen.rows,'load',chosen.unit)+plot(chosen.rows,'reps','reps')+'</div><p class="pf-method">Each point uses the heaviest recorded set that day; highest reps break a tie. More weight with fewer reps does not automatically mean improved strength. Different exercise names and units stay separate.</p><details><summary>View dated sets</summary>'+chosen.all.slice().sort((a,b)=>String(b.performed_at).localeCompare(String(a.performed_at))).slice(0,80).map(r=>'<div class="note-row"><b>'+esc(r.day)+' · set '+esc(r.set_number??'—')+'</b><span>'+esc(show(r))+'</span></div>').join('')+(chosen.all.length>80?'<p>Showing the latest 80 sets for this exercise.</p>':'')+'</details></section>';
 };
 window.LegalEdgeStrength={series};
 function bind(host){if(!host)return;const client=state.client?.id,user=state.user?.id,active=()=>state.client?.id===client&&state.user?.id===user;
  host.querySelectorAll('[data-strength-exercise]').forEach(select=>select.onchange=()=>{if(!active()||!select.isConnected)return;selected.set(client,select.value);select.closest('.pf-strength').outerHTML=strengthProgressMarkup();bind(host);});
  host.querySelectorAll('[data-pf-route]').forEach(b=>b.onclick=()=>{if(!active()||!b.isConnected)return;if(state.role==='coach'&&!document.querySelector('#clientApp:not(.hidden)')){state.clientTab=b.dataset.pfRoute==='training'?'training':'progress';renderCoach();}else{state.clientView=b.dataset.pfRoute;renderClient();}});
 }
 function first(host){const chart=host?.querySelector('.pf-strength');if(chart){const heading=host.querySelector('.page-head');if(heading)heading.after(chart);else host.prepend(chart);}bind(host);}
 const client=clientProgress;clientProgress=function(){const r=client();first($('#clientMain'));return r;};
 const coach=coachProgress;coachProgress=function(){const r=coach();first($('#clientWorkspaceBody'));const panel=$('#coachProgressForm')?.closest('.panel');if(panel&&!panel.closest('details')){const detail=document.createElement('details');detail.className='pf-history-entry';detail.innerHTML='<summary>Add or backdate a progress entry</summary>';panel.before(detail);detail.append(panel);}return r;};
 const goals=coachingGoalsMarkup;coachingGoalsMarkup=function(){const box=document.createElement('div');box.innerHTML=goals();const heading=box.querySelector('h2');if(heading)heading.textContent='Your focus';box.querySelectorAll('.cw-lines').forEach(p=>{const full=p.textContent,at=full.search(/\b(?:Source:|Recorded:)/i);if(at<0)return;p.textContent=full.slice(0,at).trim();const detail=document.createElement('details');detail.innerHTML='<summary>Coach reference & recorded date</summary>';const text=document.createElement('p');text.textContent=full.slice(at);detail.append(text);p.after(detail);});return box.innerHTML;};
 const support=clientCoachingSupport;clientCoachingSupport=function(){const r=support(),host=$('#clientMain'),contact=host.querySelector('#coachContact');if(contact){contact.className='panel pf-coaching-hub';contact.innerHTML='<span class="eyebrow">YOUR COACHING</span><h2>Your next step, made simple.</h2><p>Complete your sessions, record your lifts and fill in your weekly check-in. Keep food tracking optional.</p><div class="pf-hub-actions"><button class="btn primary" data-pf-route="progress">View my progress</button><button class="btn ghost" data-pf-route="training">Open Training</button><button class="btn ghost" data-pf-route="checkin">Weekly check-in</button></div><p class="muted">Need Calum? Use your usual private coaching chat. Nothing on this page sends an email.</p>';contact.insertAdjacentHTML('afterend',strengthProgressMarkup());}bind(host);return r;};
})();

/* Actual cardio results, kept separate by activity and below other progress. */
(function(){
 'use strict';const selected=new Map(),valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 function series(client,data){
  const weeks=new Set((data.weeks||[]).filter(w=>w.client_id===client.id||state.preview&&!w.client_id).map(w=>w.id)),groups=new Map();
  for(const s of data.sessions||[]){if(!weeks.has(s.week_id)||s.training_type!=='cardio')continue;const a=s.source_metadata?.cardio_log;if(!a||!valid(a.duration_minutes)||Number(a.duration_minutes)<=0)continue;
   let day;try{day=s.source_system==='client_manual_cardio'?s.session_date:s.source_metadata?.completion_receipt?.local_date||window.CheckinStatus.localDate(new Date(a.logged_at),client.timezone||'Europe/Dublin');}catch{continue;}if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))continue;
   const name=String(a.activity||'Cardio').trim(),key=name.toLowerCase();if(!groups.has(key))groups.set(key,{key,name,rows:[]});groups.get(key).rows.push({day,duration:Number(a.duration_minutes),distance:valid(a.distance_km)?Number(a.distance_km):null,heart_rate:valid(a.heart_rate)?Number(a.heart_rate):null,rpe:valid(a.rpe)?Number(a.rpe):null});
  }return [...groups.values()].map(g=>({...g,rows:g.rows.sort((a,b)=>a.day.localeCompare(b.day))}));
 }
 function markup(){const groups=series(state.client,state.data),choice=groups.find(g=>g.key===selected.get(state.client.id))||groups[0],top='<section class="panel cardio-progress"><span class="eyebrow">RECORDED CARDIO</span><h2>Cardio progress</h2><p>Your saved time and distance for each activity.</p>';
  if(!choice)return top+'<p>No actual cardio results recorded yet. Save your completed cardio time in Training to start this history.</p></section>';
  const rows=choice.rows,last=rows.at(-1),distance=rows.filter(r=>r.distance!==null),plot=window.LegalEdgeStrength.plot;
  return top+'<label>Choose an activity<select data-cardio-progress>'+groups.map(g=>'<option value="'+esc(g.key)+'" '+(g.key===choice.key?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select></label><div class="pf-lift-summary"><div><small>LATEST RECORDED TIME</small><strong>'+esc(last.duration)+' min</strong></div><div><small>LATEST DISTANCE</small><strong>'+esc(last.distance===null?'Not recorded':last.distance+' km')+'</strong></div><div><small>RECORDED SESSIONS</small><strong>'+rows.length+'</strong></div></div>'+(rows.length===1?'<p>One recorded session is a baseline.</p>':'')+'<div class="pf-charts">'+plot(rows,'duration','min','Recorded cardio time')+(distance.length?plot(distance,'distance','km','Recorded distance'):'')+'</div><p class="muted">These charts show the work recorded. Longer sessions or greater distance alone do not establish improved fitness.</p><details><summary>View saved cardio results</summary>'+rows.slice().reverse().slice(0,40).map(r=>'<div class="note-row"><b>'+esc(r.day)+'</b><span>'+esc(r.duration+' min'+(r.distance===null?'':' · '+r.distance+' km')+(r.heart_rate===null?'':' · '+r.heart_rate+' bpm')+(r.rpe===null?'':' · RPE '+r.rpe+'/10'))+'</span></div>').join('')+'</details></section>';
 }
 function mount(host){if(!host||!state.client)return;host.querySelector('.cardio-progress')?.remove();host.insertAdjacentHTML('beforeend',markup());const select=host.querySelector('[data-cardio-progress]'),user=state.user?.id,id=state.client.id;if(select)select.onchange=()=>{if(select.isConnected&&state.user?.id===user&&state.client?.id===id){selected.set(id,select.value);mount(host);}};}
 const client=clientProgress;clientProgress=function(){const r=client();mount($('#clientMain'));return r;};
 const coach=coachProgress;coachProgress=function(){const r=coach();mount($('#clientWorkspaceBody'));return r;};
 window.LegalEdgeCardio={series};
})();

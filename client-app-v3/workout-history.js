/* Read-only dated workout records shared by the coach and client progress views. */
(function(){
 'use strict';
 function historyMarkup(){
  const d=state.data,c=state.client;if(!c)return '';
  const weeks=new Set((d.weeks||[]).filter(w=>!w.client_id||w.client_id===c.id).map(w=>w.id));
  const logs=(d.exerciseLogs||[]).filter(r=>!r.client_id||r.client_id===c.id);
  const sessions=(d.sessions||[]).filter(s=>(weeks.has(s.week_id)||(s.source_system==='legacy_client_session_logs'&&s.source_metadata?.client_id===c.source_id))&&(s.source_system==='legacy_client_session_logs'||logs.some(l=>l.training_session_id===s.id))).sort((a,b)=>String(b.session_date).localeCompare(String(a.session_date))||String(b.completed_at||'').localeCompare(String(a.completed_at||'')));
  if(!sessions.length)return '';
  const unit=c.weight_unit==='lbs'?'lb':'kg',number=v=>v===null||v===undefined||v===''?'—':Number(v).toLocaleString(undefined,{maximumFractionDigits:1});
  const weight=r=>{if(r.load===null||r.load===undefined)return '—';return number(Number(r.load)*((r.load_unit||unit)===unit?1:unit==='lb'?2.2046226218:1/2.2046226218));};
  return '<details class="panel wh-history"><summary>Workout history · '+sessions.length+' recorded workouts</summary><p>Open a date to see actual recorded sets. A dash means no value was entered. Imported records retain their original workout dates.</p>'+sessions.map(s=>{
   const own=logs.filter(l=>l.training_session_id===s.id),original=s.source_metadata;
   if(original?.client_id&&original.client_id!==c.source_id)return '';
   let exercises;
   if(Array.isArray(original?.exercises_logged))exercises=original.exercises_logged.map(ex=>({name:ex.exercise_name,sets:(ex.sets||[]).map(raw=>{const saved=own.find(l=>l.source_metadata?.source_exercise_id===ex.exercise_id&&Number(l.set_number)===Number(raw.set_number));return saved||{set_number:raw.set_number,load:raw.weight_kg,load_unit:'kg',reps:raw.reps_completed,duration_seconds:raw.duration_seconds,source_metadata:{original_set:raw}};})}));
   else {const names=new Map();for(const row of own){const name=row.exercise_name||(d.exercises||[]).find(e=>e.id===row.program_exercise_id)?.name||'Exercise';if(!names.has(name))names.set(name,[]);names.get(name).push(row);}exercises=[...names].map(([name,sets])=>({name,sets:sets.sort((a,b)=>a.set_number-b.set_number)}));}
   return '<details class="wh-workout"><summary><b>'+esc(s.title)+'</b><span>'+esc(fmt(s.session_date))+' · '+exercises.length+' exercises</span></summary>'+exercises.map(ex=>{const timed=ex.sets.some(r=>r.duration_seconds!=null),distance=ex.sets.some(r=>r.source_metadata?.original_set?.distance_meters!=null);return '<details class="wh-exercise"><summary>'+esc(ex.name)+'</summary><div class="wh-table"><table><thead><tr><th>Set</th><th>Weight ('+unit+')</th><th>Reps</th>'+(timed?'<th>Seconds</th>':'')+(distance?'<th>Metres</th>':'')+'</tr></thead><tbody>'+ex.sets.map(r=>'<tr><td>'+esc(r.set_number)+'</td><td>'+esc(weight(r))+'</td><td>'+esc(number(r.reps))+'</td>'+(timed?'<td>'+esc(number(r.duration_seconds))+'</td>':'')+(distance?'<td>'+esc(number(r.source_metadata?.original_set?.distance_meters))+'</td>':'')+'</tr>').join('')+'</tbody></table></div></details>';}).join('')+'</details>';
  }).join('')+'</details>';
 }
 const progress=progressDashboardMarkup;progressDashboardMarkup=function(){return progress()+historyMarkup();};
 const training=clientTraining;clientTraining=function(){const result=training(),host=$('#clientMain');if(host&&state.client){host.querySelector('.wh-history')?.remove();host.insertAdjacentHTML('beforeend',historyMarkup());}return result;};
 let historyLoadSequence=0;const load=loadClientData;loadClientData=async function(id){const request=++historyLoadSequence,user=state.user?.id,role=state.role;if(await load(id)===false||request!==historyLoadSequence||state.client?.id!==id||state.user?.id!==user||state.role!==role)return false;if(state.preview)return true;const rows=await query('Recorded workout history',db.rpc('client_recorded_workouts',{p_client:id}));if(request!==historyLoadSequence||state.user?.id!==user||state.client?.id!==id||state.role!==role)return false;const merged=new Map((state.data.sessions||[]).map(s=>[s.id,s]));for(const row of rows)merged.set(row.id,row);state.data.sessions=[...merged.values()];return true;};
 window.WorkoutHistory={markup:historyMarkup};
})();

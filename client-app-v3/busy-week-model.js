/* Rules choose a focus for the week; prescribed exercises and food targets remain authoritative. */
(function(root){
 'use strict';
 const labels={normal:'Normal week',heavy:'Heavy week',crisis:'Crisis minimum',review:'Coach review'};
 function assess(v){
  const reasons=[];let mode='normal';
  if(v.health!=='none'){mode='review';reasons.push(v.health==='injury'?'Injury reported':'Illness reported');}
  else{
   if(v.training_windows<2)reasons.push('Fewer than two training windows');
   if(v.work_hours>=60)reasons.push('60+ working hours');
   if(v.sleep_hours<5)reasons.push('Less than five hours of sleep');
   if(v.energy<=2)reasons.push('Low energy');if(v.recovery<=2)reasons.push('Low recovery');
   if(reasons.length)mode='crisis';else{
    if(v.work_hours>=45)reasons.push('A demanding work schedule');if(v.training_windows===2)reasons.push('Two available training windows');
    if(v.sleep_hours<6.5)reasons.push('Less sleep than usual');if(v.energy===3||v.recovery===3)reasons.push('Recovery needs attention');if(v.meal_access==='limited')reasons.push('Limited meal access');
    if(reasons.length)mode='heavy';
   }
  }
  if(v.travel)reasons.push('Travel alternatives needed');if(v.location!=='gym')reasons.push(v.location==='home'?'Training at home':'Hotel equipment');
  return {mode,label:labels[mode],reasons:reasons.length?reasons:['Your regular plan fits the week']};
 }
 function focus(v,settings,sessions){
  const a=assess(v),all=sessions.filter(s=>['weights','resistance','cardio'].includes(s.training_type)).sort((x,y)=>String(x.session_date).localeCompare(String(y.session_date))||String(x.id).localeCompare(String(y.id)));
  const cap=a.mode==='review'?0:a.mode==='normal'?v.training_windows:Math.min(v.training_windows,settings?.published?(a.mode==='heavy'?settings.heavy_sessions:settings.crisis_sessions):(a.mode==='heavy'?2:1));
  const done=all.filter(s=>s.status==='completed'),pending=all.filter(s=>s.status==='planned'),priority=pending.slice(0,Math.max(0,cap-done.length));
  return {...a,cap,done:done.length,priority,optional:pending.slice(priority.length),short:priority.filter(s=>s.duration_minutes&&s.duration_minutes>v.session_minutes),travel:v.travel||v.location==='hotel'};
 }
 root.BusyWeekModel={labels,assess,focus};
})(typeof window==='undefined'?globalThis:window);

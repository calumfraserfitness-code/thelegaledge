/* Distinct saved weigh-in dates in the client's local Monday–Sunday week. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WeighInRoutineModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const target=3,dayMs=86400000;
 function day(value){const s=String(value||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s?s:null;}
 function localDate(value,zone){try{const date=value instanceof Date?value:new Date(value);if(!Number.isFinite(+date))return null;const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=type=>parts.find(p=>p.type===type)?.value;return day(get('year')+'-'+get('month')+'-'+get('day'));}catch{return null;}}
 const add=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*dayMs).toISOString().slice(0,10);
 const weekday=date=>new Date(date+'T12:00:00Z').getUTCDay();
 function plan(client,data={},options={}){
  if(!client?.id||client.track_weight===false)return null;
  const zone=client.timezone||'Europe/Dublin',today=localDate(options.now||new Date(),zone);if(!today)return null;
  const weekStart=add(today,-((weekday(today)+6)%7)),weekEnd=add(weekStart,6),dates=new Set(),own=row=>row.client_id===client.id||options.preview&&!row.client_id;
  const valid=row=>own(row)&&row.weight_kg!==null&&row.weight_kg!==undefined&&row.weight_kg!==''&&typeof row.weight_kg!=='boolean'&&Number.isFinite(Number(row.weight_kg))&&Number(row.weight_kg)>0;
  for(const row of data.progress||[]){if(!valid(row))continue;const date=day(row.entry_date);if(date&&date>=weekStart&&date<=today)dates.add(date);}
  for(const row of data.checkins||[]){if(!valid(row))continue;const date=localDate(row.submitted_at,zone);if(date&&date>=weekStart&&date<=today)dates.add(date);}
  const recordedDays=[...dates].sort(),weekendDone=recordedDays.some(date=>[0,6].includes(weekday(date)));
  // Spacing is guidance only: every actual entry is still retained and displayed.
  let spreadDone=false;
  for(let a=0;a<recordedDays.length&&!spreadDone;a++)for(let b=a+1;b<recordedDays.length&&!spreadDone;b++)for(let c=b+1;c<recordedDays.length;c++){
   const chosen=[recordedDays[a],recordedDays[b],recordedDays[c]];
   if((Date.parse(chosen[1])-Date.parse(chosen[0]))/dayMs>=2&&(Date.parse(chosen[2])-Date.parse(chosen[1]))/dayMs>=2&&chosen.some(date=>[0,6].includes(weekday(date)))){spreadDone=true;break;}
  }
  return {weekStart,weekEnd,today,recordedDays,count:recordedDays.length,target,weekendDone,spreadDone,complete:recordedDays.length>=target&&weekendDone&&spreadDone,latestDate:recordedDays.at(-1)||null,daysRemaining:Math.round((Date.parse(weekEnd)-Date.parse(today))/dayMs),example:'Tuesday, Thursday and Saturday'};
 }
 return {plan,localDate};
});

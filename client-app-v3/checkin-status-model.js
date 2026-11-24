/* Dates are calculated in the client's saved timezone, never the server timezone. */
(function(root){
 const recorded=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 function parts(date,zone){return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}
 function localDate(date,zone){const p=parts(date,zone);return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;}
 function week(client,now=new Date()){const d=new Date(localDate(now,client.timezone||'Europe/Dublin')+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
 function weekLabel(start,client,now=new Date()){
  const current=week(client,now);
  const next=new Date(Date.parse(current+'T12:00:00Z')+7*864e5).toISOString().slice(0,10);
  return start===current?'This week':start===next?'Next week':start>current?'Upcoming week':'Past week';
 }
 function due(client,period){if(!recorded(client.checkin_day)||!period||!/^\d{4}-\d{2}-\d{2}$/.test(period)||Number(client.checkin_day)<0||Number(client.checkin_day)>6||!/^\d{2}:\d{2}(:\d{2})?$/.test(client.checkin_due_time||''))return null;try{
  const day=new Date(period+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+(Number(client.checkin_day)+6)%7);const time=client.checkin_due_time.split(':').map(Number);if(time[0]>23||time[1]>59||(time[2]||0)>59)return null;const wanted=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),time[0],time[1],time[2]||0);let instant=wanted;
  for(let i=0;i<4;i++){const p=parts(new Date(instant),client.timezone||'Europe/Dublin'),wall=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);instant+=wanted-wall;}
  const p=parts(new Date(instant),client.timezone||'Europe/Dublin');if(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)!==wanted)return null;return new Date(instant);
 }catch(_){return null;}}
 function timing(checkin,client){if(checkin.source_system&&!/^client_weekly_v[23]$/.test(checkin.source_system))return 'Imported time unverified';const deadline=due(client,checkin.period_start);if(!deadline)return 'Due day not set';const submitted=new Date(checkin.submitted_at);if(!Number.isFinite(+submitted))return 'Submission time unknown';if(submitted>deadline)return 'Late';return localDate(submitted,client.timezone||'Europe/Dublin')<localDate(deadline,client.timezone||'Europe/Dublin')?'Early':'On time';}
 function stamp(value,zone){try{return new Intl.DateTimeFormat('en-GB',{timeZone:zone,dateStyle:'medium',timeStyle:'medium'}).format(new Date(value))+' · '+zone;}catch(_){return 'Time unavailable';}}
 function submissionLabel(checkin){
  const originalDate=checkin.original_date_text?.trim();
  if(originalDate&&!/^client_weekly_v[23]$/.test(checkin.source_system||''))return 'Recorded date '+originalDate;
  if(!Number.isFinite(Date.parse(checkin.submitted_at)))return 'Submission date unavailable';
  const date=new Intl.DateTimeFormat('en-IE',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Dublin'});
  return 'Submitted '+date.format(new Date(checkin.submitted_at));
 }
 function delta(current,previous,key){return recorded(current?.[key])&&recorded(previous?.[key])?Number(current[key])-Number(previous[key]):null;}
 const model={recorded,localDate,week,weekLabel,due,timing,stamp,submissionLabel,delta};root.CheckinStatus=model;if(typeof module!=='undefined')module.exports=model;
})(typeof window==='undefined'?globalThis:window);

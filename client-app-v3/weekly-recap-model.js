/* Dated, owned evidence for an explicitly coach-approved weekly recap. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WeeklyRecapModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const dayMs=86400000,minReadings=3;
 const list=value=>Array.isArray(value)?value:[];
 const text=(value,max=1000)=>typeof value==='string'?value.trim().slice(0,max):'';
 function day(value){const s=typeof value==='string'?value:'';return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s?s:null;}
 function instant(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&day(value.slice(0,10))&&Number.isFinite(Date.parse(value))?new Date(value):null;}
 function localDate(value,zone='Europe/Dublin'){
  try{const date=value instanceof Date?value:new Date(value);if(!Number.isFinite(+date))return null;const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=type=>parts.find(p=>p.type===type)?.value;return day(get('year')+'-'+get('month')+'-'+get('day'));}catch{return null;}
 }
 function addDays(value,n){if(!day(value)||!Number.isInteger(n))return null;return new Date(Date.parse(value+'T12:00:00Z')+n*dayMs).toISOString().slice(0,10);}
 function week(value){if(!day(value))return null;return addDays(value,-((new Date(value+'T12:00:00Z').getUTCDay()+6)%7));}
 function number(value,min,max){if(!['number','string'].includes(typeof value)||String(value).trim()==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;}
 const mean=rows=>rows.length?rows.reduce((sum,row)=>sum+row.value,0)/rows.length:null;
 function weeks(client,options={}){
  const now=options.now||new Date(),today=localDate(now,client?.timezone||'Europe/Dublin'),start=week(today);if(!start)return [];
  const limit=Number.isInteger(options.limit)?Math.min(26,Math.max(1,options.limit)):8;
  return Array.from({length:limit},(_,i)=>{const period_start=addDays(start,-i*7),period_end=addDays(period_start,6);return {period_start,period_end,in_progress:period_end>=today};});
 }
 function build(client,data={},options={}){
  if(!client?.id)throw Error('Choose a client before preparing a weekly recap.');
  const now=options.now instanceof Date?options.now:new Date(options.now||Date.now()),zone=client.timezone||'Europe/Dublin',today=localDate(now,zone),currentWeek=week(today);
  if(!today||!currentWeek)throw Error('A valid client timezone and preparation time are required.');
  const period_start=options.periodStart||options.period_start||addDays(currentWeek,-7);
  if(!day(period_start)||week(period_start)!==period_start||period_start>currentWeek)throw Error('Choose a current or previous Monday–Sunday week.');
  const period_end=addDays(period_start,6),previousStart=addDays(period_start,-7),previousEnd=addDays(period_start,-1),next_week_start=addDays(period_start,7),next_week_end=addDays(period_start,13),in_progress=period_end>=today;
  const own=row=>Boolean(row&&typeof row==='object'&&!Array.isArray(row))&&(row.client_id===client.id||options.preview===true&&!row.client_id),inside=date=>date&&date>=period_start&&date<=period_end&&date<=today;
  const source_refs=[],gaps=['Counts use saved records. Missing logs do not establish missed activity.'],ref=(kind,id,date,basis)=>{if(source_refs.length<100)source_refs.push({kind,id:String(id||''),date,basis});};
  const records=(key,max=4000)=>{const rows=list(data[key]);if(rows.length>max)gaps.push('The loaded '+key+' evidence was capped; review the full history before publishing.');return rows.slice(0,max);};
  const ownedWeeks=new Set(records('weeks').filter(own).map(row=>row.id)),sessionRows=records('sessions').filter(row=>row?.id&&ownedWeeks.has(row.week_id)&&(!row.client_id||own(row)));
  const sessions=new Map();for(const row of sessionRows){const old=sessions.get(row.id);if(!old||String(row.updated_at||row.completed_at||'')>String(old.updated_at||old.completed_at||''))sessions.set(row.id,row);}
  const completed=new Map(),strengthWithSets=new Set(),practiceDays=new Set(),practiceCompleteDays=new Set(),practiceTicks=new Set(),evidence=[];
  let cardioMinutes=0;
  const kind=session=>['weights','resistance','strength'].includes(session.training_type)?'strength':session.training_type==='cardio'?'cardio':'other';
  const eligibleInstant=value=>{const at=instant(value);return at&&+at<=+now?at:null;};
  const receiptDate=receipt=>{const date=day(receipt?.local_date),at=eligibleInstant(receipt?.saved_at);return date&&at?date:null;};
  for(const session of sessions.values()){
   const meta=session.source_metadata&&typeof session.source_metadata==='object'?session.source_metadata:{},practice=['mobility','recovery'].includes(session.training_type);
   if(practice){
    const entries=Object.entries(meta.practice_days||{}).filter(([date])=>inside(day(date))).slice(0,400);
    for(const [dateKey,receipt]of entries){
     const date=day(dateKey);if(!inside(date)||!receipt||typeof receipt!=='object')continue;
     let any=false;
     if(receipt.completed===true&&receiptDate(receipt)===date){any=true;practiceCompleteDays.add(date);ref('practice',session.id,date,'Dated saved whole-practice completion');}
     for(const [exerciseId,tick]of Object.entries(receipt.exercises||{}).slice(0,200)){
      if(tick?.completed!==true||receiptDate(tick)!==date||tick.exercise_id&&String(tick.exercise_id)!==String(exerciseId))continue;
      const key=session.id+'|'+date+'|'+exerciseId;if(practiceTicks.has(key))continue;practiceTicks.add(key);any=true;ref('practice_exercise',exerciseId,date,'Dated saved individual exercise tick');
     }
     if(any)practiceDays.add(date);
    }
    // A non-repeating older completion can be counted only at its recorded instant.
    if(!meta.practice_days&&session.status==='completed'&&!/legacy|import/i.test(session.source_system||'')){
     const at=eligibleInstant(session.completed_at),date=at&&localDate(at,zone);if(inside(date)){practiceDays.add(date);practiceCompleteDays.add(date);ref('practice',session.id,date,'Saved completion time; individual exercise history unavailable');}
    }
    continue;
   }
   if(session.status!=='completed')continue;
   const receipt=meta.completion_receipt,at=eligibleInstant(session.completed_at),manual=session.source_system==='client_manual_cardio';
   let date=null,basis='';
   if(manual&&meta.cardio_log&&eligibleInstant(meta.cardio_log.logged_at)){date=day(session.session_date);basis='Client-chosen saved cardio date';}
   else if(receipt?.completed===true){date=receiptDate(receipt);basis='Dated saved session completion';}
   else if(!receipt&&!/legacy|import/i.test(session.source_system||'')&&at){date=localDate(at,zone);basis='Saved completion time; actor not supplied';}
   if(!inside(date))continue;
   const key=session.id+'|'+date;if(completed.has(key))continue;const entry={session_id:session.id,date,kind:kind(session),basis};completed.set(key,entry);if(evidence.length<100)evidence.push(entry);ref('session',session.id,date,basis);
   if(entry.kind==='cardio'){
    const actual=meta.cardio_log,duration=number(actual?.duration_minutes,1,1440);if(duration!==null&&eligibleInstant(actual.logged_at))cardioMinutes+=duration;
   }
  }
  for(const log of records('exerciseLogs')){
   if(!own(log)||log.completed===false)continue;const session=sessions.get(log.training_session_id);if(!session||kind(session)!=='strength')continue;
   const at=eligibleInstant(log.performed_at),date=at&&localDate(at,zone);if(!inside(date))continue;
   if(number(log.reps,1,1000)===null&&number(log.duration_seconds,1,86400)===null)continue;
   const key=session.id+'|'+date;if(!strengthWithSets.has(key)){strengthWithSets.add(key);ref('set_session',session.id,date,'Session with actual saved exercise sets; not an additional completed session');}
  }
  const completedRows=[...completed.values()],recorded_sessions={completed:completedRows.length,strength:completedRows.filter(row=>row.kind==='strength').length,cardio:completedRows.filter(row=>row.kind==='cardio').length,other:completedRows.filter(row=>row.kind==='other').length,cardio_minutes:cardioMinutes,practice_days:practiceDays.size,practice_completed_days:practiceCompleteDays.size,practice_exercise_ticks:practiceTicks.size,logged_strength:strengthWithSets.size,evidence};
  const weightDays=new Map(),checkins=records('checkins').filter(own).filter(row=>{const at=eligibleInstant(row.submitted_at);return at||day(row.submitted_at)&&row.submitted_at<=today;});
  function weight(row,date,source){const value=number(row.weight_kg,.001,1000);if(value===null||!date||date<previousStart||date>period_end||date>today)return;const values=weightDays.get(date)||[];values.push({value,source,id:row.id,stamp:String(row.updated_at||row.created_at||row.submitted_at||'')});weightDays.set(date,values);}
  if(client.track_weight!==false){
   for(const row of records('progress'))if(own(row))weight(row,day(row.entry_date),'progress');
   for(const row of checkins){const at=eligibleInstant(row.submitted_at);weight(row,at?localDate(at,zone):day(row.submitted_at),'checkin');}
  }
  const canonical=[...weightDays].map(([date,values])=>{
   values.sort((a,b)=>(a.source==='progress'?0:1)-(b.source==='progress'?0:1)||b.stamp.localeCompare(a.stamp)||String(b.id||'').localeCompare(String(a.id||'')));const chosen=values[0];return {date,...chosen,conflict:values.some(row=>Math.abs(row.value-chosen.value)>.001)};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  const currentWeights=canonical.filter(row=>row.date>=period_start),previousWeights=canonical.filter(row=>row.date>=previousStart&&row.date<=previousEnd),summary=rows=>({count:rows.length,days:rows.map(row=>row.date),average_kg:mean(rows)}),current=summary(currentWeights),previous=summary(previousWeights),enabled=client.track_weight!==false;
  const status=!enabled?'disabled':current.count>=minReadings&&previous.count>=minReadings?'trend':current.count>=minReadings?'baseline':'insufficient',conflict_dates=canonical.filter(row=>row.conflict).map(row=>row.date);
  const weightNote=!enabled?'Weight tracking is not part of this plan.':status==='trend'?'Weekly averages from at least three distinct saved dates in each week.':status==='baseline'?'A weekly baseline is available. At least three saved dates in the previous week are needed for a comparison.':'At least three distinct saved dates in each week are needed before showing a weight trend.';
  const weightSummary={enabled,status,minimum_readings:minReadings,current,previous,change_kg:status==='trend'?current.average_kg-previous.average_kg:null,conflict_dates,note:weightNote+(conflict_dates.length?' Different same-day values need confirmation; dated progress entries take precedence.':'')};
  for(const row of canonical)ref('weight',row.id,row.date,row.source==='progress'?'Dated saved progress weight':'Check-in submission date; measurement time not supplied');
  if(enabled)gaps.push('Weight uses saved dates, not verified measurement times. Same-day check-in/progress mirrors count once; weekly health-report summary weights are excluded.');
  const selectedCheckins=checkins.filter(row=>day(row.period_start)?row.period_start===period_start:(()=>{const at=eligibleInstant(row.submitted_at),date=at?localDate(at,zone):day(row.submitted_at);return inside(date);})()).sort((a,b)=>Number(Boolean(day(b.period_start)))-Number(Boolean(day(a.period_start)))||String(b.submitted_at).localeCompare(String(a.submitted_at)));
  function reportedWin(row){if(text(row.wins))return text(row.wins);const answers=row.original_answers;if(!answers||typeof answers!=='object'||Array.isArray(answers))return '';for(const [question,value]of Object.entries(answers))if(/biggest.*win|what went well|wins? this week/i.test(question)&&text(value))return text(value);return '';}
  const winRow=selectedCheckins.find(row=>reportedWin(row)),biggest_win=winRow?reportedWin(winRow):'';
  if(winRow)ref('checkin',winRow.id,period_start,'Client-reported biggest win for the selected week');
  else gaps.push('No client-reported biggest win was found for this selected week. The coach can add a verified win.');
  const focusRows=list(data.focus||data.weeklyFocus).filter(own).filter(row=>!row.archived_at&&eligibleInstant(row.approved_at)&&day(row.starts_on)&&day(row.expires_on)&&row.starts_on<=row.expires_on&&row.starts_on<=next_week_end&&row.expires_on>=next_week_start&&text(row.description)).sort((a,b)=>String(b.approved_at).localeCompare(String(a.approved_at))||String(a.id||'').localeCompare(String(b.id||'')));
  const focus=focusRows.length?text(focusRows[0].description):'';if(focusRows.length)ref('focus',focusRows[0].id,next_week_start,'Existing coach-approved action covering the following week');else gaps.push('No approved action covers the following week. The coach must agree and enter one focus before publishing.');
  if(in_progress)gaps.push('This week is still in progress; the recap is a snapshot through '+today+'.');
  return {version:1,period_start,period_end,next_week_start,next_week_end,timezone:zone,prepared_at:now.toISOString(),in_progress,recorded_sessions,weight:weightSummary,biggest_win,focus,coach_note:'',source_refs,gaps};
 }
 return {build,weeks,week,addDays,localDate,day};
});

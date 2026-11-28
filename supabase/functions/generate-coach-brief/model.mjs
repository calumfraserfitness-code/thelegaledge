/* Bounded, dated source evidence. Source text is data, never model instructions. */
const obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)}),str={type:'string'},strings=(max)=>({type:'array',maxItems:max,items:str});
const finding=obj({text:str,evidence:{type:'array',minItems:1,maxItems:5,items:str}});
export const briefSchema=obj({summary:str,wins:{type:'array',maxItems:5,items:finding},attention:{type:'array',maxItems:5,items:finding},questions:strings(10),suggested_response:str,gaps:strings(8)});
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const pick=(row,keys)=>Object.fromEntries(keys.map(k=>[k,row[k]??null]));
const cut=(v,max=1800)=>String(v??'').slice(0,max);
const date=v=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v):null;
const validNum=v=>['number','string'].includes(typeof v)&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const boundedNum=(v,min,max,integer=false)=>{const n=validNum(v);return n!==null&&n>=min&&n<=max&&(!integer||Number.isInteger(n))?n:null;};
const day=v=>{const d=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d?d:null;};
const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&day(v.slice(0,10))&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const weeklyMetrics={average_steps:[0,150000,true],sleep_hours:[0,24],resting_heart_rate:[20,250],weight_kg:[20,400],workouts:[0,35,true],total_steps:[0,4650000,true],active_zone_minutes:[0,10080,true],calories_burned:[0,15000],distance_km:[0,3000]};
const dailyMetrics={steps:[0,150000,true],sleep_minutes:[0,1440],weight_kg:[20,400],resting_heart_rate:[20,250],active_calories:[0,20000],distance_km:[0,3000],hrv_ms:[0,1000]};
const healthRank={apple_health:1,health_connect:2,fitbit:3,google_health:4,manual:9};
function cleanMetrics(values,definitions){const out={};for(const [key,range]of Object.entries(definitions)){const n=boundedNum(values?.[key],...range);if(n!==null)out[key]=n;}return out;}
function sourceText(v,depth=0){if(depth>4)return '[nested detail omitted]';if(typeof v==='string')return cut(v);if(Array.isArray(v))return v.slice(0,12).map(v=>sourceText(v,depth+1));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).slice(0,24).map(([k,value])=>[cut(k,100),sourceText(value,depth+1)]));return v??null;}
function intakeSections(record){
  const responses=record?.responses||{};
  if(responses.sections&&typeof responses.sections==='object'&&!Array.isArray(responses.sections))return responses.sections;
  if(!responses.text)return responses;
  const out={};let group=null,key=null;
  for(const raw of String(responses.text).slice(0,60000).split(/\r?\n/)){
   const line=raw.trim();if(!line)continue;
   if(['TRAINING','NUTRITION','LIFESTYLE','GOALS'].includes(line)){group=line.toLowerCase();out[group]={};key=null;continue;}
   if(!group)continue;
   if(line.length>4&&!/^(?:NONE|NOT APPLICABLE|YES|NO|N\/A|I)(?:\b|$)/i.test(line)&&/^[A-Z][A-Z0-9 /()–&?_-]+$/.test(line)&&/^(?:FOODS? (?:TO|ALLERG|RESTRICT)|ALLERG|INTOLER|RESTRICT|MEALS? (?:PER|PREP|ROUTINE|ACCESS)|TYPICAL EAT|WORKDAY MEALS|SNACK PREFER|FOOD BUDGET|WEEKEND MEALS|NUTRITION APPROACH|TRACKING SAFETY|TRAINING (?:DAYS|HISTORY|EXPERIENCE|AVAILABILITY|LOCATION|BARRIERS)|PREFERRED (?:TRAINING|TIME|STYLE)|SESSION (?:MINUTES|LENGTH)|BUSY DAY TRAINING|EQUIPMENT|GYM (?:NAME|LOCATION)|INJUR|CURRENT INJUR|MEDICAL (?:SUPPORT|RESTRICT)|EXERCISE RESTRICT|WORK (?:PATTERN|HOURS)|WORKING HOURS|HOURS PER WEEK|LIFESTYLE FACTORS|PRESSURE PATTERN|SUPPORT PREFER|GOALS?$|HEIGHT|WEIGHT|CURRENT WEIGHT|DATE OF BIRTH|EMAIL|PHONE|ADDRESS|AGE$|SEX$)/.test(line)){key=line;out[group][key]='';}
   else if(key)out[group][key]+=(out[group][key]?' ':'')+line;
  }
  return out;
 }
export function localDate(now,zone){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone||'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;}
export function buildContext(client,rows,now=new Date()){
 const id=client.id,own=list=>(list||[]).filter(r=>r.client_id===id),sources=[],add=(kind,label,at,data)=>{const ref=kind+'-'+(sources.filter(s=>s.kind===kind).length+1);sources.push({id:ref,kind,label,date:date(at),data});return ref;};
 const today=localDate(now,client.timezone),cutoff=new Date(+new Date(today+'T12:00:00Z')-14*864e5).toISOString().slice(0,10);
 add('profile','Agreed coaching goal and preferences',client.updated_at,{goal:cut(client.goal_summary||'Not recorded',1000),timezone:client.timezone||'Europe/Dublin',weight_unit:client.weight_unit||null,steps_goal:client.daily_steps_goal??null});
 const intake=own(rows.onboarding).sort((a,b)=>Number(b.version)-Number(a.version))[0];
 if(intake){const sections=intakeSections(intake),selected={};for(const group of ['training','nutrition','lifestyle','goals']){const section=plain(sections[group]||sections[group[0].toUpperCase()+group.slice(1)]||sections[group.toUpperCase()]);selected[group]=Object.fromEntries(Object.entries(section).filter(([k])=>/goal|work|schedul|hour|day|time|equip|gym|train|injur|pain|food|allerg|restrict|avoid|dislike|include|meal|kosher|vegetar|vegan|gluten|dairy|diet|budget|sleep|stress|routine|prefer|travel|child|family/i.test(k)&&!/^(name|email|phone|address|date.of.birth|employer)$/i.test(k)).slice(0,16).map(([k,v])=>[cut(k,100),sourceText(v)]));}add('intake','Latest saved onboarding answers',intake.completed_at||intake.submitted_at,selected);}
 const preferences=own(rows.preferences)[0];if(preferences)add('food','Saved food requirements',preferences.updated_at,{notes:cut(preferences.notes,2500)});
 const weightDays=new Map();
 const weightDay=(r)=>{const at=instant(r.submitted_at);return at?localDate(new Date(at),client.timezone):day(r.submitted_at);};
 const collectWeight=(r,recordedDate,origin)=>{
  const value=boundedNum(r.weight_kg,0.001,1000);if(value===null||!recordedDate||recordedDate>today)return;
  const candidates=weightDays.get(recordedDate)||[];candidates.push({value,origin,at:r.submitted_at||null,source_system:r.source_system||null});weightDays.set(recordedDate,candidates);
 };
 for(const r of own(rows.progress))collectWeight(r,day(r.entry_date),'progress_entry');
 for(const r of own(rows.checkins).sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at))))collectWeight(r,weightDay(r),'checkin_answer');
 const canonicalWeights=[...weightDays].map(([recordedDate,candidates])=>{
  const chosen=candidates.find(r=>r.origin==='progress_entry')||candidates[0],conflicts=candidates.filter(r=>Math.abs(r.value-chosen.value)>.001).length;
  return {recordedDate,candidates,chosen,conflicts};
 }).sort((a,b)=>b.recordedDate.localeCompare(a.recordedDate));
 const selectedWeights=[...canonicalWeights.filter(r=>r.recordedDate>=cutoff).slice(0,20),...canonicalWeights.filter(r=>r.recordedDate<cutoff).slice(0,1)],weightRefs=new Map();
 for(const r of selectedWeights){const ref=add('weight',r.recordedDate<cutoff?'Previous recorded weight baseline':'Saved recorded weight',r.recordedDate,{recorded_date:r.recordedDate,weight_kg:r.chosen.value,units:'kg',record_source:r.chosen.origin,older_baseline:r.recordedDate<cutoff,date_basis:r.chosen.origin==='progress_entry'?'Saved entry date; measurement time and actor are not supplied.':'Check-in submission date; measurement date is not supplied.',same_day_sources:[...new Set(r.candidates.map(c=>c.origin))],same_day_conflict:r.conflicts>0,conflicting_values_omitted:r.conflicts,source_system:cut(r.chosen.source_system,80)||null});weightRefs.set(r.recordedDate,ref);}
 for(const r of own(rows.checkins).sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at))).slice(0,3)){
  const whatsapp=r.review_channel==='whatsapp',published=!!r.reviewed_at&&!whatsapp,recordedDate=weightDay(r),canonical=canonicalWeights.find(w=>w.recordedDate===recordedDate),reportedWeight=boundedNum(r.weight_kg,.001,1000),weightConflict=reportedWeight!==null&&canonical&&Math.abs(canonical.chosen.value-reportedWeight)>.001;
  add('checkin','Saved check-in'+(r.period_start?' · week '+r.period_start:''),r.submitted_at,{...pick(r,['period_start','energy','sleep','sleep_hours','stress','workload','training_adherence','nutrition_adherence','average_steps','busy_week','reviewed_at','review_channel']),weight_kg:weightConflict?null:reportedWeight,weight_recording_basis:reportedWeight===null?null:'Reported in this check-in; measurement date and time are not supplied.',canonical_weight_source_ref:weightRefs.get(recordedDate)||null,conflicting_checkin_weight_omitted:!!weightConflict,...Object.fromEntries(['wins','challenges','support_needed','client_notes','training_summary','food_summary','next_week_availability'].map(k=>[k,sourceText(r[k])])),coach_response:published?sourceText(r.coach_response):null,focus_next_week:published?sourceText(r.focus_next_week):null,published_app_feedback:published,external_review:whatsapp?{channel:'whatsapp',confirmation:'Coach manually confirmed an external reply; the app did not send it.',message_content_available:false,preserved_app_drafts_excluded:true}:null,source_system:r.source_system||null,submission_time_verified:!r.source_system||/^client_weekly_v[23]$/.test(r.source_system)});
 }
 const reportCandidates=own(rows.weeklyReports).filter(r=>r.file_type==='health_weekly_report'&&instant(r.created_at)&&Date.parse(r.created_at)<=+now).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,8).map(r=>{
  let parsed;try{parsed=typeof r.notes==='string'?JSON.parse(r.notes):r.notes;}catch{}
  const details=parsed?.version===1?plain(parsed):{},start=day(details.period_start),end=day(details.period_end),validPeriod=!!start&&!!end&&start<=end&&end<=today&&(Date.parse(end)-Date.parse(start))/864e5<=31;
  return {r,details,start:validPeriod?start:null,end:validPeriod?end:null,validPeriod};
 });
 const currentReports=reportCandidates.filter(r=>!r.validPeriod||r.end>=cutoff),oldReports=reportCandidates.filter(r=>r.validPeriod&&r.end<cutoff).sort((a,b)=>b.end.localeCompare(a.end));
 for(const report of [...currentReports,...oldReports.slice(0,1)].slice(0,8)){
  const {r,details,start,end,validPeriod}=report,metrics=validPeriod?cleanMetrics(details.metrics,weeklyMetrics):{},summaryWeight=metrics.weight_kg;delete metrics.weight_kg;if(summaryWeight!==undefined)metrics.reported_summary_weight_kg=summaryWeight;
  add('weekly_report','Saved weekly health report · '+cut(details.provider||'Provider not supplied',60),r.created_at,{provider:cut(details.provider,100)||null,received_at:instant(r.created_at),period_start:start,period_end:end,period_valid:validPeriod,older_period_baseline:!!end&&end<cutoff,summary_scope:'Reported period summary; never a daily device observation or extra weigh-in.',metrics,source_system:cut(details.source_system,80)||'saved_weekly_report',figures_confirmed_at:instant(details.reviewed_at),source_review_status:cut(details.review_status,80)||null,message_text_excluded:true});
 }
 const healthRows=own(rows.dailyHealth).filter(r=>day(r.date)&&r.date>=cutoff&&r.date<=today).sort((a,b)=>(healthRank[a.source]||99)-(healthRank[b.source]||99)||String(b.last_synced_at||'').localeCompare(String(a.last_synced_at||''))),healthDays=new Map();
 for(const r of healthRows){const values=cleanMetrics(r,dailyMetrics);if(!Object.keys(values).length)continue;const saved=healthDays.get(r.date)||{date:r.date,metrics:{},field_sources:{},received_at:null};for(const [key,value]of Object.entries(values))if(saved.metrics[key]===undefined){saved.metrics[key]=value;saved.field_sources[key]=cut(r.source||'Source not supplied',80);}if(instant(r.last_synced_at)&&(!saved.received_at||r.last_synced_at>saved.received_at))saved.received_at=instant(r.last_synced_at);healthDays.set(r.date,saved);}
 for(const r of [...healthDays.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,14))add('daily_health','Saved daily device readings',r.date,{recorded_date:r.date,received_at:r.received_at,metrics:r.metrics,field_sources:r.field_sources,selection_rule:'One value per metric/date. Apple Health, Health Connect, Fitbit, Google, manual, then other sources; newest received value breaks source ties.',same_day_weight_conflict:canonicalWeights.some(w=>w.recordedDate===r.date&&r.metrics.weight_kg!==undefined&&Math.abs(w.chosen.value-r.metrics.weight_kg)>.001)});

 const weeks=own(rows.weeks),weekIds=new Set(weeks.map(w=>w.id));
 for(const s of (rows.sessions||[]).filter(r=>weekIds.has(r.week_id)).filter(r=>(r.session_date>=cutoff&&r.session_date<=today)||(String(r.source_metadata?.cardio_log?.logged_at||'')>=cutoff&&String(r.source_metadata?.cardio_log?.logged_at||'').slice(0,10)<=today)).sort((a,b)=>String(b.session_date).localeCompare(String(a.session_date))).slice(0,24)){
  const actual=plain(s.source_metadata?.cardio_log);add('session','Recorded session · '+cut(s.title,100),s.session_date,{title:cut(s.title,120),training_type:s.training_type,status:s.status,completed_at:s.completed_at||null,prescribed_duration_minutes:validNum(s.duration_minutes),actual_cardio:validNum(actual.duration_minutes)>0?{activity:cut(actual.activity,80),duration_minutes:validNum(actual.duration_minutes),distance_km:validNum(actual.distance_km),heart_rate:validNum(actual.heart_rate),rpe:validNum(actual.rpe),logged_at:date(actual.logged_at),notes:cut(actual.notes,500)}:null});
 }
 for(const r of own(rows.sets).filter(r=>r.performed_at>=cutoff&&r.performed_at.slice(0,10)<=today).sort((a,b)=>String(b.performed_at).localeCompare(String(a.performed_at))).slice(0,80))add('set','Recorded set · '+cut(r.exercise_name||'Exercise name unavailable',80),r.performed_at,{...pick(r,['set_number','reps','load','load_unit','rpe','rir','completed','duration_seconds']),exercise_name:cut(r.exercise_name||'Name unavailable',100)});
 for(const r of own(rows.calls).filter(r=>r.coach_id===client.coach_id&&r.matching_status==='matched'&&!r.excluded_at).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))).slice(0,2))add('call','Verified linked coaching call',r.occurred_at,{source:r.source,processing_status:r.processing_status,summary:cut(r.summary,2200),analysis:sourceText(r.analysis)});
 for(const r of own(rows.guidance).filter(r=>r.published).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,6))add('guidance','Published coach guidance · '+cut(r.title,80),r.created_at,{category:r.category,title:cut(r.title,160),body:cut(r.body,2000)});
 for(const r of own(rows.focus).filter(r=>!r.archived_at&&r.approved_at&&Date.parse(r.approved_at)<=+now&&r.starts_on<=today&&r.expires_on>=today).slice(0,8))add('focus','Coach-approved current action',r.approved_at,{description:cut(r.description,1000),starts_on:r.starts_on,expires_on:r.expires_on,completed_at:r.completed_at||null});
 const gaps=['This is a bounded source snapshot, not a complete activity history.','Missing logs do not establish missed exercise or food intake.','Check-in adherence percentages are self-reported, separate from saved exercise sets and cardio.','Different loads, reps or units alone do not establish strength improvement.','Existing reviewed_at values can represent status reconciliation; do not claim feedback was delivered without saved feedback.','WhatsApp review confirmation contains no imported message text. Preserved in-app response/action drafts are excluded and must not be treated as the external reply.','Only reviewed non-WhatsApp replies are published app feedback; unfinished reply drafts are excluded.','Weight records use saved dates, not verified measurement timestamps. Same-day check-in/progress copies count once; differing check-in weights are omitted in favour of the dated progress entry. Older baseline weights are explicitly labelled.','Weekly reports retain their covered period separately from receipt time. Their averages, summary weight and reported workouts are not daily readings, weigh-in days or additional logged sessions. Receipt does not establish a live connection.','Daily readings retain per-metric source provenance and are never summed across overlapping providers. Energy burned is not food intake; missing values are unknown.'];
 if(!intake)gaps.push('No saved onboarding answers were available.');if(!own(rows.calls).length)gaps.push('No verified linked call was found.');
 let context={prepared_at:now.toISOString(),today,window_start:cutoff,sources,gaps};
 // Remove direct client identifiers from free text as well as omitting identity fields.
 let serialized=JSON.stringify(context);for(const value of [client.display_name,client.email,client.phone])if(value&&String(value).length>2)serialized=serialized.split(String(value)).join('[client]');
 serialized=serialized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email omitted]');
 serialized=serialized.replace(/(?:\+?\d[\d(). -]{8,}\d)/g,match=>match.replace(/\D/g,'').length>=10?'[phone omitted]':match);
 context=JSON.parse(serialized);if(serialized.length>65000)throw Error('The saved coaching context is too large. Shorten duplicated source notes before generating.');return context;
}
export function validateBrief(raw,context){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('AI returned an incomplete brief. Please retry.');
 const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('AI returned invalid brief text. Please retry.');return v.trim();};
 const refs=new Set(context.sources.map(s=>s.id));
 const findings=(items)=>{if(!Array.isArray(items)||items.length>5)throw Error('AI returned invalid findings. Please retry.');return items.map(item=>{if(!Array.isArray(item.evidence)||item.evidence.length<1||item.evidence.length>5||item.evidence.some(id=>typeof id!=='string'||!refs.has(id)))throw Error('AI cited an unknown source. No draft was saved.');return {text:text(item.text,1500),evidence:[...new Set(item.evidence)]};});};
 const strings=(items,max,length)=>{if(!Array.isArray(items)||items.length>max)throw Error('AI returned invalid questions or gaps. Please retry.');return items.map(v=>text(v,length));};
 return {summary:text(raw.summary,2500),wins:findings(raw.wins),attention:findings(raw.attention),questions:strings(raw.questions,10,800),suggested_response:text(raw.suggested_response,6000),gaps:[...context.gaps,...strings(raw.gaps,8,1000)],sources:context.sources.map(({id,label,date})=>({id,label,date}))};
}

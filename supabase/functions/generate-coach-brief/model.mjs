/* Bounded, dated source evidence. Source text is data, never model instructions. */
const obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)}),str={type:'string'},strings=(max)=>({type:'array',maxItems:max,items:str});
const finding=obj({text:str,evidence:{type:'array',minItems:1,maxItems:5,items:str}});
export const briefSchema=obj({summary:str,wins:{type:'array',maxItems:5,items:finding},attention:{type:'array',maxItems:5,items:finding},questions:strings(10),suggested_response:str,gaps:strings(8)});
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const pick=(row,keys)=>Object.fromEntries(keys.map(k=>[k,row[k]??null]));
const cut=(v,max=1800)=>String(v??'').slice(0,max);
const date=v=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v):null;
const validNum=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
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
 for(const r of own(rows.checkins).sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at))).slice(0,3))add('checkin','Saved check-in'+(r.period_start?' · week '+r.period_start:''),r.submitted_at,{...pick(r,['period_start','weight_kg','energy','sleep','sleep_hours','stress','workload','training_adherence','nutrition_adherence','average_steps','busy_week','reviewed_at']),...Object.fromEntries(['wins','challenges','support_needed','client_notes','training_summary','food_summary','next_week_availability','coach_response','focus_next_week'].map(k=>[k,sourceText(r[k])])),source_system:r.source_system||null,submission_time_verified:!r.source_system||/^client_weekly_v[23]$/.test(r.source_system)});
 const weeks=own(rows.weeks),weekIds=new Set(weeks.map(w=>w.id));
 for(const s of (rows.sessions||[]).filter(r=>weekIds.has(r.week_id)).filter(r=>(r.session_date>=cutoff&&r.session_date<=today)||(String(r.source_metadata?.cardio_log?.logged_at||'')>=cutoff&&String(r.source_metadata?.cardio_log?.logged_at||'').slice(0,10)<=today)).sort((a,b)=>String(b.session_date).localeCompare(String(a.session_date))).slice(0,24)){
  const actual=plain(s.source_metadata?.cardio_log);add('session','Recorded session · '+cut(s.title,100),s.session_date,{title:cut(s.title,120),training_type:s.training_type,status:s.status,completed_at:s.completed_at||null,prescribed_duration_minutes:validNum(s.duration_minutes),actual_cardio:validNum(actual.duration_minutes)>0?{activity:cut(actual.activity,80),duration_minutes:validNum(actual.duration_minutes),distance_km:validNum(actual.distance_km),heart_rate:validNum(actual.heart_rate),rpe:validNum(actual.rpe),logged_at:date(actual.logged_at),notes:cut(actual.notes,500)}:null});
 }
 for(const r of own(rows.sets).filter(r=>r.performed_at>=cutoff&&r.performed_at.slice(0,10)<=today).sort((a,b)=>String(b.performed_at).localeCompare(String(a.performed_at))).slice(0,80))add('set','Recorded set · '+cut(r.exercise_name||'Exercise name unavailable',80),r.performed_at,{...pick(r,['set_number','reps','load','load_unit','rpe','rir','completed','duration_seconds']),exercise_name:cut(r.exercise_name||'Name unavailable',100)});
 for(const r of own(rows.calls).filter(r=>r.coach_id===client.coach_id&&r.matching_status==='matched'&&!r.excluded_at).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))).slice(0,2))add('call','Verified linked coaching call',r.occurred_at,{source:r.source,processing_status:r.processing_status,summary:cut(r.summary,2200),analysis:sourceText(r.analysis)});
 for(const r of own(rows.guidance).filter(r=>r.published).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,6))add('guidance','Published coach guidance · '+cut(r.title,80),r.created_at,{category:r.category,title:cut(r.title,160),body:cut(r.body,2000)});
 for(const r of own(rows.focus).filter(r=>!r.archived_at&&r.approved_at&&Date.parse(r.approved_at)<=+now&&r.starts_on<=today&&r.expires_on>=today).slice(0,8))add('focus','Coach-approved current action',r.approved_at,{description:cut(r.description,1000),starts_on:r.starts_on,expires_on:r.expires_on,completed_at:r.completed_at||null});
 const gaps=['This is a bounded source snapshot, not a complete activity history.','Missing logs do not establish missed exercise or food intake.','Check-in adherence percentages are self-reported, separate from saved exercise sets and cardio.','Different loads, reps or units alone do not establish strength improvement.','Existing reviewed_at values can represent status reconciliation; do not claim feedback was delivered without saved feedback.'];
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

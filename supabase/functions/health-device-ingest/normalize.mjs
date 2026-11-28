const fields={step_count:['steps',['count']],sleep_analysis:['sleep_minutes',['hr','min']],body_mass:['weight_kg',['kg','lb','lbs']],resting_heart_rate:['resting_heart_rate',['bpm']],dietary_energy:['consumed_calories',['kcal','kJ']],dietary_protein:['protein_g',['g']],dietary_carbohydrates:['carbs_g',['g']],dietary_fat_total:['fat_g',['g']],dietary_water:['water_ml',['mL','ml','L','l','fl_oz','fl oz']]};
// Current exporter names plus legacy aliases. Names are normalized before unit conversion.
const aliases={'weight_&_body_mass':'body_mass',protein:'dietary_protein',carbohydrates:'dietary_carbohydrates',total_fat:'dietary_fat_total'};
const limits={steps:[0,150000],sleep_minutes:[0,1440],weight_kg:[20,400],resting_heart_rate:[20,250],consumed_calories:[0,15000],protein_g:[0,1000],carbs_g:[0,3000],fat_g:[0,1000],water_ml:[0,20000]};
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
export function normalizeDevicePayload(payload,scopes,now=new Date()){
 const rows=new Map(),allowed=new Set(scopes),seen=new Set();let points=0;
 function add(date,field,value){if(!allowed.has(field))return;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Invalid local date');const days=(new Date(date+'T12:00:00Z')-now)/864e5;if(days < -371||days>2)throw Error('Date outside supported range');if(!finite(value)||value<limits[field][0]||value>limits[field][1])throw Error('Invalid '+field);const key=date+'|'+field;if(seen.has(key))throw Error('Use daily aggregated data: duplicate '+field+' for '+date);seen.add(key);if(['steps','sleep_minutes'].includes(field))value=Math.round(value);const row=rows.get(date)||{date};row[field]=value;rows.set(date,row);}
 if(payload?.shortcut_version==='steps-v1'){
  if(!allowed.has('steps'))throw Error('Steps sharing is not permitted for this key');
  if(typeof payload.samples_tsv!=='string'||payload.samples_tsv.length>1500000)throw Error('Missing or oversized step samples');
  if(typeof payload.source_name!=='string'||!payload.source_name.trim()||payload.source_name.length>200)throw Error('Choose one Health source');
  const source=payload.source_name.trim(),today=payload.local_today;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(today||''))throw Error('Missing phone local date');
  const days=new Map(),sources=new Set(),duplicates=new Set();
  const lines=payload.samples_tsv.trim().split('\n').filter(Boolean);if(lines.length>4000)throw Error('Too many step samples');
  for(const line of lines){
   const cols=line.split('\t');if(cols.length!==4)throw Error('Invalid step sample format');
   const [start,end,value,sampleSource]=cols;sources.add(sampleSource);
   if(sampleSource!==source)continue;
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(start)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(end))throw Error('Step dates need timezone offsets');
   const date=start.slice(0,10),a=Date.parse(start),b=Date.parse(end),qty=/^\d+(?:\.\d+)?$/.test(value)?Number(value):NaN;
   if(!Number.isFinite(a)||!Number.isFinite(b)||b<a||!Number.isFinite(qty)||qty<0||qty>150000)throw Error('Invalid step sample');
   if(date>=today)continue; // Do not overwrite a complete-day observation with today's partial total.
   if(end.slice(0,10)!==date&&!/T00:00:00/.test(end))throw Error('A step sample crosses local days; use a daily export or native companion');
   const sig=start+'|'+end+'|'+value+'|'+sampleSource;if(duplicates.has(sig))continue;duplicates.add(sig);
   const list=days.get(date)||[];list.push({a,b,qty});days.set(date,list);
  }
  if(!days.size)throw Error('No completed-day samples for '+source+'. Available sources: '+[...sources].slice(0,5).join(', '));
  for(const [date,list]of days){list.sort((a,b)=>a.a-b.a);let lastEnd=-Infinity,total=0;for(const x of list){if(x.a<lastEnd)throw Error('Overlapping samples from the selected source; check Health before sharing');lastEnd=Math.max(lastEnd,x.b);total+=x.qty;}add(date,'steps',total);}
 }
 else if(Array.isArray(payload?.daily)){if(payload.daily.length>370)throw Error('Too many days');for(const row of payload.daily){for(const [field,value]of Object.entries(row)){if(field==='date')continue;if(!(field in limits))throw Error('Unsupported daily metric');if(value!==null)add(row.date,field,value);}}}
 else if(Array.isArray(payload?.data?.metrics)){if(payload.data.metrics.length>30)throw Error('Too many metrics');for(const metric of payload.data.metrics){const name=aliases[metric.name]||metric.name;const spec=fields[name];if(!spec||!allowed.has(spec[0]))continue;if(!spec[1].includes(metric.units))throw Error('Unsupported unit for '+metric.name);if(!Array.isArray(metric.data))throw Error('Missing metric readings');for(const point of metric.data){if(++points>4000)throw Error('Too many readings');const date=String(point.date||'').slice(0,10);let value=name==='sleep_analysis'?point.totalSleep:point.qty;if(!finite(value))throw Error('Use daily aggregation with totalSleep for sleep');if(name==='sleep_analysis'&&metric.units==='hr')value*=60;if(name==='body_mass'&&metric.units!=='kg')value/=2.2046226218;if(name==='dietary_energy'&&metric.units==='kJ')value/=4.184;if(name==='dietary_water'){if(['L','l'].includes(metric.units))value*=1000;else if(['fl_oz','fl oz'].includes(metric.units))value*=29.57352956;}add(date,spec[0],value);}}}
 else throw Error('Expected shortcut samples, daily snapshots or Health Auto Export JSON');
 if(!rows.size)throw Error('No supported permitted readings');if(rows.size>370)throw Error('Too many days');return [...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

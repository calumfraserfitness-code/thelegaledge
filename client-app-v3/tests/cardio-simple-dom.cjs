// Run with NODE_PATH pointing to jsdom 26.1.0. No browser or production writes.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
dom.window.HTMLElement.prototype.scrollIntoView=function(){};
const tables={client_food_entries:[],client_recipe_favourites:[]};let failSave=false,delayedReads=new Map();const reads=[];
dom.window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:null}}),onAuthStateChange(){}},from(table){
 let action='read',payload,filters=[];
 const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},limit(){return q;},upsert(p){action='save';payload=p;return q;},delete(){action='delete';return q;},then(resolve,reject){return Promise.resolve().then(()=>{
  const rows=tables[table]||[];
  if(action==='save'){
   if(failSave)return {data:null,error:{message:'Fixture save rejected'}};
   const field=table==='client_food_entries'?'slot_key':'recipe_key';
   const i=rows.findIndex(r=>r.client_id===payload.client_id&&r[field]===payload[field]&&r.entry_date===payload.entry_date);
   const row={...payload,id:'mock-'+(i<0?rows.length:i)};if(i<0)rows.push(row);else rows[i]=row;
   return {data:[row],error:null};
  }
  const matches=r=>filters.every(([k,v])=>r[k]===v);
  if(action==='delete')tables[table]=rows.filter(r=>!matches(r));
  reads.push({table,filters:[...filters]});
  const selectedDate=filters.find(([k])=>k==='entry_date')?.[1];
  const result={data:rows.filter(matches),error:null};
  if(table==='client_food_entries'&&delayedReads.has(selectedDate))return new Promise(r=>delayedReads.set(selectedDate,()=>r(result)));
  return result;
 }).then(resolve,reject);}};return q;}})};
const ctx=dom.getInternalVMContext();
for(const script of dom.window.document.querySelectorAll('script[src^="./"]')){
 const file=script.getAttribute('src').split('?')[0].slice(2);if(file.startsWith('vendor/'))continue;if(file==='app-runtime.js'){for(const source of JSON.parse(fs.readFileSync(path.join(root,'runtime-manifest.json'),'utf8')).scripts)vm.runInContext(fs.readFileSync(path.join(root,source),'utf8'),ctx,{filename:source});continue;}vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
}
const run=s=>vm.runInContext(s,ctx),doc=dom.window.document;
run(`preview('client');state.client.onboarding_status='complete';state.client.plan_status='published';state.clientView='training';state.trainingCategory='cardio';state.selectedSessionId='cardio-a';const cw=currentWeek();cw.published=true;
state.data.sessions=[{id:'cardio-a',week_id:cw.id,training_type:'cardio',title:'Incline treadmill',session_date:cw.week_start,status:'planned',duration_minutes:30},{id:'cardio-b',week_id:cw.id,training_type:'cardio',title:'Second session',session_date:cw.week_start,status:'planned',duration_minutes:20},{id:'cardio-done',week_id:cw.id,training_type:'cardio',title:'Saved cycle',session_date:cw.week_start,status:'completed',source_metadata:{cardio_log:{activity:'Cycling',duration_minutes:18}}}];renderClient();`);
(async()=>{
 await new Promise(r=>setTimeout(r,0));
 assert.equal(doc.querySelectorAll('.cardio-log-toggle[open]').length,1,'Only the first unfinished session starts open');
 assert(!doc.querySelector('.cardio-own').open,'Extra cardio does not compete with coach sessions');
 assert(!doc.querySelector('.cardio-history').open,'Saved history starts collapsed');
 const form=doc.querySelector('[data-cardio-id="cardio-a"]');assert(!form.querySelector('.cardio-more').open);assert.equal(form.elements.activity.value,'Incline treadmill');
 form.elements.duration.value='24';form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));
 assert(doc.querySelector('#cardioSaveStatus').textContent.includes('24 min'));
 assert.equal(run(`state.data.sessions.find(s=>s.id==='cardio-a').duration_minutes`),30,'Coach target stays unchanged');
 assert.equal(run(`state.data.sessions.find(s=>s.id==='cardio-a').status`),'completed');
 assert.equal(doc.querySelector('.cardio-history summary').textContent,'Saved cardio (2)');
 assert(doc.querySelector('.cardio-history').textContent.includes('Saved: Incline treadmill · 24 min'));
 console.log('PASS full cardio screen: two-field assigned log, optional metrics, separate extras/history, save confirmation and unchanged prescription');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

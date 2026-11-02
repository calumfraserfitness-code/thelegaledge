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
run(`preview('client');state.client.onboarding_status='complete';state.client.plan_status='published';state.role='coach';state.clientTab='overview';state.data.exerciseBank=Array.from({length:1000},(_,i)=>({id:'bank-'+i,name:'Exercise '+i,category:'Strength'}));renderCoach();`);
(async()=>{
 await new Promise(r=>setTimeout(r,0));
 const tabs=doc.querySelector('#clientTabs'),heading=doc.querySelector('#viewAsClient');
 assert(tabs&&heading);let summaryCalls=0;
 const original=run('coachOverview');dom.window.coachOverview=function(){summaryCalls++;return original();};
 for(const tab of ['training','nutrition','progress','overview','support','goals','training']){
  run(`state.clientTab=${JSON.stringify(tab)};renderClientWorkspace();`);
  assert.equal(doc.querySelector('#clientTabs'),tabs,'Coach navigation is retained across tabs');
  assert.equal(doc.querySelector('#viewAsClient'),heading,'Header/actions are retained across tabs');
  assert(doc.querySelector('#clientWorkspaceBody').textContent.trim(),'Every section paints meaningful content immediately');
 }
 assert.equal(summaryCalls,1,'Goals and support do not build a discarded Summary first');
 assert.equal(doc.querySelectorAll('[data-client-tab="connections"]').length,1,'No duplicate Connections buttons');
 assert.equal(doc.querySelectorAll('.le-more-tabs').length,1,'Disclosure stays stable');
 assert.equal(doc.querySelectorAll('.bank-card').length,0,'Closed catalogue does not create 1000 cards');
 doc.querySelector('[data-bank-open]').click();await new Promise(r=>setTimeout(r,0));
 assert.equal(doc.querySelectorAll('.bank-card').length,24,'Catalogue only renders one small page');
 const search=doc.querySelector('[data-bank-find]');search.value='Exercise 999';search.dispatchEvent(new dom.window.Event('input'));
 assert.equal(doc.querySelectorAll('.bank-card').length,1);assert(doc.querySelector('.bank-card').textContent.includes('Exercise 999'),'All catalogue records remain searchable');
 const cachedTabs=doc.querySelector('#clientTabs');run(`state.user={id:'different-account'};state.clientTab='overview';renderClientWorkspace();`);assert.notEqual(doc.querySelector('#clientTabs'),cachedTabs,'Account switch cannot reuse workspace chrome/closures');
 run(`state.role='client';state.clientView='checkin';renderClient();`);await new Promise(r=>setTimeout(r,0));const checkin=doc.querySelector('#checkinForm');assert(checkin);doc.querySelector('#clientNav [data-client-view="checkin"]').click();assert.equal(doc.querySelector('#checkinForm'),checkin,'Tapping the active tab keeps the current form and entered values');
 await new Promise(r=>setTimeout(r,80));dom.window.close();console.log('PASS full workspace tab performance: retained shell, immediate content, direct routes, one disclosure, on-demand 24-card catalogue and account isolation');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

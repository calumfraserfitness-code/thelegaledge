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
(async()=>{await new Promise(r=>setTimeout(r,0));
run(`preview('client');state.client.weight_unit='kg';state.user={id:'owner'};state.client.onboarding_status='complete';state.client.plan_status='published';state.clientView='progress';state.preview=false;window.progressCalls=[];window.progressPrevious={id:'previous',client_id:state.client.id,entry_date:localCoachingDate(),weight_kg:80,steps:8500};state.data.progress=[window.progressPrevious];db.rpc=(name,p)=>{window.progressCalls.push(p);return Promise.resolve({data:[{...window.progressPrevious,...p.p_values,client_id:p.p_client,entry_date:p.p_date}],error:null});};clientProgress();`);
let form=doc.querySelector('#progressForm');form.elements.waist_cm.value='91';await form.onsubmit({preventDefault(){},target:form,submitter:form.querySelector('button')});
assert.deepEqual(Object.keys(dom.window.progressCalls[0].p_values),['waist_cm']);assert.equal(run('state.data.progress[0].weight_kg'),80);assert.equal(run('state.data.progress[0].steps'),8500);assert.equal(run('state.data.progress[0].waist_cm'),91);
form=doc.querySelector('#progressForm');await form.onsubmit({preventDefault(){},target:form,submitter:form.querySelector('button')});assert.equal(dom.window.progressCalls.length,1,'Empty form does not overwrite readings');
run(`db.rpc=()=>Promise.resolve({data:[],error:null});`);form.elements.waist_cm.value='92';await form.onsubmit({preventDefault(){},target:form,submitter:form.querySelector('button')});assert.equal(run('state.data.progress[0].waist_cm'),91);assert.equal(form.elements.waist_cm.value,'92');assert(!form.querySelector('button').disabled);assert(doc.querySelector('#toast').textContent.includes('not confirmed'));
run(`window.pendingProgress=null;window.requestCount=0;db.rpc=(name,p)=>{window.requestCount++;return new Promise(r=>window.pendingProgress=()=>r({data:[{id:'late',client_id:p.p_client,entry_date:p.p_date,...p.p_values}],error:null}));};`);
const event={preventDefault(){},target:form,submitter:form.querySelector('button')},pending=form.onsubmit(event);await form.onsubmit(event);assert.equal(dom.window.requestCount,1,'Double tap submits once');run(`state.user={id:'another-account'};state.client={...state.client,id:'another-client'};state.data.progress=[];`);dom.window.pendingProgress();await pending;assert.equal(run('state.data.progress.length'),0,'Late save cannot enter another account');
run(`state.client={id:'workout-client',weight_unit:'kg'};state.user={id:'workout-user'};state.selectedSessionId='workout';state.data.exerciseLogs=[];state.data.sessions=[{id:'workout'}];state.data.exercises=[{id:'exercise',sets:1}];exercisesForSession=()=>state.data.exercises;db.from=()=>({upsert:()=>({select:()=>Promise.resolve({data:[],error:null})})});`);
const workout=doc.createElement('form');workout.dataset.exerciseLog='exercise';workout.innerHTML='<input name="reps_1" value="8"><button>Save</button>';doc.querySelector('#clientMain').append(workout);await dom.window.saveExerciseLog({preventDefault(){},target:workout,submitter:workout.querySelector('button')});assert.equal(run('state.data.exerciseLogs.length'),0);assert(doc.querySelector('#toast').textContent.includes('not confirmed'));assert.equal(workout.elements.reps_1.value,'8');assert(!workout.querySelector('button').disabled);
console.log('PASS: partial progress preserves prior readings; blanks and empty responses never fake a save; retries retain inputs; double taps and account switches remain isolated.');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exit(1)});

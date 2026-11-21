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
run(`preview('client');state.client.onboarding_status='complete';state.client.plan_status='published';state.clientView='nutrition';state.selectedNutritionDate=null;
state.data.nutritionPlans=[{id:'portion-plan',client_id:state.client.id,is_active:true,name:'Everyday menu',calories:1800,protein_g:130,carbs_g:200,fat_g:50}];
state.data.nutritionDays=[{id:'portion-day',week_id:state.data.weeks[0].id,nutrition_date:localCoachingDate(),nutrition_plan_id:'portion-plan'}];
state.data.mealAssignments=[{id:'portion-a',client_id:state.client.id,nutrition_plan_id:'portion-plan',meal:{id:'portion-meal',name:'Yogurt breakfast',meal_type:'Breakfast',calories:420,protein_g:30,carbs_g:50,fat_g:12,ingredients:[{name:'Greek yogurt',fdc_id:170894,quantity:200,unit:'g',weight_basis:'as sold'},{name:'Oats',fdc_id:169705,quantity:40,unit:'g',weight_basis:'dry'},{name:'Banana',fdc_id:173944,quantity:80,unit:'g',weight_basis:'raw, peeled'},{name:'Brand-specific protein powder',quantity:20,unit:'g'}],cooking_instructions:'Mix and serve.'}}];renderClient();`);
const tick=()=>new Promise(r=>setTimeout(r,0));
function mode(id,value){const select=doc.querySelector(id);select.value=value;select.dispatchEvent(new dom.window.Event('change'));}
(async()=>{
 await tick();const before=run(`JSON.stringify(state.data.mealAssignments)`),targets=doc.querySelector('.dn-target-panel').textContent;
 mode('#dnPageUnits','household');assert.equal(doc.querySelector('#dnPageUnits').value,'household');assert(/cup|pot|tablespoon|tbsp/i.test(doc.querySelector('.dn-meals').textContent),'Known foods show household measures on meal cards');
 doc.querySelector('[data-dn-recipe]').click();assert.equal(doc.querySelector('#dnUnits').value,'household');assert(doc.querySelector('[role=dialog]').textContent.includes('Original weighed ingredients'));
 assert(doc.querySelector('[role=dialog]').textContent.includes('recipe estimates'),'Approximate portions do not imply exact eaten macros');
 assert(doc.querySelector('.dn-ingredients').textContent.includes('Brand-specific protein powder'),'Unsupported foods stay visible with honest fallback');
 mode('#dnUnits','visual');assert.equal(doc.querySelector('#dnUnits').value,'visual');assert(doc.querySelector('[role=dialog]').textContent.includes('Rough visual guide'));
 assert(doc.querySelector('[role=dialog]').textContent.includes('200 g')||doc.querySelector('[role=dialog]').textContent.includes('7.1 oz'),'Original recipe remains accessible');
 doc.querySelector('#dnBatch').value='2';doc.querySelector('#dnBatch').dispatchEvent(new dom.window.Event('change'));assert(doc.querySelector('[role=dialog]').textContent.includes('2 servings total'));
 assert.equal(run(`JSON.stringify(state.data.mealAssignments)`),before,'Display mode and batch guides never rewrite prescriptions');assert.equal(doc.querySelector('.dn-target-panel').textContent,targets);
 doc.querySelector('#dnClose').click();assert.equal(doc.querySelector('#dnPageUnits').value,'visual');doc.querySelector('[data-dn-log]').click();await tick();assert(doc.querySelector('.dn-status').textContent.includes('estimated portion'),'Eyed log is labelled as estimated');
 assert.equal(doc.querySelector('.dn-meal').textContent.includes('420'),true,'Logging keeps saved recipe nutrition estimate');
 run(`renderClient()`);await tick();assert.equal(doc.querySelector('#dnPageUnits').value,'visual','Display preference survives navigation');
 doc.querySelector('[data-dn-log]').click();await tick();mode('#dnPageUnits','metric');doc.querySelector('[data-dn-log]').click();await tick();assert(!doc.querySelector('.dn-status').textContent.includes('estimated portion'),'Undo then weighed log clears the previous rough-method receipt');
 run(`state.client={...state.client,id:'different-client'};renderClient();`);await tick();assert.equal(doc.querySelector('#dnPageUnits').value,'us','Another account/client does not inherit the portion preference');
 await new Promise(r=>setTimeout(r,30));dom.window.close();console.log('PASS recipe portion views: household/visual display, unknown fallback, original recipe, batch totals, estimated log, unchanged targets and owner-scoped preference');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

// Run with NODE_PATH pointing to jsdom 26.1.0. No browser or production writes.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
dom.window.HTMLElement.prototype.scrollIntoView=function(){};
const tables={client_food_entries:[],client_recipe_favourites:[]};let failSave=false;
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
  return {data:rows.filter(matches),error:null};
 }).then(resolve,reject);}};return q;}})};
const ctx=dom.getInternalVMContext();
for(const script of dom.window.document.querySelectorAll('script[src^="./"]')){
 const file=script.getAttribute('src').split('?')[0].slice(2);vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
}
const run=s=>vm.runInContext(s,ctx),doc=dom.window.document;
run(`preview('client');state.client.onboarding_status='complete';state.client.plan_status='published';state.clientView='nutrition';state.selectedNutritionDate=null;
state.data.nutritionPlans=[{id:'p',is_active:true,name:'Everyday menu',day_type:'Training Day',calories:1800,protein_g:130,carbs_g:200,fat_g:50}];
state.data.nutritionDays=[{id:'n',week_id:state.data.weeks[0].id,nutrition_date:localCoachingDate(),nutrition_plan_id:'p'}];
state.data.mealAssignments=[{id:'a',nutrition_plan_id:'p',meal:{id:'m',name:'Egg wrap',meal_type:'Breakfast',calories:400,protein_g:25,carbs_g:40,fat_g:15,ingredients:[{name:'Eggs',quantity:2,unit:'count'}],cooking_instructions:'1. Cook the eggs.\\n2. Fill the wrap.'}},{id:'b',nutrition_plan_id:'p',meal:{id:'m2',name:'Yogurt bowl',meal_type:'Breakfast',calories:420,protein_g:28,carbs_g:40,fat_g:14,ingredients:[],cooking_instructions:'Mix and serve.'}}];renderClient();`);
async function tick(){await new Promise(r=>setTimeout(r,0));}
(async()=>{
 await tick();
 assert.equal(doc.querySelectorAll('#clientNav button').length,7);
 assert.deepEqual([...doc.querySelectorAll('#clientNav button')].map(b=>b.dataset.clientView),['today','training','nutrition','checkin','progress','support','playbook']);
 assert.ok(doc.querySelector('.dn-target-panel'));assert.ok(!doc.querySelector('.dn-week').open);
 assert.ok(!doc.querySelector('.dn-meals .ingredient-list'),'Recipes collapsed initially');
 doc.querySelector('[data-dn-recipe]').click();assert.ok(doc.querySelector('[role="dialog"]'));assert.ok(doc.querySelector('.dn-ingredients').textContent.includes('Eggs'));
 doc.querySelector('#dnFavourite').click();await tick();assert.equal(doc.querySelector('#dnFavourite').textContent,'Saved recipe ✓');
 doc.querySelector('#dnClose').click();
 doc.querySelector('[data-dn-log]').click();await tick();assert.equal(doc.querySelectorAll('.dn-eaten').length,1);
 assert.ok(doc.querySelector('.dn-intake strong').textContent.includes('400'));
 doc.querySelector('[data-dn-log]').click();await tick();assert.equal(doc.querySelectorAll('.dn-eaten').length,0);
 doc.querySelector('[data-dn-swap]').click();assert.ok(doc.querySelector('[role=dialog]').textContent.includes('SIMILAR CALORIES'));
 const choose=[...doc.querySelectorAll('[data-dn-choose]')].find(b=>b.closest('article').textContent.includes('Yogurt bowl'));choose.click();await tick();
 assert.equal(doc.querySelector('.dn-meal h3').textContent,'Yogurt bowl');
 assert.equal(run('state.data.mealAssignments[0].meal.name'),'Egg wrap');
 doc.querySelector('#dnQuickLog').click();const form=doc.querySelector('#dnQuickForm');form.elements.name.value='Fruit';form.elements.calories.value='100';form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();
 assert.ok(doc.querySelector('.dn-intake strong').textContent.includes('100'));
 run(`state.clientView='progress';renderClient();`);assert.ok(doc.querySelector('#dnProgressNav'));
 run(`state.client={...state.client,id:'other'};state.clientView='nutrition';renderClient();`);await tick();assert.equal(doc.querySelectorAll('.dn-eaten').length,0,'No previous client logs');
 run(`state.preview=false;state.user={id:'mock-client'};state.client.onboarding_status='complete';renderClient();`);await tick();await tick();
 failSave=true;doc.querySelector('[data-dn-log]').click();await tick();assert.equal(doc.querySelectorAll('.dn-eaten').length,0,'Failed save does not fake success');assert.ok(doc.querySelector('#toast').textContent.includes('rejected'));
 failSave=false;doc.querySelector('[data-dn-log]').click();await tick();assert.equal(tables.client_food_entries.length,1);
 run(`state.client.id='switch-away';renderClient();`);await tick();
 run(`state.client.id='other';renderClient();`);await tick();await tick();assert.equal(doc.querySelectorAll('.dn-eaten').length,1,'Saved log reloaded from backend');
 run(`state.client.onboarding_status='pending_legal';renderClient();`);await tick();await tick();assert.ok(!doc.querySelector('.dn-page'),'Consent gate retained');
 run(`state.preview=true;state.client.onboarding_status='complete';state.client.plan_status='published';state.clientView='checkin';renderClient();`);await tick();assert.equal(doc.querySelector('#clientNav [data-client-view=checkin]').getAttribute('aria-current'),'page');assert(!doc.querySelector('#dnProgressNav'),'Check-in has its own destination');
 run(`state.role='coach';$('#coachMain').innerHTML='<div id="clientWorkspaceBody"></div>';state.selectedNutritionPlanId='p';coachNutrition();`);assert(doc.querySelector('#coachDailyMenu'));assert(!doc.querySelector('#clientWorkspaceBody .nutrition-day-tabs'));assert(doc.querySelector('[data-plan-editor] [name=calories]'));assert(doc.querySelector('[data-meal-editor]'),'Existing personal recipe editor retained');
 doc.querySelector('#coachDailyAssign').click();await tick();assert.equal(run(`state.data.nutritionDays.find(d=>d.nutrition_date===localCoachingDate()).nutrition_plan_id`),'p');
 doc.querySelector('#coachDailyPreview').click();await tick();assert(doc.querySelector('.dn-page'));assert(!doc.querySelector('[data-dn-date]'),'No seven-day meal selector on client');assert(!doc.querySelector('.dn-history').open);
 run('showAddClient()');const create=doc.querySelector('#addClientForm');assert(create.elements.start_onboarding.checked);assert.equal(create.elements.password.value.length,36);assert(!create.elements.start_weight_display.required);assert(!create.querySelector('[name=payment_url],[name=welcome_url]'));doc.querySelector('.modal-backdrop [data-close-modal]').click();
 run(`renderJourney({client_id:'fixture',stage:'welcome',funding_mode:'personal',welcome_url:'https://example.invalid/welcome.mp4'});`);assert(!doc.querySelector('video'));assert(doc.querySelector('#journeyContinue').textContent.includes('agreement'));
 run(`renderJourney({client_id:'fixture',stage:'contract',funding_mode:'personal',payment_handled_externally:true,contract_title:'QA agreement',contract_version:'QA',contract_body:'QA only'});`);assert.equal(doc.querySelectorAll('.journey-steps li').length,4);assert(!doc.querySelector('.journey-steps').textContent.includes('Payment'));assert(doc.querySelector('#journeySign'));
 console.log('PASS: full deferred modules, six destinations including Check-in, collapsed recipes/week, favourites, log/undo, swaps preserve assignments, quick logging, progress subnav, client reset, failed saves, backend reload and consent gates. DOM/backend mocks, not production browser evidence.');
 dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

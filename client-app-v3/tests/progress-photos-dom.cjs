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
run(`preview('client');state.client.goal_weight_kg=null;state.client.goal_summary='Maintain weight, build strength and improve recovery.';state.clientView='progress';state.data.files=[{file_type:'progress_photo',week_number:1,photo_view:'front',storage_path:'private/front1',created_at:'2026-10-01'},{file_type:'progress_photo',week_number:2,photo_view:'front',storage_path:'private/front2',created_at:'2026-10-08'}];renderClient();`);
assert(run("clientRows([{id:'rounding',display_name:'Goal fixture',weight_unit:'lbs',goal_weight_kg:99.79}])").includes('220 lb'),'Roster rounds the saved goal instead of truncating it');
assert(Number.isNaN(run('progressData().goal')),'Unset weight target stays unknown');
assert(!doc.querySelector('.progress-metrics').textContent.includes('0.0 lb'));
assert.equal(doc.querySelectorAll('.photo-compare-pair [data-photo-path]').length,2);
run(`state.role='coach';clientProgress();`);assert(doc.querySelector('#clientMain [data-agreed-goal]'),'Coach viewing the client sees the same goal focus');assert.equal(doc.querySelectorAll('#clientMain .photo-compare-pair [data-photo-path]').length,2);run(`state.role='client';`);
assert.equal(doc.querySelector('[data-photo-before]').value,'1');assert.equal(doc.querySelector('[data-photo-after]').value,'2');
doc.querySelector('[data-photo-view]').value='side';doc.querySelector('[data-photo-view]').dispatchEvent(new dom.window.Event('change'));assert(doc.querySelector('.photo-compare-pair').textContent.includes('No side photo'));
assert(doc.querySelector('input[capture=environment]'),'Dedicated phone camera chooser');assert(doc.querySelector('input[name=photo]:not([capture])'),'File/gallery chooser retained');
assert.equal(run("clientGoalText('Build strength. Source: https://fathom.video/calls/example')"),'Build strength.');
run(`state.data.nutritionPlans=[{id:'p',client_id:state.client.id,is_active:true,name:'Everyday menu',calories:1800,protein_g:130,carbs_g:200,fat_g:50}];state.data.nutritionDays=[{week_id:state.data.weeks[0].id,nutrition_date:localCoachingDate(),nutrition_plan_id:'p'}];state.data.mealAssignments=[{nutrition_plan_id:'p',meal:{id:'a',name:'Chicken bowl',meal_type:'Lunch',calories:500,protein_g:40,carbs_g:60,fat_g:10,ingredients:[]}},{nutrition_plan_id:'p',meal:{id:'b',name:'Chicken bowl',meal_type:'Lunch',calories:500,protein_g:40,carbs_g:60,fat_g:10,ingredients:[]}},{nutrition_plan_id:'p',meal:{id:'c',name:'Chicken bowl',meal_type:'Lunch',calories:600,protein_g:50,carbs_g:70,fat_g:12,ingredients:[]}}];state.clientView='nutrition';renderClient();`);
doc.querySelector('#dnLibrary').click();assert.equal(doc.querySelectorAll('.dn-library-results article').length,1,'A recipe family appears once');assert.equal(doc.querySelectorAll('[data-dn-variant] option').length,2,'Exact copies removed; distinct portions preserved');
const variant=doc.querySelector('[data-dn-variant]');variant.value='1';variant.dispatchEvent(new dom.window.Event('change'));assert(doc.querySelector('[data-dn-variant-summary]').textContent.includes('600'));
doc.querySelector('[data-dn-library-recipe]').click();assert(doc.querySelector('[role=dialog]').textContent.includes('600'),'Selected portion opens matching recipe');
run(`state.data.coachingGuidance=[{published:true,category:'recovery',title:'Recovery',body:'Keep the agreed routine. Source: https://fathom.video/calls/example'}];`);assert(!run('coachingGuidanceMarkup()').includes('fathom.video'));assert(run('state.data.coachingGuidance[0].body').includes('fathom.video'),'Private source evidence remains saved');
console.log('PASS: unset goals, private matching-view photos, separate camera/gallery inputs and grouped recipe portions.');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exit(1)});

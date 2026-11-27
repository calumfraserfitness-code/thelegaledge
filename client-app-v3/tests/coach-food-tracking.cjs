const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const {JSDOM}=require('jsdom');
const M=require('../daily-nutrition-model.js');
const today='2026-11-27',clientId='tracking-client',week='2026-11-23',days=Array.from({length:7},(_,i)=>({date:'2026-11-'+(23+i),keys:['breakfast-1','lunch-1','dinner-1','snacks-1']}));
const meal={calories:400,protein_g:30,carbs_g:40,fat_g:10};
const record=(date,key,eaten=true,owner=clientId,snapshot=meal)=>({client_id:owner,entry_date:date,slot_key:key,eaten,servings:1,meal_snapshot:snapshot});
const entries=[
 ...['breakfast-1','lunch-1','snacks-1'].map(k=>record('2026-11-23',k)),
 ...days[0].keys.map(k=>record('2026-11-24',k)),
 record('2026-11-25','breakfast-1',false),record('2026-11-25','lunch-1',false),
 record('2026-11-26','breakfast-1'),record('2026-11-26','snacks-1'),record('2026-11-26','lunch-1',false),
 record(today,'quick-other'),record('2026-11-25','breakfast-1',true,'peer'),record('2026-11-28','lunch-1')
];
const summary=M.trackingSummary({days,entries,today,clientId,startDate:week});
assert.deepEqual([summary.daysPercentage,summary.mealsPercentage,summary.completePercentage],[75,56,25]);
assert.equal(summary.rows.length,5);
assert.equal(summary.rows[2].totals.calories,null,'An unlogged or swapped meal is not consumption');
assert.equal(summary.rows[3].totals.calories,800);
assert.equal(summary.rows[4].extra,1,'Today and other records are shown but not counted in completed days');
assert.equal(M.trackingSummary({days,entries,today:week,clientId,startDate:week}).daysPercentage,null,'No completed days cannot imply a zero percent score');
assert.equal(M.trackingSummary({days,entries:[record(week,'breakfast-1',true,clientId,{calories:400})],today,clientId,startDate:week}).rows[0].totals.protein_g,null);
const dom=new JSDOM('<div id="clientWorkspaceBody"></div>',{runScripts:'outside-only'}),w=dom.window,reads=[];
const meals=[{meal_type:'Breakfast',name:'Breakfast'},{meal_type:'Lunch',name:'Lunch'},{meal_type:'Dinner',name:'Dinner'},{meal_type:'Snack',name:'Snack'}];
const state={role:'coach',preview:false,user:{id:'coach'},client:{id:clientId,start_date:week},clientTab:'overview',data:{weeks:[{id:'week',week_start:week,published:true,client_id:clientId}],nutritionDays:days.map(d=>({week_id:'week',nutrition_date:d.date,nutrition_plan_id:'p'})),nutritionPlans:[{id:'p',client_id:clientId}],coachingGuidance:[{client_id:clientId,category:'meal_example',title:'Your food tracking routine',published:true}],checkins:[]}};
Object.assign(w,{DailyNutrition:M,state,$:s=>w.document.querySelector(s),esc:s=>String(s??''),fmt:s=>s,localCoachingDate:()=>today,mealsForNutritionPlan:()=>meals,coachOverview:()=>{w.$('#clientWorkspaceBody').innerHTML='<p>Overview</p>';},coachNutrition:()=>{w.$('#clientWorkspaceBody').innerHTML='<div class="coach-daily-workspace"></div>';},renderClientWorkspace:()=>w.coachNutrition(),query:async(_,q)=>await q,db:{from(table){assert.equal(table,'client_food_entries');let filter={};return {select(){return this},eq(k,v){filter[k]=v;return this},gte(k,v){filter.after=v;return this},lte(k,v){filter.before=v;return this},order(){return this},range(){reads.push({...filter});return Promise.resolve(entries.filter(r=>r.client_id===filter.client_id&&r.entry_date>=filter.after&&r.entry_date<=filter.before))}};}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../coach-food-tracking.js'),'utf8'),dom.getInternalVMContext());
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{
 w.coachOverview();await tick();
 assert.deepEqual([...w.document.querySelectorAll('.cft-metric strong')].map(x=>x.textContent),['75%','56%','25%']);
 assert.equal(reads[0].client_id,clientId);assert.equal(reads[0].after,week);assert.equal(reads[0].before,today);
 assert(!w.document.querySelector('.cft-table-scroll'));
 w.$('[data-cft-open]').click();await tick();assert.equal(state.clientTab,'nutrition');
 assert(w.document.querySelector('.cft-table-scroll'));assert.match(w.document.querySelector('.cft-table-scroll').textContent,/3 \/ 4 \(75%\)/);
 assert.match(w.document.querySelector('.cft-table-scroll').textContent,/Today · in progress/);
 w.$('[data-cft-prev]').click();await tick();assert.equal(reads.at(-1).after,'2026-11-16');
 w.$('[data-cft-current]').click();await tick();assert.equal(reads.at(-1).after,week);
 const count=reads.length;state.client={id:'peer',start_date:week};w.coachOverview();await tick();assert(!w.document.querySelector('[data-cft]'));assert.equal(reads.length,count,'Optional trackers do not get a logging score or query');
 state.role='client';state.client={id:clientId};w.coachOverview();await tick();assert(!w.document.querySelector('[data-cft]'),'Never expose coach score on client view');
 dom.window.close();console.log('PASS coach food tracking: coverage, distinct records, no inferred intake, private scope, week navigation and optional clients');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

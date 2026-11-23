const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="clientMain"></main><div id="clientWorkspaceBody"></div>',{runScripts:'outside-only'}),w=dom.window;
const planWeek={id:'week',week_start:'2026-10-12',published:true,client_id:'client'};
const session=(id,title,training_type,fields={})=>({id,title,training_type,week_id:'week',client_id:'client',status:'planned',session_date:'2026-10-14',...fields});
const plan=[
 session('completed','Already done','weights',{status:'completed'}),
 session('a','Full body A','weights',{programme_day_id:'day-a'}),
 session('b','Full body B','weights',{programme_day_id:'day-b'}),
 session('bike','Easy cycle','cardio'),
 session('bonus','Optional run','cardio',{source_metadata:{optional:true}}),
 session('peer','Peer workout','weights',{client_id:'peer'})
];
const state={user:{id:'user'},role:'client',client:{id:'client',onboarding_status:'complete',plan_status:'published'},clientView:'training',
 data:{weeks:[planWeek],sessions:plan,programs:[],nutritionDays:[{week_id:'week',nutrition_plan_id:'quick',nutrition_date:'2026-10-12'}],nutritionPlans:[{id:'quick',client_id:'client',day_type:'Busy Day'}],coachingGuidance:[{client_id:'peer',published:true,category:'eating_out',body:'Private meal'}]}};
let settings={published:true,heavy_day_a:'day-b',heavy_sessions:3,crisis_sessions:2,office_food:'Pack the lunch you agreed with Calum.'};
let saved=null,lastView,mealDate;
function table(name){
 let client;
 return {select(){return this;},eq(field,value){if(field==='client_id')client=value;return this;},then(resolve){
  const row=client==='client'&&(name==='client_busy_week_settings'?settings:name==='client_busy_weeks'?saved:null);
  resolve({data:row?[row]:[]});
 }};
}
const $=s=>w.document.querySelector(s),tick=()=>new Promise(r=>setTimeout(r,0));
Object.assign(w,{state,$,esc:s=>String(s??'').replace(/</g,'&lt;'),fmt:s=>s,localCoachingDate:()=> '2026-10-12',
 db:{from:table,rpc(){throw Error('The guide should not write changes');}},query:async(_,promise)=>(await promise).data,
 clientTrainingWeek:()=>state.data.weeks[0],mealsForNutritionPlan:()=>[{name:'Assigned packed lunch',meal_type:'Lunch'}],
 renderClient(){lastView=state.clientView;},openDailyNutritionDate(date){mealDate=date;lastView=state.clientView;},
 clientPlanner(){state.clientView='planner';$('#clientMain').innerHTML='<section class="client-page-head">Schedule</section>';},
 clientTraining(){state.clientView='training';$('#clientMain').innerHTML='<div class="training-category-tabs">Training</div>';},
 clientCheckin(){state.clientView='checkin';$('#clientMain').innerHTML='Check-in';},
 coachOverview(){},loadClientData:async()=>{}
});
for(const file of ['busy-week-model.js','busy-week.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),dom.getInternalVMContext());
(async()=>{
 w.clientTraining();await tick();
 let card=$('#bwOptional');
 assert(card&&!card.open);
 assert.equal($('.training-category-tabs').nextElementSibling,card);
 assert.match(card.textContent,/Drop 2 sessions.*Full body B · Full body A/s);
 assert.match(card.textContent,/Drop 3 sessions.*Full body B/s);
 assert.match(card.textContent,/Pack the lunch you agreed/);
 assert.doesNotMatch(card.textContent,/Peer workout|Private meal/);
 assert.match(card.textContent,/Skip this week Easy cycle · Optional run/);
 assert.equal($('#bwWeekForm'),null);
 card.querySelector('[data-bw-meals]').click();assert.equal(lastView,'nutrition');assert.equal(mealDate,'2026-10-12');
 assert.equal(state.data.sessions[1].status,'planned');
 settings=null;await w.loadClientData('client');w.clientPlanner();await tick();
 card=$('#bwOptional');assert.match(card.textContent,/Drop 1 session/);assert.match(card.textContent,/Drop 2 sessions/);assert.match(card.textContent,/Assigned packed lunch/);
 saved={mode:'review',week_start:planWeek.week_start};await w.loadClientData('client');w.clientTraining();await tick();
 assert.match($('#bwOptional').textContent,/Pause any affected training/);
 assert.doesNotMatch($('#bwOptional').textContent,/Prioritise/);
 state.client={...state.client,id:'peer'};state.data.weeks=[{...planWeek,client_id:'peer'}];w.clientTraining();await tick();
 assert.doesNotMatch($('#bwOptional').textContent,/Pack the lunch|Full body/);
 w.clientCheckin();w.BusyWeekAccess.mount();assert.equal($('#bwOptional'),null);
 state.client.onboarding_status='pending_legal';w.clientTraining();assert.equal($('#bwOptional'),null);
 console.log('PASS private, plan-specific busy-week guide, published preferences, no writes and health review.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>w.close());

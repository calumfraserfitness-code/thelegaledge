const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="clientMain"></main>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
const $=s=>w.document.querySelector(s), tick=()=>new Promise(resolve=>setImmediate(resolve));
const client={id:'client',display_name:'Katherine <safe>',onboarding_status:'complete',plan_status:'published',
 timezone:'Europe/Dublin',checkin_day:1,checkin_due_time:'09:00',goal_summary:'Build strength and keep a regular meal routine',weight_unit:'lbs'};
let routed=0;
Object.assign(w,{$,esc:v=>String(v??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),fmt:v=>v,
 state:{client,role:'client',clientView:'today',user:{id:'account'},data:{weeks:[],sessions:[],checkins:[]}},
 renderClient(){routed++;},mealsForNutritionPlan:plan=>plan.meals,
 clientToday(){$('#clientMain').innerHTML='<form id="legalGate">Consent</form>';},
 openDailyNutritionDate(date){w.selectedMealDate=date;},coachingJoinUrl:url=>url?.startsWith('https://meet.google.com/')?url:''
});
for(const name of ['checkin-status-model.js','personal-coaching-home.js'])w.eval(fs.readFileSync(require.resolve('../'+name),'utf8'));
const M=w.CheckinStatus,S=w.state,home=w.PersonalCoachingHome;
const now=new Date(),period=M.week(client,now),date=M.localDate(now,client.timezone);
S.data.weeks=[{id:'published',client_id:'client',week_start:period,published:true}];
S.data.sessions=[
 {id:'done',week_id:'published',title:'Completed session',training_type:'weights',status:'completed',session_date:period},
 {id:'action',week_id:'published',title:'Assigned cardio',status:'planned',session_date:period,training_type:'cardio'},
 {id:'peer',week_id:'published',client_id:'peer',title:'Peer session',status:'planned',session_date:period}
];
(async()=>{
 S.data.coachingGoals=[{client_id:'client',status:'active',title:'Weight milestone',metric:'weight_kg',target:70,unit:'kg'},
  {client_id:'peer',status:'active',title:'Private peer goal',target:2}];
 S.data.coachingCalls=[{client_id:'peer',status:'scheduled',scheduled_at:new Date(+now+3600000).toISOString(),join_url:'https://meet.google.com/peer'},
  {client_id:'client',status:'cancelled',scheduled_at:new Date(+now+3600000).toISOString(),join_url:'https://meet.google.com/cancelled'},
  {client_id:'client',status:'scheduled',scheduled_at:new Date(+now+7200000).toISOString(),join_url:'https://meet.google.com/abc-defg-hij'}];
 const approved={client_id:'client',approved_at:now.toISOString(),starts_on:date,expires_on:date,
  description:'1. Keep two sessions\n2. Pack lunch'};
 S.data.checkins=[{client_id:'client',period_start:period,reviewed_at:new Date(+now-3600000).toISOString(),focus_next_week:'Book a slot'}];
 assert.equal(home.nextAgreedAction(client,S.data,[approved],date),'Keep two sessions');
 assert.equal(home.nextAgreedAction(client,S.data,[{...approved,completed_at:date},{...approved,client_id:'peer'}],date),'Book a slot');
 w.CoachingFollowThrough={approvedActions:async()=>[approved]};

 w.clientToday();
 const root=$('#personalCoachingHome');
 await tick();
 assert.equal($('[data-pch-video]').nextElementSibling.querySelector('.pch-agreed p').textContent,'Keep two sessions');
 assert.equal(root.querySelector('h1').textContent,'Hi, Katherine');
 assert.equal(root.querySelectorAll('.pch-plan > section').length,1);
 assert.equal(root.querySelector('.pch-next h2').textContent,'Assigned cardio');
 assert(!root.querySelector('nav'),'Today does not repeat the app navigation');
 assert.equal(root.querySelector('progress').value,1);
 assert.equal(root.querySelector('progress').max,2);
 assert.match(root.querySelector('.pch-coaching').textContent,/Build strength and keep a regular meal routine/);
 assert(!root.textContent.includes('Peer session'));
 assert.match(root.querySelector('.pch-coaching').textContent,/154.3 lb/);
 assert(!root.textContent.includes('Private peer goal'));
 assert.equal(root.querySelector('.pch-call-summary a').href,'https://meet.google.com/abc-defg-hij');
 $('#clientMain').insertAdjacentHTML('beforeend','<section id="lateWidget">Legacy card</section><p id="coachingConnectionStatus">Offline</p>');
 await tick();
 assert(!$('#lateWidget'),'Late widgets cannot reappear on Today');
 assert($('#coachingConnectionStatus'));
 root.querySelector('[data-pch-next]').click();
 assert.equal(S.selectedSessionId,'action');
 assert.equal(S.trainingCategory,'cardio');
 assert.equal(routed,1);
 S.clientView='today';S.user.id='different';root.querySelector('[data-pch-next]').click();
 assert.equal(routed,1,'Old account shortcuts cannot navigate');
 S.user.id='account';client.onboarding_status='pending_legal';w.clientToday();
 assert($('#legalGate')&&!$('#personalCoachingHome'));
 client.onboarding_status='complete';client.plan_status='draft';w.clientToday();
 assert($('#legalGate')&&!$('#personalCoachingHome'),'Unpublished plan gate is preserved');
 client.plan_status='published';
 const fixed=new Date('2026-11-02T12:00:00Z');
 assert.equal(home.model(client,{weeks:[],sessions:[],checkins:[]},fixed).action.route,'checkin');
 assert.equal(home.model({...client,weekly_checkin_enabled:false},{weeks:[],sessions:[],checkins:[]},fixed).action.route,'support');
 const firstMonday=new Date(date+'T12:00:00Z');
 firstMonday.setUTCDate(firstMonday.getUTCDate()+7-((firstMonday.getUTCDay()+6)%7));
 client.start_date=firstMonday.toISOString().slice(0,10);
 S.data.weeks=[{id:'upcoming',client_id:'client',week_start:client.start_date,published:true}];
 S.data.nutritionDays=[{week_id:'upcoming',nutrition_date:client.start_date,nutrition_plan_id:'menu'}];
 S.data.nutritionPlans=[{id:'menu',client_id:'client',meals:[{name:'Assigned breakfast'}]}];
 w.clientToday();
 assert.match($('.pch-next h2').textContent,/Your first week starts/);
 assert(! $('[data-pch-route=checkin]'));
 assert.match($('.pch-meals').textContent,/Assigned breakfast/);
 $('[data-pch-meals]').click();
 assert.equal(S.clientView,'nutrition');
 assert.equal(w.selectedMealDate,client.start_date);
 console.log('PASS simple Today, one next action, retained navigation, late-widget removal and plan/owner gates.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>w.close());

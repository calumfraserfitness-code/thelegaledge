const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="clientMain"></main>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let pending=[],routed=0,videoClicks=0,queries=0;
const chain=()=>new Proxy({}, {get:(o,k)=>k==='then'?undefined:()=>chain()});
Object.assign(w,{$:s=>w.document.querySelector(s),esc,db:{from:chain},query:()=>{queries++;return new Promise(resolve=>pending.push(resolve));},renderClient(){routed++;},clientToday(){
 w.$('#clientMain').innerHTML='<header class="page-head">Old heading</header><section id="cvLatest"><iframe src="https://www.loom.com/embed/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"></iframe><button>Watch feedback</button></section><div class="priority-grid"><section class="priority-training">Prior session</section><section>Meals & swaps<button id="keepHandler">Meals</button></section></div><section class="priority-progress">Saved progress</section><section id="cfClient">Saved call actions</section>';
 w.$('#cvLatest button').onclick=()=>videoClicks++;
},state:{role:'client',preview:false,clientView:'today',user:{id:'user-a'},client:{id:'a',display_name:'Client <safe>',onboarding_status:'complete',goal_summary:'Maintain strength <safely>',timezone:'Europe/Dublin',checkin_day:5,checkin_due_time:'23:59:00'},data:{weeks:[],sessions:[],coachingGoals:[],checkins:[]}}});
vm.runInContext(fs.readFileSync(__dirname+'/../checkin-status-model.js','utf8'),dom.getInternalVMContext());
const date=w.CheckinStatus.localDate(new Date(),'Europe/Dublin'),period=w.CheckinStatus.week(w.state.client),fixed=new Date('2026-11-02T12:00:00Z');
w.state.data.weeks=[{id:'week-a',client_id:'a',published:true,week_start:period,coach_note:'Keep two manageable sessions.'},{id:'peer-week',client_id:'peer',published:true,week_start:period,coach_note:'PRIVATE PEER FOCUS'}];
// This case exercises session navigation, irrespective of the real weekday deadline.
w.state.data.checkins=[{id:'current-checkin',client_id:'a',period_start:period,submitted_at:date+'T12:00:00Z'}];
w.state.data.sessions=[{id:'first',week_id:'week-a',title:'First unfinished session',session_date:period,status:'planned',training_type:'weights'},{id:'next',week_id:'week-a',title:'Second session',session_date:date,status:'planned',training_type:'weights'},{id:'peer',week_id:'peer-week',title:'PRIVATE PEER SESSION',session_date:period,status:'planned',training_type:'weights'}];
vm.runInContext(fs.readFileSync(__dirname+'/../personal-coaching-home.js','utf8'),dom.getInternalVMContext());
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const model=w.PersonalCoachingHome.model(w.state.client,{weeks:[{id:'fixed',client_id:'a',published:true,week_start:'2026-11-02'}],sessions:[],checkins:[]},fixed);assert.equal(model.action.route,'support','No sessions does not claim all sessions completed');
 w.clientToday();assert(w.$('#personalCoachingHome'));assert.equal(w.document.querySelectorAll('#personalCoachingHome').length,1);assert(!w.$('[data-pch-secondary]').open);assert(w.$('[data-pch-secondary-content] .priority-grid'));assert(w.$('.pch-goal').textContent.includes('Maintain strength <safely>'));assert(w.$('.pch-goal').innerHTML.includes('&lt;safely&gt;'));assert(!w.$('#personalCoachingHome').textContent.includes('PRIVATE'));
 const video=w.$('#cvLatest');assert(w.$('[data-pch-video] #cvLatest'));video.querySelector('button').click();assert.equal(videoClicks,1,'Existing video handlers survive');
 assert.equal(pending.length,1);pending.shift()([{id:'focus',client_id:'a',approved_at:date,starts_on:period,expires_on:'2099-12-31',description:'Published action',completed_at:null},{id:'future',client_id:'a',approved_at:date,starts_on:'2099-01-01',expires_on:'2099-12-31',description:'FUTURE ACTION'}]);await tick();assert(w.$('[data-pch-focus]').textContent.includes('Keep two manageable sessions.'));assert(!w.$('[data-pch-focus]').textContent.includes('FUTURE'));
 w.PersonalCoachingHome.mount();assert.equal(w.document.querySelectorAll('#personalCoachingHome').length,1,'Repeated mount is idempotent');assert.equal(queries,1);
 // The feedback module prepends an unchanged player during its refresh. Reuse it in the home slot.
 w.$('#clientMain').prepend(video);await tick();await tick();assert.equal(w.$('[data-pch-video] #cvLatest'),video);assert.equal(w.document.querySelectorAll('iframe').length,1);
 w.$('[data-pch-next]').click();assert.equal(w.state.selectedSessionId,'first');assert.equal(w.state.clientView,'training');assert.equal(routed,1);
 w.state.clientView='today';const old=w.$('[data-pch-next]');w.state.user.id='different';old.click();assert.equal(routed,1,'Stale owner cannot route a saved session');
 w.state.user.id='user-a';w.state.client.onboarding_status='pending_legal';w.$('#clientMain').innerHTML='<form id="legalGate">Consent</form>';w.PersonalCoachingHome.mount();assert(w.$('#legalGate'));assert(!w.$('#personalCoachingHome'),'Consent gate remains untouched');
 // Pure model includes only the current owned published week, with check-in deadlines taking priority.
 const overdue=w.PersonalCoachingHome.model({...w.state.client,checkin_day:1,checkin_due_time:'09:00:00'}, {weeks:[],sessions:[],checkins:[]},fixed);assert.equal(overdue.action.route,'checkin');
 const hidden=w.PersonalCoachingHome.model(w.state.client,{weeks:[{id:'draft',client_id:'a',published:false,week_start:'2026-11-02',coach_note:'DRAFT SECRET'}],sessions:[{id:'draft-session',week_id:'draft',title:'DRAFT SECRET'}]},fixed);assert.equal(hidden.focus,'');assert.equal(hidden.action.route,'support');
 dom.window.close();console.log('PASS personal home: owned published goal/focus, one flexible action, existing video reuse, collapsed tools, idempotent layout, empty evidence and stale/consent guards');
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close();});

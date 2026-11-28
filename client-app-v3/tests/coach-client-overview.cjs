const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="clientWorkspaceBody"></div>',{runScripts:'outside-only'}),w=dom.window;
const now=new Date('2026-11-28T15:00:00Z'),c={id:'a',timezone:'America/New_York',start_weight_kg:82,goal_summary:'Strength · Build consistency\nSleep · Steady bedtime'};
const d={weeks:[{id:'w',client_id:'a',week_start:'2026-11-23',published:true},{id:'peer',client_id:'peer',week_start:'2026-11-23',published:true}],sessions:[
{week_id:'w',title:'Strength A',session_date:'2026-11-24',status:'completed',training_type:'weights'},
{week_id:'w',title:'Strength B',session_date:'2026-11-28',status:'planned',training_type:'weights'},
{week_id:'w',title:'Optional workout',session_date:'2026-11-29',status:'planned',training_type:'weights',source_metadata:{optional:true}},
{week_id:'w',title:'Breathing',session_date:'2026-11-28',status:'planned',training_type:'mobility'},
{week_id:'peer',title:'PEER SECRET',status:'completed',training_type:'weights'}],
progress:[{client_id:'a',entry_date:'2026-11-27',weight_kg:80},{client_id:'peer',entry_date:'2026-11-28',weight_kg:500}],
checkins:[{client_id:'a',submitted_at:'2026-11-27T10:00:00Z',period_start:'2026-11-23'}],
nutritionDays:[{week_id:'w',nutrition_date:'2026-11-28',nutrition_plan_id:'menu'}],nutritionPlans:[{id:'menu',client_id:'a',name:'Everyday menu'}],
coachingCalls:[{client_id:'a',scheduled_at:'2026-12-11T17:00:00Z',status:'scheduled'},{client_id:'peer',scheduled_at:'2026-11-29T17:00:00Z',status:'scheduled'}],
coachingGuidance:[{client_id:'a',published:true,title:'Call recap · 2026-11-27',body:'Keep your routine.'}]};
let calls=0,edits=0;
Object.assign(w,{CheckinStatus:require('../checkin-status-model.js'),LegalEdgePriorities:{currentCheckin:(c,r)=>({label:'Submitted',saved:r[0]})},state:{user:{id:'coach'},client:c,data:d,role:'coach',clientTab:'overview',preview:false},$:s=>w.document.querySelector(s),esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),fmt:v=>String(v).slice(0,10),displayWeight:v=>v+' kg',coachingTextMarkup:v=>'<p>'+v+'</p>',coachOverview(){w.$('#clientWorkspaceBody').innerHTML='<section class="panel" id="old"><button id="edit">Edit</button></section><section data-cft id="food">Food tracking</section>';w.$('#edit').onclick=()=>edits++;},renderClientWorkspace(){calls++;if(w.state.clientTab==='overview')w.coachOverview();else w.$('#clientWorkspaceBody').innerHTML='<p>Editor</p>';}});
vm.runInContext(fs.readFileSync(__dirname+'/../coach-client-overview.js','utf8'),dom.getInternalVMContext());
const m=w.CoachClientOverview.model(c,d,now,false);
assert.equal(m.required.length,2);assert.equal(m.completed,1);assert.equal(m.extra.length,1);assert.equal(m.next.title,'Strength B');assert.equal(m.weight.v,80);assert.equal(m.plan.name,'Everyday menu');assert.equal(m.call.scheduled_at,'2026-12-11T17:00:00Z');
w.renderClientWorkspace();const more=w.$('#coachOverviewMore');assert(more&&!more.open);assert(w.$('#old').closest('#coachOverviewMore'));assert(!w.$('#food').closest('#coachOverviewMore'));assert(!w.$('#coachClientOverview').textContent.includes('PEER SECRET'));w.$('#edit').click();assert.equal(edits,1,'existing editor listener preserved');
w.CoachClientOverview.arrange();assert.equal(w.document.querySelectorAll('#coachOverviewMore').length,1);assert.equal(w.$('#coachOverviewMore'),more);
const late=w.document.createElement('section');late.id='late';w.$('#clientWorkspaceBody').append(late);
(async()=>{await new Promise(r=>setTimeout(r,0));assert(late.closest('#coachOverviewMore'),'late advanced tool kept folded');w.$('[data-cov-route="nutrition"]').click();assert.equal(w.state.clientTab,'nutrition');assert.equal(calls,2);assert(!w.$('#coachClientOverview'));dom.window.close();console.log('PASS compact coach summary: scoped records, optional practice excluded, existing editor handlers, tracking stays visible, late tool folded, direct navigation');})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});

const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),dom=new JSDOM('<main id="clientMain"></main>',{url:'https://example.invalid',runScripts:'outside-only'}),w=dom.window;
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
let toasts=[],sent=[],savedWeight=null,already=false;
Object.assign(w,{$:s=>w.document.querySelector(s),$$:s=>[...w.document.querySelectorAll(s)],esc,finiteRecorded:v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)),fmt:s=>s,iso:d=>d.toISOString().slice(0,10),monday:()=>new Date('2026-11-02T12:00:00Z'),currentWeek:()=>({week_number:4}),preferredHealthDays:()=>[],clientHeader:()=>'',checkinCard:()=>'<details class="checkin-card"><summary>Saved answers</summary></details>',displayWeight:n=>(Number(n)*(w.state.client.weight_unit==='lbs'?2.2046226218:1)).toFixed(1)+' '+(w.state.client.weight_unit==='lbs'?'lb':'kg'),setBusy(){},toast:s=>toasts.push(s),checkinAudioFile:null,storeCheckinAudio:async()=>{},storeProgressPhoto:async()=>{},state:{role:'client',preview:false,user:{id:'owner'},client:{id:'client',weight_unit:'kg'},data:{progress:[{client_id:'client',entry_date:'2026-10-29',weight_kg:82.4},{client_id:'other',entry_date:'2026-11-04',weight_kg:999}],checkins:[{client_id:'client',submitted_at:'2026-11-01T12:00:00Z',weight_kg:81.7}],files:[]}},db:{rpc:(name,payload)=>(sent.push({name,payload}),payload)},query:async()=>({checkin:{id:'saved-checkin',client_id:'client',period_start:'2026-11-02',submitted_at:'2026-11-04T12:00:00Z',weight_kg:savedWeight},already_submitted:already})});
w.CheckinStatus={week:()=> '2026-11-02'};
const source=fs.readFileSync(path.join(root,'coaching-refresh.js'),'utf8'),start=source.indexOf('function checkinWeightReference()'),end=source.indexOf('\nconst refreshSampleBefore',start);
vm.runInContext(source.slice(start,end),dom.getInternalVMContext());
const workspace=fs.readFileSync(path.join(root,'coaching-workspace.js'),'utf8'),submitStart=workspace.indexOf('async function submitAtomicCoachingCheckin('),submitEnd=workspace.indexOf('\ndocument.addEventListener',submitStart);
vm.runInContext(workspace.slice(submitStart,submitEnd),dom.getInternalVMContext());
function form(){return w.$('#checkinForm');}
function event(){return {preventDefault(){},target:form(),submitter:w.$('#checkinSubmit')};}
(async()=>{
 w.clientCheckin();let weight=form().elements.weight_display;
 assert.equal(form().querySelectorAll('[name="weight_display"]').length,1);
 assert(!weight.closest('details'),'Weight is part of the main check-in, outside the optional disclosure');
 assert.equal(weight.closest('[data-checkin-stage]').dataset.checkinStage,'1');
 assert(!weight.required,'A check-in does not require a weigh-in');assert.equal(weight.value,'','The prior measurement must never become a new measurement');
 assert(w.$('#checkinWeightHelp').textContent.includes('81.7 kg · 2026-11-01'),'Latest dated check-in wins over older progress');
 assert(!w.$('#checkinWeightHelp').textContent.includes('999'),'Another client’s record cannot become a reference');
 w.$('#checkinNext').click();assert(!weight.closest('[data-checkin-stage]').hidden,'Weight appears in the normal Continue path');
 w.state.client.weight_unit='lbs';w.clientCheckin();assert(form().elements.weight_display.closest('label').textContent.includes('lb'));assert(w.$('#checkinWeightHelp').textContent.includes('180.1 lb'));assert.equal(form().elements.weight_display.value,'');
 w.state.data.progress=[];w.state.data.checkins=[{client_id:'client',submitted_at:'2026-11-01',weight_kg:''},{client_id:'client',submitted_at:'2026-10-31',weight_kg:0}];w.clientCheckin();assert(w.$('#checkinWeightHelp').textContent.includes('No weigh-in saved yet'));assert(!w.$('#checkinWeightHelp').textContent.includes('0.0'));
 await w.submitAtomicCoachingCheckin(event());assert(!('weight_kg' in sent.at(-1).payload.answers),'Leaving weight blank must not re-submit the previous value');assert(toasts.at(-1).includes('Submitted to your coach · no weight supplied'));assert(w.$('[data-checkin-weight-receipt]').textContent.includes('No weight was supplied'));assert(w.document.body.textContent.includes('Saved for Calum to review'));
 w.state.data.checkins=[];w.clientCheckin();form().elements.weight_display.value='180';savedWeight=180/2.2046226218;await w.submitAtomicCoachingCheckin(event());assert(Math.abs(sent.at(-1).payload.answers.weight_kg-savedWeight)<0.000001,'lb entry is converted once');assert(toasts.at(-1).includes('weight included'));assert(w.$('[data-checkin-weight-receipt]').textContent.includes('180.0 lb'));
 w.state.data.checkins=[];w.clientCheckin();form().elements.weight_display.value='175';already=true;await w.submitAtomicCoachingCheckin(event());assert(toasts.at(-1).includes('no new answers saved'),'Duplicate submission cannot imply the new form answers replaced a saved check-in');
 // Draft receipts explicitly distinguish typing from a completed submission.
 w.state.data.checkins=[];w.clientCheckin();let saveTimer;
 w.setTimeout=fn=>(saveTimer=fn,1);w.clearTimeout=()=>{};
 w.db.from=()=>{const q={select:()=>q,eq:()=>q,maybeSingle:()=>Promise.resolve({data:null}),upsert:()=>q,then:resolve=>Promise.resolve({error:null}).then(resolve)};return q;};
 vm.runInContext(fs.readFileSync(path.join(root,'checkin-drafts.js'),'utf8'),dom.getInternalVMContext());w.clientCheckin();
 assert(form().textContent.includes('draft saves privately'));form().elements.weight_display.value='180';form().dispatchEvent(new w.Event('input'));await saveTimer();await new Promise(resolve=>setImmediate(resolve));
 assert(form().textContent.includes('Draft saved privately. Submit your check-in for Calum to review.'));
 console.log('PASS: visible optional weigh-in, dated saved reference, empty-value honesty, unit conversion, submitted-weight receipts and private draft clarity.');dom.window.close();
})().catch(error=>{console.error(error);process.exit(1)});

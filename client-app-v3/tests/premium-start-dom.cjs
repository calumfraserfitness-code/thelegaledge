// Run with NODE_PATH pointing to jsdom 26.1.0. No browser or production writes.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dom=new JSDOM(html,{url:'https://example.invalid/',runScripts:'outside-only',pretendToBeVisual:true});
dom.window.HTMLElement.prototype.scrollIntoView=function(){};dom.window.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'playbook/content.json'),'utf8'))});
const tables={client_welcome_receipts:[],onboarding_responses:[],onboarding_journeys:[],coaching_start_resources:[]};let failReceipt=false,copied='';
dom.window.navigator.clipboard={writeText:async s=>{copied=s;}};
dom.window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:null}}),onAuthStateChange(){}},from(table){let payload,filters=[],single=false;const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},not(k,op,v){filters.push(r=>r[k]!==v);return q;},order(){return q;},limit(){return q;},single(){single=true;return q;},insert(p){payload=p;return q;},upsert(p){payload=p;return q;},then(resolve,reject){return Promise.resolve().then(()=>{if(payload){if(failReceipt)return {data:null,error:{message:'Receipt save rejected'}};(tables[table]||=[]).push(payload);}const rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));return {data:single?rows[0]:rows,error:null};}).then(resolve,reject);}};return q;}})};
const ctx=dom.getInternalVMContext();
for(const script of dom.window.document.querySelectorAll('script[src^="./"]')){const file=script.getAttribute('src').split('?')[0].slice(2);vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});}
const run=s=>vm.runInContext(s,ctx),doc=dom.window.document;
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{
await tick();run(`preview('client');state.preview=false;state.role='client';state.user={id:'owner'};state.client={...state.client,id:'new-client',display_name:'Jamie Example',onboarding_status:'pending_legal'};renderClient();`);await tick();await tick();
assert(doc.querySelector('.ps-welcome h1').textContent.includes('Jamie'));assert(doc.querySelector('.ps-art svg'));assert(!doc.querySelector('video'));assert(doc.querySelector('#clientNav').classList.contains('hidden'));
failReceipt=true;doc.querySelector('#journeyContinue').click();await tick();assert(doc.querySelector('.ps-welcome'),'Failed receipt does not skip welcome');assert.equal(tables.client_welcome_receipts.length,0);
failReceipt=false;doc.querySelector('#journeyContinue').click();await tick();await tick();assert.equal(tables.client_welcome_receipts[0].client_id,'new-client');assert(doc.querySelector('#legalGate'),'Consent gate follows welcome');
run('renderClient()');await tick();assert(!doc.querySelector('.ps-welcome'),'Welcome stays completed');
run(`state.client={...state.client,id:'second-client'};renderClient();`);await tick();await tick();assert(doc.querySelector('.ps-welcome'),'A different client has their own welcome');
run(`state.client={...state.client,id:'new-client',onboarding_status:'pending_onboarding'};journeyCurrent=null;renderOnboardingWizard();`);await tick();
assert.equal(doc.querySelectorAll('.ps-intake-panel').length,4);assert.equal([...doc.querySelectorAll('.ps-intake-panel')].filter(p=>!p.hidden).length,1);assert(!doc.querySelector('.ps-intake-extra').open);doc.querySelector('[name=goals]').value='Feel stronger for work';
failReceipt=true;doc.querySelector('#psIntakeNext').click();await tick();assert(doc.querySelector('#psIntakeStep').textContent.includes('1 OF 4'),'Failed draft stays on current step');
failReceipt=false;doc.querySelector('#psIntakeNext').click();await tick();assert(doc.querySelector('#psIntakeStep').textContent.includes('2 OF 4'));assert.equal(tables.onboarding_drafts[0].responses.goals,'Feel stronger for work');
run('renderOnboardingWizard()');await tick();assert.equal(doc.querySelector('[name=goals]').value,'Feel stronger for work');assert(doc.querySelector('#psIntakeStep').textContent.includes('2 OF 4'),'Saved step restored');assert(doc.querySelector('[name=food_restrictions]').required);
const intake={client_id:'new-client',version:3,completed_at:'2026-10-09T16:00:00Z',responses:{sections:{nutrition:{food_restrictions:'Peanut allergy',meals_per_day:3},training:{training_days:2,equipment:'Dumbbells only'}}}};
tables.onboarding_responses.push(intake);
run(`state.role='coach';state.user={id:'coach'};state.clients=[{id:'new-client',display_name:'Jamie Example',status:'active',onboarding_status:'complete',plan_status:'coach_building',weight_unit:'kg'}];state.client=null;state.coachView='onboarding-journeys';renderCoach();`);await tick();await tick();await tick();
assert(doc.querySelector('#psInbox').textContent.includes('Jamie'));doc.querySelector('[data-ps-prompt]').click();await tick();await tick();assert(copied.includes('Peanut allergy'));assert(copied.includes('Dumbbells only'));assert(copied.includes('ONE repeatable'));assert(copied.includes('TRAINING SCHEMA'));
run(`state.client=state.clients[0];state.data.onboarding=${JSON.stringify([intake])};$('#coachMain').innerHTML='<div id="clientWorkspaceBody"></div>';coachOnboarding();`);assert(doc.querySelector('#psCopyPlan'));assert(!doc.querySelector('#completionProfile').closest('details').open,'Profile edits tucked away');
run(`state.preview=true;state.client.onboarding_status='complete';state.client.plan_status='published';state.clientView='learning';renderClient();`);await tick();await tick();await tick();assert(doc.querySelector('.pb-hero').textContent.includes('What do you need help with today?'));
assert(run(`nutritionImportPrompt()`).includes('ONE repeatable'));assert(!run(`nutritionImportPanel()`).includes('seven named weekdays'));
console.log('PASS: personal welcome for legacy first login, failed save retention, persisted acknowledgement, separate client welcome, submitted coach inbox, intake-filled draft prompt, collapsed raw editor, Playbook access, four short intake steps, draft failure/reload and one-menu guidance. DOM mocks.');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

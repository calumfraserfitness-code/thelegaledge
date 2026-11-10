/* Actual built runtime/SDK and synthetic APIs. This never authenticates a real account. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..'),browser=fs.readFileSync(path.join(root,'tests/browser/mobile-coach-flow.cjs'),'utf8');
const fixtureCode=browser.slice(browser.indexOf('const ids='),browser.indexOf('async function checkNoOverflow'));
const {fixture,routeApi,ids}=new Function('crypto','Buffer',fixtureCode+';return {fixture,routeApi,ids};')(crypto,Buffer),store=fixture(),errors=[];let statusCalls=0;
store.tables.coach_client_roadmaps=[{client_id:ids.client,coach_id:ids.coach,revision:1,payload:{version:1,phase:'Synthetic private priority',destination:'Original direction',evidence:'Dated synthetic evidence',goals:[{id:'S1',title:'Useful goal',status:'agreed',detail:'Original agreement'}],trajectory:[{label:'Next review',detail:'Agree before progressing'}],scorecard:'Agreed measures',coach:'Private follow-up',next_call:'Confirm the minimum',review:'Proposed, not booked',sources:[]}}];
class Local extends ResourceLoader{fetch(url){const value=new URL(url);if(value.hostname!=='localhost')return null;const file=path.join(root,value.pathname);return fs.existsSync(file)&&fs.statSync(file).isFile()?Promise.resolve(fs.readFileSync(file)):null;}}
class Socket{constructor(){this.readyState=0;}addEventListener(){}removeEventListener(){}send(){}close(){this.readyState=3;}}
const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>errors.push(error.message));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost/',resources:new Local(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,beforeParse(w){
 w.Response=Response;w.Headers=Headers;w.Request=Request;w.WebSocket=Socket;w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
 w.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url,'http://localhost/');
  if(url.pathname==='/rest/v1/rpc/save_coach_client_roadmap'){
   const args=JSON.parse(options.body),row=store.tables.coach_client_roadmaps[0];assert.equal(args.p_client,ids.client);assert.equal(args.p_expected_revision,row.revision);Object.assign(row,{revision:row.revision+1,payload:args.p_payload});return new Response(JSON.stringify(row),{headers:{'Content-Type':'application/json'}});
  }
  if(url.pathname==='/rest/v1/rpc/coach_operational_status'){
   statusCalls++;return new Response(JSON.stringify({format:'legal-edge-operational-status',coach_id:ids.coach,checked_at:new Date().toISOString(),alerts:{capped:false,enabled_devices:0,pending:1,pending_unattempted:1,failed:0,provider_accepted:0},backup:null,health:{capped:false,keys_with_receipt:0,weekly_reports:15,report_clients:4}}),{headers:{'Content-Type':'application/json'}});
  }
  if(url.hostname==='baxvhilvrhshlfizakak.supabase.co'){
   let response;const headers=Object.fromEntries(new Headers(options.headers||{}));let body;try{body=JSON.parse(options.body||'{}');}catch{body={};}
   await routeApi({request:()=>({url:()=>url.href,method:()=>options.method||'GET',headers:()=>headers,postDataJSON:()=>body}),fulfill:async result=>{response=new Response(result.body,{status:result.status,headers:result.headers});}},store);return response;
  }
  if(url.hostname==='localhost'&&url.pathname==='/playbook/content.json')return new Response(fs.readFileSync(path.join(root,'playbook/content.json')),{headers:{'Content-Type':'application/json'}});
  return new Response(null,{status:204});
 };
}});
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function until(check,label){for(let n=0;n<200;n++){if(check())return;await tick();}throw Error('Actual runtime did not reach '+label+'; status='+dom.window.document.querySelector('#coachReliability')?.textContent+'; calls='+statusCalls+'; '+errors.join('; '));}
(async()=>{
 const w=dom.window,$=selector=>w.document.querySelector(selector);
 await until(()=>w.legalEdgeRuntimeReady&&$('#loginForm')?.onsubmit,'ready login');
 $('#email').value='coach@fixture.invalid';$('#password').value='Synthetic-fixture-password-only';await $('#loginForm').onsubmit({preventDefault(){},submitter:$('#loginForm button[type=submit]')});
 await until(()=>$('#coachHomeFocus')&&$('#coachReliability'),'coach Home status');
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(statusCalls,0);assert(!$('#coachReliability').open);assert($('#coachHomeFocus [data-home-primary] #coachReliability'),'status stays in the primary Home area');
 $('#coachReliability').open=true;await until(()=>$('#coachReliability').textContent.includes('15 weekly reports'),'loaded operational metadata');
 const panel=$('#coachReliability');assert.equal(statusCalls,1);w.CoachHomeFocus.arrange();w.CoachReliability.mount();await tick();assert.equal($('#coachReliability'),panel);assert(panel.open);assert.equal(statusCalls,1);
 assert(panel.textContent.includes('No enabled devices'));assert(panel.textContent.includes('No snapshot recorded'));assert(!panel.textContent.includes('Browser Fixture Client'),'aggregate panel contains no client identity');
 const count=w.document.querySelectorAll('*').length;await new Promise(resolve=>setTimeout(resolve,50));assert.equal(w.document.querySelectorAll('*').length,count,'combined observers settle rather than rewrapping');
 assert.equal(w.document.querySelectorAll('#coachReliability').length,1);assert.deepEqual(errors,[]);
 assert($('[data-cr-hub]'),'goal hub has a direct Home entry');$('[data-cr-hub]').click();await until(()=>$('.cr-client-card [data-cr-client]'),'saved goal hub');assert($('.cr-client-card').textContent.includes('Original direction'));$('.cr-client-card [data-cr-client]').click();await until(()=>$('#coachRoadmap [data-cr-form]'),'direct goal workspace');assert.equal($('[data-client-tab="goals"]').parentElement,$('#clientTabs'),'goals are outside the collapsed details menu');
 await until(()=>$('#coachRoadmap [data-cr-form]'),'full roadmap');await until(()=>$('#cmClientTab option[value="goals"]')?.textContent==='Goals & long-term plan','mobile roadmap label');
 assert(!$('.cr-published').open);assert.equal($('#coachRoadmap .cr-current h3').textContent,'Synthetic private priority');const form=$('[data-cr-form]');form.elements.phase.value='Changed synthetic priority';await form.onsubmit({preventDefault(){}});await until(()=>$('#coachRoadmap .cr-current h3')?.textContent==='Changed synthetic priority','confirmed private save');assert.equal(store.tables.coach_client_roadmaps[0].revision,2);
 w.eval('state.clientTab="overview";renderClientWorkspace()');await until(()=>$('#coachRoadmap .cr-current h3')?.textContent==='Changed synthetic priority','private save/reload');const settled=w.document.querySelectorAll('*').length;await new Promise(r=>setTimeout(r,70));assert.equal(w.document.querySelectorAll('*').length,settled,'roadmap/mobile observers settle');assert.deepEqual(errors,[]);
 w.eval('state.role="client";state.clientView="today";show("#clientApp");renderClient()');await tick();assert(!$('#clientApp #coachRoadmap'));assert(!$('#clientApp').textContent.includes('Changed synthetic priority'));
 console.log('PASS actual runtime/SDK synthetic login, on-demand status, private roadmap save/reload, mobile navigation label, client invisibility and settled combined observers.');
 await w.eval('db.auth.dispose()');w.close();
})().catch(async error=>{console.error(error);try{await dom.window.eval('db.auth.dispose()');}catch{}dom.window.close();process.exitCode=1;});

/* Actual built scripts and pinned SDK; all provider requests stay in the synthetic fixture. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..'),browser=fs.readFileSync(path.join(root,'tests/browser/mobile-coach-flow.cjs'),'utf8');
const fixtureCode=browser.slice(browser.indexOf('const ids='),browser.indexOf('async function checkNoOverflow'));
const {fixture,routeApi,ids}=new Function('crypto','Buffer',fixtureCode+';return {fixture,routeApi,ids};')(crypto,Buffer),store=fixture(),errors=[];
const model=require('../weekly-recap-model.js'),payload=model.build(store.tables.clients[0],{},{});payload.biggest_win='Fixture approved weekly win';payload.focus='Keep the agreed two sessions';
store.tables.client_weekly_recaps=[{client_id:ids.client,coach_id:ids.coach,week_start:payload.period_start,revision:1,payload,body:'Fixture approved weekly recap',published_at:new Date().toISOString()}];
store.tables.coach_weekly_recap_drafts=[{client_id:ids.client,coach_id:ids.coach,week_start:payload.period_start,revision:2,payload:{...payload,focus:'PRIVATE UNPUBLISHED RECAP'},body:'PRIVATE UNPUBLISHED RECAP'}];
class Local extends ResourceLoader{fetch(url){const value=new URL(url);if(value.hostname!=='localhost')return null;const file=path.join(root,value.pathname);return fs.existsSync(file)&&fs.statSync(file).isFile()?Promise.resolve(fs.readFileSync(file)):null;}}
class FixtureSocket{static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;constructor(){this.readyState=0;this.listeners={};queueMicrotask(()=>{this.readyState=1;this.emit('open',{});});}emit(type,event){this['on'+type]?.(event);for(const listener of this.listeners[type]||[])listener(event);}addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}removeEventListener(){}send(raw){try{const data=JSON.parse(raw);if(data.event==='phx_join'||data.event==='heartbeat')queueMicrotask(()=>this.emit('message',{data:JSON.stringify({topic:data.topic,event:'phx_reply',payload:{status:'ok',response:{}},ref:data.ref,join_ref:data.join_ref})}));}catch{}}close(){this.readyState=3;this.emit('close',{code:1000});}}
const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>errors.push(error.message));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost/',resources:new Local(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,beforeParse(w){
 w.Response=Response;w.Headers=Headers;w.Request=Request;w.WebSocket=FixtureSocket;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
 w.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url,'http://localhost/');
  if(url.hostname==='baxvhilvrhshlfizakak.supabase.co'){
   let response;const headers=Object.fromEntries(new Headers(options.headers||{}));let body;try{body=JSON.parse(options.body||'{}');}catch{body={};}
   await routeApi({request:()=>({url:()=>url.href,method:()=>options.method||'GET',headers:()=>headers,postDataJSON:()=>body}),fulfill:async result=>{response=new Response(result.body,{status:result.status,headers:result.headers});}},store);return response;
  }
  if(url.hostname==='localhost'&&url.pathname==='/playbook/content.json')return new Response(fs.readFileSync(path.join(root,'playbook/content.json')),{headers:{'Content-Type':'application/json'}});
  return new Response(null,{status:204});
 };
}});
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function until(check,label){for(let n=0;n<200;n++){if(check())return;await tick();}throw Error('Actual runtime did not reach '+label+'; auth='+dom.window.document.querySelector('#authMsg')?.textContent+'; errors='+errors.join('; '));}
(async()=>{
 const w=dom.window,$=selector=>w.document.querySelector(selector);
 await until(()=>w.legalEdgeRuntimeReady&&$('#loginForm')?.onsubmit,'ready login');
 $('#email').value='client@fixture.invalid';$('#password').value='Synthetic-fixture-password-only';await $('#loginForm').onsubmit({preventDefault(){},submitter:$('#loginForm button[type=submit]')});
 await until(()=>$('#homeQuickLog')&&$('#clientWeeklyRecap')?.textContent.includes('Fixture approved weekly win'),'Home quick logs and approved weekly recap together');
 assert(!$('#personalCoachingHome').textContent.includes('PRIVATE UNPUBLISHED RECAP'));
 assert.equal($('#homeQuickLog').parentElement.id,'personalCoachingHome');assert.equal($('#homeQuickLog').nextElementSibling.id,'clientWeeklyRecap');
 $('[data-home-quick="weight"]').click();await until(()=>$('#progressForm')&&$('[data-home-quick-context]'),'actual native progress form');
 let form=$('#progressForm');form.elements.weight_display.value='79.5';await form.onsubmit({preventDefault(){},target:form,submitter:form.querySelector('button')});
 await until(()=>form.querySelector('[data-progress-save-status]')?.textContent.includes('Not saved'),'injected failure retained');assert.equal(form.elements.weight_display.value,'79.5');assert.equal(store.tables.progress_entries.length,0);
 $('[data-home-quick-back]').click();await until(()=>$('#homeQuickLog'),'return Home after failure');$('[data-home-quick="weight"]').click();await until(()=>$('#progressForm')?.elements.weight_display.value==='79.5','native form restored unsaved draft');
 form=$('#progressForm');await form.onsubmit({preventDefault(){},target:form,submitter:form.querySelector('button')});await until(()=>$('[data-home-quick-status]')?.textContent.includes('Progress saved.'),'actual confirmed native progress save');
 assert.equal(store.tables.progress_entries.length,1);assert.equal(store.tables.progress_entries[0].weight_kg,79.5);assert.equal(store.calls.filter(call=>call.rpc==='save_progress_entry').length,2,'One failed and one confirmed request; no duplicate write path');
 $('[data-home-quick-back]').click();await until(()=>$('#homeQuickLog')&&$('#clientWeeklyRecap'),'Home after native save');assert($('#clientWeeklyRecap').textContent.includes('Keep the agreed two sessions'));assert.equal(w.eval('state.data.progress[0].weight_kg'),79.5);assert(!$('#personalCoachingHome').textContent.includes('PRIVATE UNPUBLISHED RECAP'));assert.deepEqual(errors,[]);
 console.log('PASS actual runtime/SDK Home quick weight failure-retention-reopen-retry, one confirmed native write, approved weekly recap coexistence and private recap exclusion.');
 await w.eval('db.auth.dispose()');w.close();
})().catch(async error=>{console.error(error);try{await dom.window.eval('db.auth.dispose()');}catch{}dom.window.close();process.exitCode=1;});

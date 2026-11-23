/* Actual built scripts and pinned SDK; all provider requests stay in the synthetic fixture. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..'),browser=fs.readFileSync(path.join(root,'tests/browser/mobile-coach-flow.cjs'),'utf8');
const fixtureCode=browser.slice(browser.indexOf('const ids='),browser.indexOf('async function checkNoOverflow'));
const {fixture,routeApi,ids}=new Function('crypto','Buffer',fixtureCode+';return {fixture,routeApi,ids};')(crypto,Buffer),store=fixture(),errors=[];
const model=require('../weekly-recap-model.js'),payload=model.build(store.tables.clients[0],{},{});payload.biggest_win='Fixture approved weekly win';payload.focus='Keep the agreed two sessions';
store.tables.client_coaching_guidance=[{id:'today-feedback',client_id:ids.client,published:true,title:'Video check-in · Training feedback',
 body:'https://www.loom.com/share/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nRecorded: 2026-11-20',created_at:'2026-11-20T12:00:00Z'}];
store.tables.client_weekly_recaps=[{client_id:ids.client,coach_id:ids.coach,week_start:payload.period_start,revision:1,payload,body:'Fixture approved weekly recap',published_at:new Date().toISOString()}];
store.tables.checkins=[{id:'synthetic-recovery-checkin',client_id:ids.client,period_start:payload.period_start,submitted_at:new Date().toISOString(),sleep:8,stress:4,energy:7,sleep_hours:7,source_system:'client_weekly_v3'}];
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
  if(url.hostname==='www.loom.com'&&url.pathname==='/v1/oembed')return new Response(JSON.stringify({thumbnail_url:'https://cdn.loom.com/test-preview.jpg'}),{headers:{'Content-Type':'application/json'}});
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
 await until(()=>$('#personalCoachingHome'),'simplified Today');
 await until(()=>$('[data-pch-video] [data-pch-watch]'),'published Loom feedback on Today');
 assert.match($('[data-pch-video]').textContent,/Training feedback/);
 const thumbnail=$('.pch-video-preview img');await until(()=>thumbnail.src.includes('test-preview.jpg'),'Loom thumbnail');
 thumbnail.dispatchEvent(new w.Event('load'));assert(!thumbnail.hidden);
 assert(!$('#personalCoachingHome iframe'),'The player loads only when requested');
 $('[data-pch-watch]').click();
 assert.equal($('.cv-dialog iframe')?.getAttribute('src'),'https://www.loom.com/embed/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
 $('[data-cv-close]').click();
 assert(!$('#homeQuickLog')&&!$('#clientWeeklyRecap')&&!$('.priority-grid')&&!$('#personalCoachingHome nav'));
 ($('[data-pch-route="support"]')||$('[data-client-view="support"]')).click();await until(()=>$('#clientWeeklyRecap')?.textContent.includes('Fixture approved weekly win'),'approved recap in Coach');
 assert(!$('#clientWeeklyRecap').textContent.includes('PRIVATE UNPUBLISHED RECAP'));
 $('[data-client-view="today"]').click();await until(()=>$('#personalCoachingHome'),'return to Today');
 assert(!$('#clientWeeklyRecap'),'Recap stays in Coach');
 const card=$('#personalCoachingHome [data-weighin-routine="today"]'),form=$('#todayProgressForm');
 assert.match(card.textContent,/0 \/ 3 minimum/);
 assert(form.hidden);
 card.querySelector('[data-weighin-log]').click();
 assert(!form.hidden);
 assert.equal(w.document.activeElement,form.elements.weight_display);
 assert.match(form.textContent,/Weight \(kg\).*Waist \(cm\)/s);
 form.elements.weight_display.value='79.5';
 form.elements.waist_cm.value='83';
 const submit=()=>form.onsubmit({preventDefault(){},target:form,submitter:form.querySelector('button[type=submit]')});
 await submit();await until(()=>form.querySelector('[data-progress-save-status]')?.textContent.includes('Not saved'),'injected failure retained on Today');
 assert.equal(form.elements.weight_display.value,'79.5');assert.equal(form.elements.waist_cm.value,'83');assert.equal(store.tables.progress_entries.length,0);
 assert.match(card.textContent,/0 \/ 3 minimum/);
 await submit();await until(()=>store.tables.progress_entries[0]?.weight_kg===79.5,'native progress save from Today');
 assert.match(card.textContent,/1 \/ 3 minimum/);
 assert.match(form.querySelector('[data-progress-save-status]').textContent,/Progress saved/);
 assert.equal(store.tables.progress_entries[0].waist_cm,83);
 assert.equal(form.elements.weight_display.value,'');
 form.elements.weight_display.value='79.8';await submit();
 assert.equal(store.tables.progress_entries.length,1,'Same-day edits still count once');
 assert.equal(store.tables.progress_entries[0].waist_cm,83,'Blank waist leaves its last saved value intact');
 assert.match(card.textContent,/1 \/ 3 minimum/);
 assert.equal(store.calls.filter(call=>call.rpc==='save_progress_entry').length,3);
 $('[data-client-view="progress"]').click();await until(()=>$('#progressForm'),'actual native progress form');
 assert.match($('[data-weighin-routine="client"]').textContent,/1 \/ 3 minimum/);
 assert($('#recoveryTrends .rt-card svg'),'A genuine saved fixture reading is plotted');
 assert(!$('#clientApp').textContent.includes('Synthetic coach review decision'));
 $('[data-client-view="today"]').click();await until(()=>$('#personalCoachingHome'),'return to simplified Today after save');
 assert(!$('#homeQuickLog')&&!$('#clientWeeklyRecap'));
 assert.match($('[data-weighin-routine="today"]').textContent,/1 \/ 3 minimum/);
 assert.deepEqual(errors,[]);
 console.log('PASS actual runtime sign-in, simple Today, coaching recap in Coach, and confirmed inline weigh-ins shared with Progress.');
 await w.eval('db.auth.dispose()');w.close();
})().catch(async error=>{console.error(error);try{await dom.window.eval('db.auth.dispose()');}catch{}dom.window.close();process.exitCode=1;});

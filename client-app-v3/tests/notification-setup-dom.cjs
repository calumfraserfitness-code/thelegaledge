const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setImmediate(r)),deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}};
function setup(){
 const dom=new JSDOM('<nav id="coachNav"></nav><main id="coachMain"></main>',{url:'https://example.invalid/',runScripts:'outside-only'}),w=dom.window;
 let saved=false,sub={endpoint:'https://example.invalid/synthetic-device',toJSON(){return {endpoint:this.endpoint}}},subscribeWait=null,exportWait=null,downloads=0,confirm=true;
 const calls=[],timers=[];
 const reg={pushManager:{getSubscription:async()=>sub,subscribe:async()=>subscribeWait?subscribeWait.promise:sub}};
 Object.defineProperty(w.navigator,'serviceWorker',{value:{register:async()=>reg,ready:Promise.resolve(reg),getRegistration:async()=>reg},configurable:true});
 Object.assign(w,{state:{user:{id:'coach-a'},role:'coach',preview:false,data:{checkins:[]}},SUPABASE_URL:'https://example.invalid',SUPABASE_KEY:'synthetic-public',renderCoach(){},renderClient(){},toast(){},matchMedia:()=>({matches:true}),PushManager:function(){},Notification:{permission:'granted',requestPermission:async()=> 'granted'},query:async(_,q)=>{const r=await q;if(r.error)throw Error(r.error.message);return r.data;}});
 w.db={auth:{getSession:async()=>({data:{session:{user:{id:w.state.user.id},access_token:'synthetic'}}})},from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:saved?{id:'saved-device'}:null})};return q},rpc:async()=>exportWait?exportWait.promise:{data:null}};
 w.fetch=async(_,options)=>{const body=JSON.parse(options.body);calls.push(body.action);return {ok:true,json:async()=>body.action==='config'?{publicKey:'AQID'}:{saved:confirm,accepted:true}}};
 w.URL.createObjectURL=()=>{downloads++;return 'blob:synthetic'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
 const realTimer=w.setTimeout.bind(w);w.setTimeout=(fn,ms)=>{timers.push({fn,ms});return realTimer(fn,ms)};
 vm.runInContext(fs.readFileSync(__dirname+'/../checkin-system.js','utf8'),dom.getInternalVMContext());
 return {dom,w,calls,timers,reg,setSaved:v=>saved=v,setSub:v=>sub=v,setSubscribe:v=>subscribeWait=v,setConfirm:v=>confirm=v,setExport:v=>exportWait=v,downloads:()=>downloads,async open(){w.renderCoach();await tick();await w.document.querySelector('#csPhoneAlerts').onclick()},async backup(){w.renderCoach();await tick();await w.document.querySelector('#csBackups').onclick()}};
}
(async()=>{
 let h=setup();await h.open();let d=h.w.document;
 assert(d.querySelector('#csPushStatus').textContent.includes('not enabled for this account'));assert(d.querySelector('#csTest').disabled,'Local subscription alone does not enable a delivery test');
 h.setConfirm(false);await d.querySelector('#csEnable').onclick({target:d.querySelector('#csEnable')});assert(d.querySelector('#csPushStatus').textContent.includes('not confirmed'));assert(!d.querySelector('#csEnable').disabled);
 h.setConfirm(true);await d.querySelector('#csEnable').onclick({target:d.querySelector('#csEnable')});assert(!d.querySelector('#csTest').disabled);assert.equal(h.w.localStorage.getItem('lec-push-account'),'coach-a');h.dom.window.close();
 h=setup();h.w.navigator.serviceWorker.ready=new Promise(()=>{});h.w.renderCoach();await tick();const opening=h.w.document.querySelector('#csPhoneAlerts').onclick();await tick();h.timers.filter(t=>t.ms===12000).at(-1).fn();await opening;
 assert(h.w.document.querySelector('#csPushStatus').textContent.includes('timed out'));assert([...h.w.document.querySelectorAll('button')].some(b=>b.textContent==='Retry device check'&&!b.hidden));h.dom.window.close();
 h=setup();h.setSub(null);const pending=deferred();h.setSubscribe(pending);await h.open();d=h.w.document;const enabling=d.querySelector('#csEnable').onclick({target:d.querySelector('#csEnable')});await tick();h.w.state.user={id:'coach-b'};pending.resolve({toJSON:()=>({endpoint:'synthetic'})});await enabling;
 assert.deepEqual(h.calls,['config'],'An account switch during browser registration must not register against the next session');assert.equal(h.w.localStorage.getItem('lec-push-account'),null);h.dom.window.close();
 h=setup();h.setSaved(true);await h.open();assert(!h.w.document.querySelector('#csTest').disabled);h.dom.window.close();
 h=setup();await h.open();d=h.w.document;h.w.localStorage.setItem('lec-push-account','coach-a');
 let device=await h.reg.pushManager.getSubscription();device.unsubscribe=async()=>false;
 await d.querySelector('#csDisable').onclick();
 assert(d.querySelector('#csPushStatus').textContent.includes('could not be disconnected'),'A browser refusing unsubscribe must not claim alerts are off');
 assert.equal(h.w.localStorage.getItem('lec-push-account'),'coach-a');assert(!h.calls.includes('unsubscribe'));h.dom.window.close();
 h=setup();await h.open();d=h.w.document;device=await h.reg.pushManager.getSubscription();device.unsubscribe=()=>new Promise(()=>{});
 const disabling=d.querySelector('#csDisable').onclick();await tick();
 const stopTimer=h.timers.filter(t=>t.ms===12000).at(-1);assert(stopTimer,'Push cleanup must have a finite wait');stopTimer.fn();await disabling;
 assert(d.querySelector('#csPushStatus').textContent.includes('timed out'));assert(!d.querySelector('#csDisable').disabled);h.dom.window.close();
 h=setup();await h.backup();d=h.w.document;await d.querySelector('#csExport').onclick({target:d.querySelector('#csExport')});assert.equal(h.downloads(),0);assert(d.querySelector('#csBackupStatus').textContent.includes('not confirmed'));
 const old=deferred();h.setExport(old);const exporting=d.querySelector('#csExport').onclick({target:d.querySelector('#csExport')});await tick();h.w.state.user={id:'coach-b'};old.resolve({data:{format:'legal-edge-coaching-backup',coach_id:'coach-a',tables:{checkins:[]}}});await exporting;assert.equal(h.downloads(),0,'Do not download an old account backup into a changed account');h.dom.window.close();
 console.log('PASS: server-confirmed device registration, retry after stalled service worker, registration account-switch guard, missing-save rejection and account-scoped backup export.');
})().catch(e=>{console.error(e);process.exitCode=1});

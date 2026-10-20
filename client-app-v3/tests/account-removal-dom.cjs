const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="clientWorkspaceBody"></div>',{runScripts:'outside-only'}),w=dom.window;let calls=[],fail=false;
w.$=s=>w.document.querySelector(s);w.esc=s=>String(s).replace(/[&<>"']/g,'');w.toast=()=>{};
w.state={role:'coach',user:{id:'coach'},preview:false,client:{id:'client',display_name:'Johnny Example',profile_id:'profile',deleted_at:null}};
w.coachOverview=()=>w.$('#clientWorkspaceBody').innerHTML='<section class="panel"><div class="panel-head"><div><p>Client</p></div><button id="psClientStatus">Move to past</button></div></section><section class="panel"><form id="linkSavedClient"></form></section>';
w.launchApplyClient=(id,row)=>w.state.client=row;
w.db={rpc:async(name,args)=>{calls.push({name,args});if(fail)return {error:{message:'Save rejected'}};return {data:{...w.state.client,deleted_at:args.p_action==='remove'?'2026-10-12':null}};}};
vm.runInContext(fs.readFileSync(path.join(__dirname,'../account-removal.js'),'utf8'),dom.getInternalVMContext());
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{
w.coachOverview();w.$('#removeClientAccount').click();const form=w.$('[role=dialog] form'),input=form.elements.confirmation,submit=form.querySelector('[type=submit]');assert(submit.disabled);assert(w.$('[role=dialog]').textContent.includes('does not permanently erase'));
input.value='Johnny';input.dispatchEvent(new w.Event('input'));assert(submit.disabled);form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(calls.length,0);
input.value='Johnny Example';input.dispatchEvent(new w.Event('input'));fail=true;form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert(w.$('[role=status]').textContent.includes('rejected'));assert.equal(w.state.client.deleted_at,null);assert.equal(input.value,'Johnny Example');
fail=false;form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(calls.length,2);assert(w.state.client.deleted_at);assert(!w.$('#psClientStatus'));assert(!w.$('#linkSavedClient'),'Removed accounts cannot create a replacement login');assert.equal(w.$('#removeClientAccount').textContent,'Restore removed account');
w.$('#removeClientAccount').click();const restore=w.$('[role=dialog] form');restore.elements.confirmation.value='Johnny Example';restore.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(w.state.client.deleted_at,null);assert.equal(calls.at(-1).args.p_action,'restore');
w.$('#removeClientAccount').click();const stale=w.$('[role=dialog] form');stale.elements.confirmation.value='Johnny Example';w.state.client={id:'other'};stale.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(calls.length,3);assert(w.$('[role=status]').textContent.includes('changed'));
console.log('PASS: typed account confirmation, retained form on rejection, duplicate-submit guard, recoverable restore and stale account protection.');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

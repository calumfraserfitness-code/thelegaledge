const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 const dom=new JSDOM('<nav id="coachNav"></nav><div id="coachMain"><nav id="clientTabs"></nav><main id="clientWorkspaceBody"></main></div>',{url:'https://example.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let interval,mounts=0,wait=null;const state={role:'coach',preview:false,user:{id:'coach'},profile:{id:'coach'},client:{id:'client',profile_id:'client-user'},clientTab:'connections',coachView:'clients'};
 Object.assign(w,{state,$:s=>w.document.querySelector(s),esc:v=>String(v??''),phoneFlowDispose:undefined,hubPhoneFirst(){},CoachHealthReports:{mount(){mounts++;}},renderCoach(){},renderClientWorkspace(){},importHealthFile(){},toast(){},setInterval:fn=>(interval=fn,1),clearInterval(){},query:async()=>{if(wait)await wait;return [];},db:{from(){const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q};return q;}}});
 vm.runInContext(fs.readFileSync(__dirname+'/../connections-hub.js','utf8'),dom.getInternalVMContext());
 return {w,dom,state,host:w.$('#clientWorkspaceBody'),mounts:()=>mounts,poll:()=>interval(),setWait:v=>wait=v};
}
(async()=>{
 let h=setup();await h.w.renderConnectionsHub(h.host);assert.equal(h.mounts(),1,'Report panel mounts after the connection screen paints');await h.poll();assert.equal(h.mounts(),2,'Connection auto-refresh remounts the report panel');h.state.clientTab='training';h.host.innerHTML='<form id="trainingDraft"><textarea>My saved draft</textarea></form>';const form=h.host.firstElementChild;await h.poll();assert.equal(h.host.firstElementChild,form,'Old connection timer cannot repaint another client tab');h.dom.window.close();
 for(const change of [h=>h.state.user={id:'different-account'},h=>h.state.client={id:'different-client'},h=>h.state.role='client']){h=setup();let release;h.setWait(new Promise(resolve=>release=resolve));const loading=h.w.renderConnectionsHub(h.host);await tick();change(h);h.host.innerHTML='<p id="currentScreen">New workspace</p>';release();await loading;assert(h.host.querySelector('#currentScreen'),'A late connections read cannot paint a different owner/role/client');assert.equal(h.mounts(),0);h.dom.window.close();}
 console.log('PASS connections repaint retains report panel, stops on tab change and rejects stale owner/client/role reads.');
})().catch(error=>{console.error(error);process.exitCode=1;});

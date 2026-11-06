const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<nav id="clientNav"></nav><nav id="coachNav"><button data-coach-view="resources">Resources</button></nav><main id="clientMain"></main><main id="coachMain"></main>',{runScripts:'outside-only'}),w=dom.window;
let clientCalls=0,coachCalls=0;const originalData={plans:[{id:'approved'}],logs:[{load:70,reps:8}]};
Object.assign(w,{$:s=>w.document.querySelector(s),state:{clientView:'playbook',coachView:'playbook-manager',client:null,data:originalData},updateClientNav(){w.$('#clientNav').innerHTML='<button data-client-view="today">Today</button><button data-client-view="playbook">Playbook</button><button data-client-view="learning">Learn</button>';},renderClient(){clientCalls++;w.updateClientNav();return Promise.resolve().then(()=>w.$('#clientMain').innerHTML='<section id="pbPlanReady">Explore Playbook</section><p>My plan</p>');},renderCoach(){coachCalls++;return Promise.resolve().then(()=>w.$('#coachMain').innerHTML='<section id="pbCoachTools">Playbook support</section>');},coachingSettings(){w.$('#coachMain').innerHTML='<button data-clean-setting="playbook-manager">Videos</button><button data-clean-setting="coaching-updates">Call recordings</button>';},async renderEmployerPortal(){w.$('#coachMain').innerHTML='<section id="pbEmployerReport">Playbook</section>';}});
vm.runInContext(fs.readFileSync(__dirname+'/../transition-ui.js','utf8'),dom.getInternalVMContext());
(async()=>{
 await w.renderClient();await Promise.resolve();assert.equal(w.state.clientView,'today');assert.equal(clientCalls,1);assert(!w.$('[data-client-view=playbook]'));assert(!w.$('[data-client-view=learning]'));assert(w.$('[data-client-view=today]'));assert(!w.$('#pbPlanReady'));
 w.state.clientView='learning';await w.renderClient();assert.equal(w.state.clientView,'today');
 await w.renderCoach();assert.equal(w.state.coachView,'settings');assert.equal(coachCalls,1);assert(!w.$('#pbCoachTools'));assert(!w.$('#coachNav [data-coach-view=resources]'));
 w.coachingSettings();assert(!w.$('[data-clean-setting=playbook-manager]'));assert(w.$('[data-clean-setting=coaching-updates]'));
 await w.renderEmployerPortal();assert(!w.$('#pbEmployerReport'));
 w.state.clientView='playbook';await w.LegalEdgePlaybook.open();assert.equal(w.state.clientView,'today');assert.strictEqual(w.state.data,originalData,'No saved plans, choices or logs are changed');
 console.log('PASS: paused Playbook routes, navigation, late cards, coach settings and employer reports; plans/logs untouched.');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

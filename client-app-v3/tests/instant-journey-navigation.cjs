const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="clientMain"><p id="initial">Existing view</p></main><nav id="clientNav"></nav><div class="account-menu"></div>',{runScripts:'outside-only'}),w=dom.window;
const source=fs.readFileSync(__dirname+'/../onboarding-journey.js','utf8');let pending=[],queries=0,now=1000,renders=[];
const state={role:'client',preview:false,user:{id:'user-a'},client:{id:'a',onboarding_status:'complete',plan_status:'published',portal_enabled:true},clientView:'today'};
const chain=()=>{const q={select:()=>q,eq:()=>q,single:()=>q};return q;};
Object.assign(w,{state,$:s=>w.document.querySelector(s),query:()=>{queries++;return new Promise((resolve,reject)=>pending.push({resolve,reject}));},db:{from:chain},toast(){},renderClient(){renders.push(state.clientView);w.$('#clientMain').innerHTML='<section data-route="'+state.clientView+'">'+state.clientView+'</section>';return state.clientView;},renderJourney(j){w.$('#clientMain').innerHTML='<section id="gated">'+j.stage+'</section>';},URLSearchParams,Date:class extends Date{static now(){return now;}}});
const ctx=dom.getInternalVMContext();
vm.runInContext(source.slice(0,source.indexOf('async function journeyCall(')),ctx);
vm.runInContext(source.slice(source.indexOf('const beforeJourneyClient=renderClient;'),source.indexOf('\nasync function renderJourneyCoach()')),ctx);
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 let first=w.renderClient();assert.equal(queries,1,'First sign-in verifies authoritative journey');assert(w.$('#initial'),'Existing content is retained while initial check runs');
 state.clientView='training';let second=w.renderClient();assert.equal(queries,1,'Rapid tab clicks share one in-flight verification');pending.shift().resolve([{client_id:'a',stage:'ready'}]);await Promise.all([first,second]);assert.deepEqual(renders,['training'],'Only latest requested tab renders after initial verification');
 state.clientView='progress';const cached=w.renderClient();assert.equal(cached,'progress','Verified published client tabs render synchronously');assert.equal(queries,1);assert.equal(w.$('[data-route]').dataset.route,'progress');
 now+=61000;state.clientView='nutrition';w.renderClient();assert.equal(w.$('[data-route]').dataset.route,'nutrition','Expired snapshot refresh does not block visible tab');assert.equal(queries,2);
 state.clientView='checkin';w.renderClient();assert.equal(w.$('[data-route]').dataset.route,'checkin');assert.equal(queries,2,'Background verification deduplicates across tabs');pending.shift().resolve([{client_id:'a',stage:'ready'}]);await tick();assert.equal(w.$('[data-route]').dataset.route,'checkin');assert.equal(renders.filter(x=>x==='checkin').length,1,'Unchanged background gate never reconstructs forms');
 now+=61000;state.clientView='today';w.renderClient();pending.shift().reject(Error('offline'));await tick();assert.equal(w.$('[data-route]').dataset.route,'today','Refresh failure retains previously verified workspace');
 state.client={id:'b',onboarding_status:'complete',plan_status:'published',portal_enabled:true};state.clientView='today';first=w.renderClient();assert.equal(queries,4,'Client switch cannot reuse another snapshot');pending.shift().resolve([{client_id:'b',stage:'contract'}]);await first;assert(w.$('#gated').textContent.includes('contract'),'Fresh authoritative gate wins even if client profile says complete');
 state.client={id:'a',onboarding_status:'complete',plan_status:'published',portal_enabled:true};state.user={id:'different-user'};first=w.renderClient();assert.equal(queries,5,'Account switch cannot reuse another account snapshot');state.clientView='progress';second=w.renderClient();pending.shift().resolve([]);await Promise.all([first,second]);assert.equal(w.$('[data-route]').dataset.route,'progress','Existing legacy clients without enrollment retain their valid flow');
 // Invalidation after journey actions makes the next access authoritative again.
 vm.runInContext('invalidateJourneySnapshot()',ctx);first=w.renderClient();assert.equal(queries,6);pending.shift().resolve([{client_id:'a',stage:'intake'}]);await first;assert(w.$('#gated').textContent.includes('intake'));
 dom.window.close();console.log('PASS instant verified client tabs: first authoritative gate, owner-scoped cache, in-flight dedup, background refresh, retained screen and stale-route/account protection');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

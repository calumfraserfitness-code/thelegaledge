const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="coachMain"></main>',{runScripts:'outside-only'}),w=dom.window;let resolve,fail=false;
Object.assign(w,{$:s=>w.document.querySelector(s),esc:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),state:{role:'coach',coachView:'clients',client:null,user:{id:'coach'},clients:[{id:'c',display_name:'Client <X>',status:'active',portal_enabled:true}]},renderCoach(){w.$('#coachMain').innerHTML='';},db:{rpc:name=>name},bindClientRows(){},query:()=>fail?Promise.reject(Error('offline')):new Promise(r=>resolve=r)});
vm.runInContext(fs.readFileSync(__dirname+'/../coach-activity.js','utf8'),dom.getInternalVMContext());
(async()=>{
 w.renderCoach();assert(w.$('#coachActivity'));resolve([{client_id:'c',last_sign_in_at:'2026-10-27T09:31:00Z',sets_7d:40,checkins_7d:0,food_7d:0}]);await new Promise(r=>setImmediate(r));assert(w.$('#coachActivity').textContent.includes('40 sets'));assert(w.$('#coachActivity').textContent.includes('No record'));assert(!w.$('X'));assert(w.$('[data-client-id="c"]'));
 w.renderCoach();const late=resolve;w.state.user.id='different';late([{client_id:'c',sets_7d:999}]);await new Promise(r=>setImmediate(r));assert(!w.$('#coachActivity').textContent.includes('999'));
 w.state.user.id='coach';fail=true;w.renderCoach();await new Promise(r=>setImmediate(r));assert(w.$('#coachActivity').textContent.includes('could not load'));assert(!w.$('#coachActivity button').disabled);
 w.state.role='client';w.renderCoach();assert(!w.$('#coachActivity'));dom.window.close();console.log('PASS coach activity metadata, unknowns, escaped names, stale account denial and retry');
})().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});

const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="clientWorkspaceBody"></main>',{runScripts:'outside-only'}),w=dom.window;
const client={id:'a',coach_id:'u',goal_summary:'Maintain weight'},state={user:{id:'u'},role:'coach',client,clientTab:'check-ins',data:{checkins:[{client_id:'a',submitted_at:'2026-11-01',wins:'REAL WIN'},{client_id:'b',wins:'PEER SECRET'}],weeks:[],exerciseLogs:[],coachingGuidance:[]}};
let fail=false,release,copy=0;
Object.assign(w,{state,$:s=>w.document.querySelector(s),renderClientWorkspace(){},renderCoach(){},loadClientData:async()=>{if(fail)throw Error('offline');return true;},query:()=>new Promise(r=>release=r),db:{from:()=>{const chain=new Proxy({},{get:(o,k)=>()=>chain});return chain;}}});
Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async()=>copy++}});
vm.runInContext(fs.readFileSync(__dirname+'/../coach-review-brief.js','utf8'),dom.getInternalVMContext());
(async()=>{
 const build=w.CoachReviewBrief.build;
 const text=build(client,state.data,[{client_id:'b',coach_id:'u',matching_status:'matched',analysis:'PRIVATE CALL'}],new Date('2026-11-02'));
 assert(text.includes('REAL WIN'));assert(!text.includes('PEER SECRET'));assert(!text.includes('PRIVATE CALL'));assert(text.includes('not evidence of no activity'));
 w.renderClientWorkspace();assert(w.$('#coachReviewBrief'));assert.equal(copy,0);
 let task=w.$('[data-brief-prepare]').onclick();await new Promise(r=>setImmediate(r));release([]);await task;assert(!w.$('[data-brief-output]').hidden);assert(w.$('textarea').value.includes('REAL WIN'));assert.equal(copy,0);await w.$('[data-brief-copy]').onclick();assert.equal(copy,1);
 fail=true;await w.$('[data-brief-prepare]').onclick();assert(w.$('[data-brief-output]').hidden);assert.equal(w.$('textarea').value,'');assert(w.$('[role=status]').textContent.includes('unavailable'));assert(!w.$('[data-brief-prepare]').disabled);
 fail=false;task=w.$('[data-brief-prepare]').onclick();await new Promise(r=>setImmediate(r));state.user.id='other';release([]);await task;assert(w.$('[data-brief-output]').hidden,'stale account cannot publish context');
 w.$('#clientWorkspaceBody').innerHTML='';state.role='client';w.renderClientWorkspace();assert(!w.$('#coachReviewBrief'));
 dom.window.close();console.log('PASS coach brief provenance, peer isolation, explicit copy, failed reads/retry, stale-account guard and client denial');
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close();});

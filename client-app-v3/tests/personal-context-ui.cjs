const assert=require('assert'),fs=require('fs'),vm=require('vm'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="clientWorkspaceBody"><button id="copyTrainingPrompt">Copy</button><input id="editor" value="Unsaved training edit"></main>',{runScripts:'outside-only'}),w=dom.window;
let queries=0,copied='',deferred=null;
const chain=table=>new Proxy({table},{get:(target,key)=>key==='table'?table:key==='then'?undefined:()=>chain(table)});
Object.assign(w,{$:s=>w.document.querySelector(s),esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),toast(){},db:{from:chain},state:{role:'coach',user:{id:'coach'},client:{id:'a',display_name:'Client Name',goal_summary:'Build strength'},clientTab:'training',preview:false,data:{onboarding:[{client_id:'peer',version:99,responses:{sections:{training:{equipment:'PEER EQUIPMENT'}}}},{client_id:'a',version:1,responses:{sections:{training:{equipment:'Dumbbells',preferred_training_time:'Mornings'},lifestyle:{work_hours:'Busy Thursdays'}}}}]}},renderClientWorkspace(){},coachOverview(){},coachTraining(){},coachNutrition(){},trainingPrompt:()=>`Build programme for Client Name. Use only the onboarding below.\n{"days":[]}\n\nONBOARDING:\nRAW PRIVATE EMAIL AND IDENTITY`,query:async(label,q)=>{
 queries++;if(deferred)return new Promise(resolve=>deferred.push(resolve));
 return q.table==='client_food_preferences'?[{client_id:'a',notes:'No shellfish'}]:q.table==='client_weekly_focus'?[{client_id:'a',description:'Keep sessions short',starts_on:'2000-01-01',expires_on:'2099-01-01',approved_at:'2000-01-01'}]:[];
}});
w.navigator.clipboard={writeText:async text=>{copied=text;}};
for(const file of ['personal-context-model.js','personal-context-ui.js'])vm.runInContext(fs.readFileSync(__dirname+'/../'+file,'utf8'),dom.getInternalVMContext());
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{
 w.PersonalCoachingContextUI.mount();assert.equal(queries,0,'Closed panel does not add loading requests');
 const panel=w.$('#personalCoachingContext');assert(!panel.open);assert(panel.textContent.includes('Dumbbells'));
 panel.open=true;await tick();await tick();assert.equal(queries,4);assert(panel.textContent.includes('No shellfish'));assert(panel.textContent.includes('Keep sessions short'));
 assert.equal(w.$('#editor').value,'Unsaved training edit','Loading context never overwrites a training input');
 w.$('#copyTrainingPrompt').click();await tick();await tick();assert.equal(queries,4,'Fresh scoped context is reused briefly');assert(copied.includes('Dumbbells'));assert(copied.includes('Busy Thursdays'));assert(copied.includes('Keep sessions short'));assert(copied.includes('"days":[]'),'Training schema retained');
 for(const bad of ['Client Name','RAW PRIVATE','PEER EQUIPMENT'])assert(!copied.includes(bad),bad);
 const stale=w.$('#copyTrainingPrompt');w.state.user.id='different';stale.click();await tick();assert.equal(queries,4,'Stale owner handler cannot read another account');
 w.state.user.id='coach';w.state.client={id:'b',display_name:'Other Client'};w.state.data={onboarding:[]};w.PersonalCoachingContextUI.mount();assert(!w.PersonalCoachingContextUI.context().food.requirements.length,'Previous client preferences never carry over');
 w.$('#personalCoachingContext').remove();w.PersonalCoachingContextUI.mount();deferred=[];w.$('#personalCoachingContext').open=true;await tick();assert.equal(deferred.length,4);w.state.client={id:'a'};for(const resolve of deferred)resolve([{client_id:'b',notes:'LATE CLIENT B NOTE'}]);await tick();assert(!JSON.stringify(w.PersonalCoachingContextUI.context()).includes('LATE CLIENT B'));
 w.state.role='client';w.$('#personalCoachingContext').remove();w.PersonalCoachingContextUI.mount();assert(!w.$('#personalCoachingContext'),'Coach-only context stays out of client views');
 console.log('PASS personal context UI: on-demand scoped reads, bounded prompt pipeline, no identity/raw intake, retained edits, short cache and account-race guards');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

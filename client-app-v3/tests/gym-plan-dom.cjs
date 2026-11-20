const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="clientMain"></main>',{runScripts:'outside-only'}),w=dom.window;
const doc=w.document,host=doc.querySelector('main');
const week={id:'w',published:true},day=(id,gym)=>({id,title:gym+' '+id,exercises:[{name:'Leg press',sets:2,reps:'8–12'}]});
const sessions=['A','B'].map((id,i)=>({id,sort_order:i,week_id:'w',status:'planned',programme_day_id:'p'+id,source_metadata:{gym_days:{planet:'p'+id,edge:'e'+id}}}));
const state={user:{id:'owner'},role:'client',trainingCategory:'weights',client:{id:'c'},data:{sessions,programs:[{client_id:'c',status:'active',days:['A','B'].flatMap(id=>[day('p'+id,'Planet'),day('e'+id,'Edge')])}]}};
let call,rendered=0;
Object.assign(w,{$:s=>doc.querySelector(s),state,clientTraining(){},coachNutrition(){},currentWeek:()=>week,esc:String,programDayExercises:d=>d.exercises,db:{rpc:(name,args)=>{call={name,args};return sessions.map(s=>({...s,programme_day_id:s.source_metadata.gym_days.edge}));}},query:async(_,p)=>p,toast(){},renderClient(){rendered++;}});
vm.runInContext(fs.readFileSync(__dirname+'/../gym-plan.js','utf8'),dom.getInternalVMContext());
(async()=>{
 w.clientTraining();assert.equal(host.querySelectorAll('.gym-workout').length,2);assert.equal(host.querySelector('.gym-picker').open,false);assert(!host.querySelector('[data-open-session]'),'Gym comparisons do not duplicate the workout entry points');
 host.querySelector('[data-gym-tab=edge]').click();assert(host.textContent.includes('Edge eA')&&host.textContent.includes('Edge eB'));
 await host.querySelector('[data-gym-select=""]').onclick();
 assert.deepEqual(JSON.parse(JSON.stringify(call.args)),{p_week:'w',p_gym:'edge',p_session:null});
 assert(state.data.sessions.every(s=>s.programme_day_id.startsWith('e')));assert.equal(rendered,1);
 state.role='coach';host.innerHTML=w.GymPlans.markup(week,state.data.sessions);w.GymPlans.bind(host,week,state.data.sessions);
 assert(!host.querySelector('[data-gym-select]'));dom.window.close();
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1;});

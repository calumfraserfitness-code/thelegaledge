const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx=vm.createContext({FormData,Date,Intl,console,state:{preview:false,clients:[],data:{sessions:[]}},coachOverview(){},saveClientControls(){},saveWeekDetails(){},savePlannerSession(){},linkSavedClientAccount(){},deletePlannerSession(){},coachPlanner(){},setBusy(){},toast(message){ctx.messages.push(message)},messages:[],query:async(label,request)=>request,db:{from(){return{update(patch){ctx.lastPatch=patch;return{eq(key,id){ctx.lastId=id;return{select(){return ctx.result}}}}}}}}});
vm.runInContext(fs.readFileSync(__dirname+'/../launch-ready.js','utf8'),ctx);
async function main(){
 const client={id:'first',status:'active',weight_unit:'kg',plan_status:'published'},other={id:'second',status:'active'};ctx.state.client=client;ctx.state.clients=[client,other];
 const fd=new FormData();for(const[k,v]of Object.entries({status:'ending',checkin_day:'5',daily_steps_goal:'9000',goal_weight_display:'75',plan_published:'on',weekly_checkin_enabled:'on'}))fd.set(k,v);
 // Browser FormData accepts a form; use a minimal constructor returning our actual entries.
 ctx.FormData=function(){return fd};const event={preventDefault(){},target:{},submitter:{}};
 ctx.result=Promise.reject(Error('network unavailable'));await ctx.saveClientControls(event);assert.equal(client.status,'active');assert.equal(client.daily_steps_goal,undefined);assert.match(ctx.messages.at(-1),/network/);
 let resolve;ctx.result=new Promise(r=>resolve=r);const pending=ctx.saveClientControls(event);ctx.state.client=other;resolve([{id:'first',status:'ending',daily_steps_goal:9000}]);await pending;assert.equal(client.status,'ending');assert.equal(other.status,'active');assert.equal(ctx.state.client.id,'second');
 ctx.state.client=client;ctx.result=Promise.resolve([]);await ctx.saveClientControls(event);assert.match(ctx.messages.at(-1),/not confirmed/);
 let confirmations=0;ctx.confirm=()=>{confirmations++;return true};ctx.state.preview=true;ctx.state.data={sessions:[{id:'logged',status:'planned'}],exerciseLogs:[{training_session_id:'logged',reps:8}]};await ctx.deletePlannerSession('logged');assert.equal(confirmations,0);assert.equal(ctx.state.data.sessions.length,1);
 console.log('PASS: failed saves leave client state intact; late saves remain bound to their original client; empty responses fail; logged activities cannot be deleted.');
}main().catch(e=>{console.error(e);process.exit(1)});

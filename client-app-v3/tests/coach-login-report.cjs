const fs=require('fs'),vm=require('vm'),assert=require('assert');
let rejectReport;
const report=new Promise((_,reject)=>{rejectReport=reject;});
const db={from(table){return {select(){return this;},order(){return Promise.resolve({data:[{id:'client',display_name:'Fixture',daily_steps_goal:8000}],error:null});},abortSignal(){return report;},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}};}};
const c=vm.createContext({window:{supabase:{createClient:()=>db}},document:{activeElement:null},location:{hash:''},URLSearchParams,Date,console,setTimeout,clearTimeout,AbortController});
vm.runInContext(fs.readFileSync(__dirname+'/../app-v2.js','utf8').split('\nbindShell();')[0],c);
vm.runInContext("state.user={id:'coach'};state.role='coach';renderCoach=function(){};",c);
(async()=>{
 await vm.runInContext('loadCoach()',c);
 assert.equal(vm.runInContext('state.clients.length',c),1,'Roster available before report finishes');
 assert.equal(vm.runInContext('state.qaStatus',c),'loading');
 rejectReport(new Error('statement timeout'));await new Promise(r=>setTimeout(r,0));
 assert.equal(vm.runInContext('state.qaStatus',c),'unavailable');
 assert.equal(vm.runInContext('state.clients.length',c),1);
 assert.ok(vm.runInContext('qaDashboard(state.clients)',c).includes('still accessible'));
 console.log('PASS: valid coach roster loads independently of slow or failed optional QA; report failure keeps client access.');
})().catch(e=>{console.error(e);process.exitCode=1;});

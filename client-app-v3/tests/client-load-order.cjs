const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(__dirname+'/../app-v2.js','utf8');
const pending=[];let batch=0;
const state={user:{id:'coach-a'},role:'coach',client:{id:'client-a'},data:{weeks:[]}};
const db={from(){const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,in:()=>chain};return chain;}};
const context=vm.createContext({state,db,Promise,Map,query:async(label)=>{if(label==='Weeks'){const id=++batch;return new Promise(resolve=>pending.push(()=>resolve([{id:'week-'+id}])));}return[];}});
vm.runInContext(source.slice(source.indexOf('let clientDataLoadSequence ='),source.indexOf('\nfunction demoData()')),context);
(async()=>{
 const old=context.loadClientData('client-a'),latest=context.loadClientData('client-a');pending[1]();assert.equal(await latest,true);assert.equal(state.data.weeks[0].id,'week-2');pending[0]();assert.equal(await old,false);assert.equal(state.data.weeks[0].id,'week-2','late same-client load must not overwrite the latest records');
 const accountChange=context.loadClientData('client-a');state.user={id:'coach-b'};pending[2]();assert.equal(await accountChange,false);assert.equal(state.data.weeks[0].id,'week-2');
 const returnToClient=context.loadClientData('client-a');state.client={id:'client-b'};const other=context.loadClientData('client-b');state.client={id:'client-a'};const returned=context.loadClientData('client-a');pending[5]();assert.equal(await returned,true);pending[3]();assert.equal(await returnToClient,false);pending[4]();assert.equal(await other,false);assert.equal(state.data.weeks[0].id,'week-6');
 console.log('PASS: same-client refresh ordering, account switches and A-to-B-to-A loads reject stale records.');
})().catch(e=>{console.error(e);process.exit(1);});

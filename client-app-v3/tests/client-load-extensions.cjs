const assert=require('assert'),fs=require('fs'),vm=require('vm'),tick=()=>new Promise(r=>setImmediate(r));
const read=name=>fs.readFileSync(__dirname+'/../'+name,'utf8');
const workspace=read('coaching-workspace.js');
const cases=[
 ['coaching',workspace.slice(workspace.indexOf('const originalLoadCoachingClient='),workspace.indexOf('\nCOACH_TABS.push')),3,'coachingGoals'],
 ['exercise choices',read('gym-options.js').split('\n').filter(line=>line.startsWith('const gymLoadBefore=')||line.startsWith('loadClientData=async function')).join('\n'),1,'exerciseChoices'],
 ['workout history',read('workout-history.js').split('\n').find(line=>line.includes('let historyLoadSequence=')),1,'sessions']
];
(async()=>{for(const [name,source,count,key]of cases){
 const pending=[],state={user:{id:'u'},role:'coach',preview:false,client:{id:'a'},data:{sessions:[]}};
 const db={from(){const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q};return q;},rpc:()=>({})};
 let prior=false;const c=vm.createContext({state,db,Map,Promise,loadClientData:async()=>prior,query:()=>new Promise(resolve=>pending.push(resolve))});vm.runInContext(source,c);
 assert.equal(await c.loadClientData('a'),false);assert.equal(pending.length,0,name+' must stop after a discarded base load');prior=true;
 const old=c.loadClientData('a');await tick();const latest=c.loadClientData('a');await tick();assert.equal(pending.length,count*2);
 for(let i=count;i<count*2;i++)pending[i]([{id:'latest'}]);assert.equal(await latest,true);for(let i=0;i<count;i++)pending[i]([{id:'obsolete'}]);assert.equal(await old,false);assert.equal(state.data[key][0].id,'latest',name+' must reject stale extension results');
 const changed=c.loadClientData('a');await tick();state.user={id:'another-user'};for(let i=count*2;i<count*3;i++)pending[i]([{id:'foreign'}]);assert.equal(await changed,false);assert.equal(state.data[key][0].id,'latest');
 }console.log('PASS: coaching, exercise choices and workout extensions discard obsolete loads and account-switch responses.');
})().catch(e=>{console.error(e);process.exit(1);});

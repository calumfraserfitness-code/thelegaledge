const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../coaching-workspace.js','utf8');
const wrapper=source.slice(source.indexOf('const originalLoadCoachingClient='),source.indexOf("COACH_TABS.push"));
async function scenario(switchClient){
 let release;const base=new Promise(resolve=>release=resolve),reads=[];
 const state={user:{id:'account'},role:'client',client:{id:'one'},data:{}};
 const context=vm.createContext({state,Promise,loadClientData:()=>base,query:async(label)=>{reads.push(label);return [{client_id:'one'}];},db:{from(){const q={select(){return q},eq(){return q},order(){return q},limit(){return q}};return q}}});
 vm.runInContext(wrapper,context);const pending=context.loadClientData('one');
 assert.equal(reads.length,3,'Goals, calls and guidance start before the base load finishes');
 if(switchClient)state.client={id:'two'};
 release(true);const result=await pending;
 assert.equal(result,!switchClient);
 assert.equal(!!state.data.coachingGoals,!switchClient,'Stale client reads cannot populate another client');
}
(async()=>{await scenario(false);await scenario(true);console.log('PASS coaching reads run concurrently and reject stale client results');})().catch(e=>{console.error(e);process.exitCode=1});

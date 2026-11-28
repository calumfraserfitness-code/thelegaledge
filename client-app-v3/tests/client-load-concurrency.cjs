const fs=require('fs'),vm=require('vm'),assert=require('assert');
async function test(kind,change){
 const source=fs.readFileSync(__dirname+'/../'+(kind==='gym'?'gym-options.js':'workout-history.js'),'utf8');
 const start=kind==='gym'?'const gymLoadBefore=':'let historyLoadSequence=';
 const end=kind==='gym'?'const gymRowsBefore=':'window.WorkoutHistory=';
 const code=source.slice(source.indexOf(start),source.indexOf(end));
 let release;const base=new Promise(resolve=>release=resolve),reads=[];
 const state={user:{id:'owner'},role:'client',client:{id:'a'},data:{sessions:[]}};
 const context=vm.createContext({state,Promise,Map,loadClientData:()=>base,query:async label=>{reads.push(label);return [{id:'saved',client_id:'a'}]},db:{rpc(){},from(){const q={select(){return q},eq(){return q}};return q}}});
 vm.runInContext(code,context);const result=context.loadClientData('a');
 assert.equal(reads.length,1,kind+' starts its independent read before base data finishes');
 if(change)state.user={id:'different-owner'};
 release(true);assert.equal(await result,!change);
 assert.equal(kind==='gym'?!!state.data.exerciseChoices:state.data.sessions.length>0,!change,'Account changes reject late '+kind+' results');
}
(async()=>{for(const kind of ['gym','history']){await test(kind,false);await test(kind,true)}console.log('PASS client exercise choices and history run concurrently without cross-account results')})().catch(e=>{console.error(e);process.exitCode=1});

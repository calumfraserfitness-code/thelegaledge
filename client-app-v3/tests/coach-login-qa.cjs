const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/../app-v2.js','utf8');
const fn=src.slice(src.indexOf('async function loadCoach()'),src.indexOf('async function loadClientData'));
async function scenario(result){
 let release;const pending=new Promise(resolve=>release=resolve);
 const ctx={AbortController,setTimeout,clearTimeout,document:{activeElement:null},state:{user:{id:'coach'},role:'coach',preview:false},normalizeClient:x=>x,renderCoach(){},$:()=>({classList:{contains:()=>true}}),db:{from:table=>({select:()=>({order:()=>table,abortSignal:()=>table}),then:resolve=>resolve(table)})},query:(label)=>label==='Client QA'?pending:Promise.resolve(label==='Clients'?[{id:'own'}]:[])};
 vm.createContext(ctx);vm.runInContext(fn,ctx);
 await ctx.loadCoach();assert.equal(ctx.state.clients.length,1);assert.equal(ctx.state.qaStatus,'loading');
 release(result);await new Promise(resolve=>setImmediate(resolve));return ctx;
}
(async()=>{const good=await scenario([{client_id:'own'},{client_id:'foreign'}]);assert.equal(good.state.qaRows.length,1);assert.equal(good.state.qaStatus,'ready');const bad=await scenario(Promise.reject(new Error('statement timeout')));assert.equal(bad.state.qaStatus,'unavailable');assert.equal(bad.state.clients.length,1);console.log('PASS coach access completes with pending or failed QA; reporting retains own roster scope.');})().catch(e=>{console.error(e);process.exitCode=1;});

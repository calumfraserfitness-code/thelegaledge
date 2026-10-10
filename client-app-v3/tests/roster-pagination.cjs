const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../app-v2.js','utf8');
const fn=src.slice(src.indexOf('async function loadCoach()'),src.indexOf('async function loadClientData'));
(async()=>{const fixtures=Array.from({length:1001},(_,i)=>({id:'client-'+i})),ranges=[];
const ctx={AbortController,setTimeout,clearTimeout,document:{activeElement:null},state:{user:{id:'coach'},role:'coach'},normalizeClient:x=>x,renderCoach(){},$:()=>null,
 db:{from(table){return {select(){return this},order(){return this},range(a,b){ranges.push([table,a,b]);return {data:table==='clients'?fixtures.slice(a,b+1):[],error:null}},abortSignal(){return {data:[],error:null}}}}},query:async(label,p)=>{if(p.error)throw p.error;return p.data||[]}};
vm.createContext(ctx);vm.runInContext(fn,ctx);await ctx.loadCoach();assert.equal(ctx.state.clients.length,1001);assert.equal(ctx.state.clients.at(-1).id,'client-1000');assert.deepEqual(ranges.filter(r=>r[0]==='clients').map(r=>r.slice(1)),[[0,499],[500,999],[1000,1499]]);console.log('PASS: 1001 roster records load across stable API pages without truncation.');})().catch(e=>{console.error(e);process.exitCode=1});

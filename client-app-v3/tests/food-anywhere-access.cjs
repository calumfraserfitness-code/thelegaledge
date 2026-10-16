const assert=require('assert'),fs=require('fs'),vm=require('vm'),{stripTypeScriptTypes}=require('module');
const source=fs.readFileSync(require('path').resolve(__dirname,'../../supabase/functions/food-anywhere/index.ts'),'utf8').replace(/^import .*;\n/gm,'');
async function attempt(role,body,rows){
 let handler,secretCalls=0,rateCalls=0;
 const caller={auth:{getUser:async()=>({data:{user:{id:'caller'}}})},from(table){const filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},async single(){return{data:{role}};},async maybeSingle(){return{data:rows.find(row=>filters.every(([k,v])=>row[k]===v))||null};}};return q;}};
 const admin={rpc:async(name)=>{if(name==='food_ai_secret'){secretCalls++;return{data:null};}rateCalls++;return{data:false};}};
 let calls=0;const context={createClient:()=>calls++===0?caller:admin,Deno:{env:{get:()=>''},serve:fn=>handler=fn},Response,AbortSignal,console};
 vm.runInNewContext(stripTypeScriptTypes(source),context);
 const response=await handler({method:'POST',headers:new Headers(),json:async()=>body});return{status:response.status,secretCalls,rateCalls};
}
(async()=>{
 const own={id:'own',coach_id:'caller',profile_id:'client-profile'},peer={id:'peer',coach_id:'other-coach',profile_id:'other-client'};
 const query={query:'food',country:'IE',date:'2026-10-16'};
 assert.equal((await attempt('coach',{...query,client_id:'own'},[own,peer])).status,429,'assigned coach reaches normal search rate gate');
 for(const [role,id] of [['coach','peer'],['client','own'],['coach','missing']]){const r=await attempt(role,{...query,client_id:id},[own,peer]);assert.equal(r.status,403);assert.equal(r.secretCalls,0,'unauthorized selection stops before provider secrets');assert.equal(r.rateCalls,0);}
 const self={id:'self',profile_id:'caller',coach_id:'coach'};
 assert.equal((await attempt('client',{...query,client_id:'self'},[self])).status,429);
 assert.equal((await attempt('client',query,[self])).status,429,'existing client request remains supported');
 console.log('PASS: coach/client food search ownership, denied peer selection, no privileged lookup before authorization.');
})().catch(e=>{console.error(e);process.exit(1);});

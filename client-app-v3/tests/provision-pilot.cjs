const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../../supabase/functions/provision-client/index.ts'),'utf8')
 .replace(/^import .*;\n/gm,'').replace('body: unknown','body').replace('req: Request','req')
 .replace(/let existing: \{[^}]+\} \| null = null;/,'let existing = null;').replace(/Deno.env.get\(([^)]+)\)!/g,'Deno.env.get($1)');
async function run(options={}){
 let handler,created=0;const deleted=[];
 function table(name){let op='read';const q={select(){return q},eq(){return q},neq(){return q},insert(){op='insert';return q},upsert(){op='upsert';return q},delete(){op='delete';deleted.push(name);return q},single(){return Promise.resolve(result())},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}};
 function result(){
  if(name==='profiles')return {data:{role:'coach'},error:null};
  if(name==='firm_pilots')return {data:options.missing?null:{id:'pilot',capacity:5,status:options.complete?'complete':'planning'},error:null};
  if(name==='firm_participants'&&op==='read')return {count:options.full?5:0,error:null};
  if(name==='firm_participants')return options.memberError?{data:null,error:{message:'Pilot is full'}}:{data:{id:'member'},error:null};
  if(name==='clients')return {data:{id:'client'},error:null};
  return {error:null};
 }return q;}
 const client={from:table,auth:{getUser:async()=>({data:{user:options.noAuth?null:{id:'coach'}},error:null}),admin:{createUser:async()=>{created++;return {data:{user:{id:'profile'}},error:null}},deleteUser:async()=>{deleted.push('auth');return {error:null}}}}};
 const ctx=vm.createContext({Deno:{env:{get:()=>''},serve:fn=>handler=fn},createClient:()=>client,Response,console:{log(){}},Boolean,Number,String});
 vm.runInContext(source,ctx);
 const response=await handler({method:'POST',headers:{get:()=>''},json:async()=>({pilot_id:'pilot',full_name:'QA participant',email:'qa@example.invalid',password:'synthetic-test-only'})});
 return {status:response.status,body:await response.json(),created,deleted};
}
(async()=>{
 assert.equal((await run({noAuth:true})).status,401);
 for(const options of [{full:true},{complete:true},{missing:true}]){const result=await run(options);assert.equal(result.created,0);assert.ok(result.status>=400);}
 const success=await run();assert.equal(success.status,200);assert.equal(success.body.participant.id,'member');assert.equal(success.created,1);
 const failure=await run({memberError:true});assert.equal(failure.status,409);assert.deepEqual(failure.deleted,['clients','profiles','auth']);
 console.log('PASS: pilot account ownership/capacity gates, optional starting weight, linked membership, failed membership cleanup. Mocked service tests; live sign-in still needs verification.');
})().catch(error=>{console.error(error);process.exitCode=1});

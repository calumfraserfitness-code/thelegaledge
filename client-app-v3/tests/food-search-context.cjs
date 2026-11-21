const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path'),{stripTypeScriptTypes}=require('module');
(async()=>{
 const {foodAnswers}=await import('../../supabase/functions/food-anywhere/context.mjs');
 const source=fs.readFileSync(path.resolve(__dirname,'../../supabase/functions/food-anywhere/index.ts'),'utf8').replace(/^import .*;\n/gm,'');
 async function request(failingTable){
  let handler,prompt='',providerCalls=0;
  const values={profiles:{role:'coach'},clients:{id:'c',coach_id:'u'},client_food_entries:[],nutrition_days:[],client_food_preferences:{notes:'No mushrooms'},client_food_feedback:[],onboarding_responses:{responses:{sections:{nutrition:{food_restrictions:'No pork or shellfish; do not mix meat and dairy',current_weight:123,email:'never-send@example.invalid'},lifestyle:{medical:'never-send'}}}}};
  const db={auth:{getUser:async()=>({data:{user:{id:'u'}}})},from(table){const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,single:async()=>({data:values[table]}),maybeSingle:async()=>({data:values[table],error:table===failingTable?{message:'unavailable'}:null}),then(resolve){return Promise.resolve({data:values[table],error:table===failingTable?{message:'unavailable'}:null}).then(resolve);}};return q;}};
  const admin={rpc:async(name)=>({data:name==='claim_food_search'?true:null})};let count=0;
  vm.runInNewContext(stripTypeScriptTypes(source),{foodAnswers,createClient:()=>count++===0?db:admin,Deno:{env:{get:name=>name==='OPENAI_API_KEY'?'synthetic-test-key':''},serve:fn=>handler=fn},Response,AbortSignal,console,fetch:async(url,options)=>{providerCalls++;prompt=JSON.stringify(JSON.parse(options.body).input);return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({foods:[],note:'Synthetic response'})}]}]}));}});
  const response=await handler({method:'POST',headers:new Headers(),json:async()=>({client_id:'c',query:'lunch',country:'IE',date:'2026-10-16',mode:'ai'})});return{status:response.status,prompt,providerCalls};
 }
 const ok=await request();assert.equal(ok.status,200);assert(ok.prompt.includes('No pork or shellfish'));assert(ok.prompt.includes('No mushrooms'));assert(!ok.prompt.includes('never-send'));assert(!ok.prompt.includes('current_weight'));
 for(const table of ['client_food_preferences','client_food_feedback','onboarding_responses']){const result=await request(table);assert.equal(result.status,503);assert.equal(result.providerCalls,0,'stop before inference when food requirements fail to load');}
 console.log('PASS: endpoint includes saved onboarding restrictions, excludes unrelated private answers, stops on failed requirement reads.');
})().catch(e=>{console.error(e);process.exit(1);});

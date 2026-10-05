import {createClient} from 'jsr:@supabase/supabase-js@2.57.4';
import {hevyWorkoutRows,openKey} from './model.mjs';
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return response({error:'POST required'},405);
 const token=req.headers.get('X-Health-Worker')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return response({error:'Unauthorized'},401);
 const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,admin=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false}});
 const authorized=await admin.rpc('health_worker_authorized',{p_token:token});
 if(authorized.error||authorized.data!==true)return response({error:'Unauthorized'},401);
 const claimed=await admin.rpc('claim_hevy_sync_batch');if(claimed.error)return response({error:'Queue unavailable'},503);
 const jobs=claimed.data||[];
 const outcomes=await Promise.all(jobs.map(async(connection:any)=>{
  let errorCode='sync_unavailable';
  try{
   const key=await openKey(connection,secret,connection.client_id),deadline=Date.now()+75000;
   async function page(n:number){if(Date.now()>deadline)throw Error('sync_timeout');const r=await fetch('https://api.hevyapp.com/v1/workouts?page='+n+'&pageSize=10',{headers:{'api-key':key,Accept:'application/json'},signal:AbortSignal.timeout(7000),redirect:'error'});if(!r.ok)throw Error(r.status===401||r.status===403?'needs_reconnect':r.status===429?'rate_limited':'sync_unavailable');const text=await r.text();if(text.length>2e6)throw Error('sync_unavailable');return JSON.parse(text);}
   const first=await page(1),count=Number(first.page_count);if(!Number.isInteger(count)||count<0||count>100000)throw Error('sync_unavailable');const rows=hevyWorkoutRows(first,connection.client_id);
   for(let n=2;n<=Math.min(count,10);n++)rows.push(...hevyWorkoutRows(await page(n),connection.client_id));
   // Check revocation before writing history; updates are additionally conditional on this credential.
   const current=await admin.from('hevy_connections').select('status,key_ciphertext').eq('client_id',connection.client_id).single();if(current.data?.status!=='connected'||current.data?.key_ciphertext!==connection.key_ciphertext)return 'changed';
   const unique=[...new Map(rows.map((r:any)=>[r.hevy_id,r])).values()];if(unique.length){const saved=await admin.from('hevy_workouts').upsert(unique,{onConflict:'client_id,hevy_id'});if(saved.error)throw Error('sync_unavailable');}
   const stamp=new Date().toISOString();const saved=await admin.from('hevy_connections').update({last_synced_at:stamp,last_error_code:null,next_sync_at:new Date(Date.now()+24*3600e3).toISOString(),updated_at:stamp}).eq('client_id',connection.client_id).eq('key_ciphertext',connection.key_ciphertext).eq('status','connected');if(saved.error)throw Error('sync_unavailable');return 'synced';
  }catch(e){if(e instanceof Error&&['needs_reconnect','rate_limited','sync_timeout'].includes(e.message))errorCode=e.message;else if(e instanceof Error&&e.name==='OperationError')errorCode='needs_reconnect';
   await admin.from('hevy_connections').update({last_error_code:errorCode,...(errorCode==='needs_reconnect'?{status:'needs_reconnect'}:{}),next_sync_at:new Date(Date.now()+3600e3).toISOString(),updated_at:new Date().toISOString()}).eq('client_id',connection.client_id).eq('key_ciphertext',connection.key_ciphertext).eq('status','connected');return 'failed';
  }
 }));
 return response({checked:jobs.length,synced:outcomes.filter(v=>v==='synced').length,failed:outcomes.filter(v=>v==='failed').length});
});

import {createClient} from 'jsr:@supabase/supabase-js@2.57.4';
import {normalizeDevicePayload} from './normalize.mjs';
const headers={'Access-Control-Allow-Origin':'https://legal-edge-client-app.vercel.app','Access-Control-Allow-Headers':'content-type,x-legal-edge-key','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply({error:'POST required'},405);
 const token=req.headers.get('x-legal-edge-key')||'';if(!/^[a-f0-9]{64}$/.test(token))return reply({error:'Valid device key required'},401);
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:key,error}=await admin.from('client_health_ingest_keys').select('id,scopes,expires_at,revoked_at').eq('token_hash',hash).maybeSingle();
 if(error||!key||key.revoked_at||Date.parse(key.expires_at)<=Date.now())return reply({error:'Device key expired, revoked or invalid'},401);
 if(Number(req.headers.get('content-length')||0)>2*1024*1024)return reply({error:'Payload too large'},413);
 try{const bytes=await req.arrayBuffer();if(bytes.byteLength>2*1024*1024)return reply({error:'Payload too large'},413);const payload=JSON.parse(new TextDecoder().decode(bytes));const records=normalizeDevicePayload(payload,key.scopes);const {data:count,error:saveError}=await admin.rpc('store_device_health_rows',{key_id:key.id,records});if(saveError)return reply({error:saveError.message.includes('Wait before')?'Upload too soon':'Upload could not be saved'},saveError.message.includes('Wait before')?429:400);return reply({saved_days:count,synced_at:new Date().toISOString()});}catch(error){return reply({error:error instanceof Error?error.message:'Invalid upload'},400);}
});

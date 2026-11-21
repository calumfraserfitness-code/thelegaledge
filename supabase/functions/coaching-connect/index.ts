import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.8';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const headers={'Access-Control-Allow-Origin':'https://legal-edge-client-app.vercel.app','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
const provider=(path:string,key:string,options:RequestInit={})=>fetch(`https://api.fathom.ai/external/v1/${path}`,{...options,headers:{'X-Api-Key':key,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return json({error:'Sign in required'},401);
 const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return json({error:'Sign in required'},401);
 const {data:profile}=await db.from('profiles').select('role,email').eq('id',user.id).single();if(profile?.role!=='coach')return json({error:'Coach access required'},403);
 try{
  const raw=await req.text();if(raw.length>4096)return json({error:'Request too large'},413);const body=JSON.parse(raw);
  if(body.action==='status'){
   const result=await db.rpc('coaching_fathom_config',{p_coach:user.id,p_action:'status'});if(result.error)return json({error:'Unable to read connection status'},500);return json(result.data);
  }
  if(body.action!=='save'||typeof body.api_key!=='string'||body.api_key.trim().length<10||body.api_key.length>1024)return json({error:'Enter the replacement Fathom API key'},400);
  const key=body.api_key.trim();
  const check=await provider(`meetings?recorded_by[]=${encodeURIComponent(profile.email)}&created_after=${encodeURIComponent(new Date(Date.now()-30*86400000).toISOString())}`,key);
  if(!check.ok)return json({error:check.status===401||check.status===403?'Fathom rejected this key. Check the replacement key and account.':'Fathom is unavailable. Try again shortly.'},400);
  const meetings=await check.json();if(!Array.isArray(meetings.items))return json({error:'Unexpected response from Fathom'},502);
  // Key never leaves the authenticated server handler or encrypted Vault storage.
  const saved=await db.rpc('coaching_fathom_config',{p_coach:user.id,p_action:'key',p_key:key});if(saved.error)return json({error:'Unable to securely save the key'},500);
  const destination=`${Deno.env.get('SUPABASE_URL')}/functions/v1/fathom-coaching-webhook?connection=${user.id}`;
  const response=await provider('webhooks',key,{method:'POST',body:JSON.stringify({destination_url:destination,triggered_for:['my_recordings'],include_transcript:true,include_summary:true,include_action_items:true})});
  if(!response.ok)return json({error:'Key saved, but webhook registration failed. Save again to retry.'},502);
  const webhook=await response.json();
  if(typeof webhook.id!=='string'||typeof webhook.secret!=='string'||!webhook.secret.startsWith('whsec_'))return json({error:'Fathom returned an incomplete webhook. Save again to retry.'},502);
  const activated=await db.rpc('coaching_fathom_config',{p_coach:user.id,p_action:'activate',p_webhook: webhook.id,p_secret:webhook.secret});
  if(activated.error){await provider(`webhooks/${encodeURIComponent(webhook.id)}`,key,{method:'DELETE'}).catch(()=>{});return json({error:'Unable to save webhook signing secret. Save again to retry.'},500);}
  return json(activated.data);
 }catch{return json({error:'Unable to complete the connection. Your key was not included in this error.'},500);}
});

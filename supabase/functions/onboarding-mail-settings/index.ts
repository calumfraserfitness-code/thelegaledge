import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import {verifiedSender} from '../_shared/onboarding-mail.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const headers={'Access-Control-Allow-Origin':'https://legal-edge-client-app.vercel.app','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return json({error:'Sign in required'},401);
 const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return json({error:'Sign in required'},401);
 const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='coach')return json({error:'Coach access required'},403);
 try{
  if(Number(req.headers.get('content-length')||0)>4000)return json({error:'Request too large'},413);
  const raw=await req.text();if(raw.length>4000)return json({error:'Request too large'},413);const body=JSON.parse(raw);if(!['status','save','disable'].includes(body.action))return json({error:'Invalid action'},400);
  if(body.action==='save')await verifiedSender(body.key,body.sender);
  const {data,error:saveError}=await db.rpc('onboarding_email_config',{p_coach:user.id,p_action:body.action,p_key:body.action==='save'?body.key:null,p_sender:body.action==='save'?body.sender:null,p_enabled:body.enabled===true});
  if(saveError)return json({error:'Unable to save email connection'},500);
  return json(data);
 }catch(e){return json({error:e instanceof Error?e.message:'Unable to configure email'},400);}
});

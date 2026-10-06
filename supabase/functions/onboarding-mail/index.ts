import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import {sendSignedCopy} from '../_shared/onboarding-mail.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const key=req.headers.get('x-worker-key');if(!key)return new Response('Unauthorized',{status:401});
 const {data:allowed,error:authError}=await db.rpc('onboarding_email_worker_allowed',{p_token:key});
 if(authError||!allowed)return new Response('Unauthorized',{status:401});
 const {data:jobs,error}=await db.rpc('claim_document_copies');if(error)return new Response('Unable to load copies',{status:500});
 let accepted=0,failed=0;
 for(const job of jobs||[]){
  try{const id=await sendSignedCopy(job);const {error:saveError}=await db.rpc('finish_document_copy',{p_id:job.id,p_lease:job.lease_token,p_provider_id:id});if(saveError)failed++;else accepted++;}
  catch(e){failed++;await db.rpc('finish_document_copy',{p_id:job.id,p_lease:job.lease_token,p_error:e instanceof Error?e.message:'Email submission failed'});}
 }
 return Response.json({accepted,failed});
});

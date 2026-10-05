import {createClient} from 'npm:@supabase/supabase-js@2';
import {verifyStripeSignature} from './signature.mjs';
const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const reply=(status:number,received=false)=>new Response(JSON.stringify({received}),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply(405);
 if(Number(req.headers.get('content-length')||0)>65536)return reply(413);
 try{
  const body=await req.text();if(body.length>65536)return reply(413);
  const {data:secret,error}=await client.rpc('onboarding_stripe_secret');if(error||!secret)return reply(503);
  if(!await verifyStripeSignature(body,req.headers.get('stripe-signature'),secret))return reply(400);
  const event=JSON.parse(body),s=event.data?.object;
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return reply(200,true);
  if(event.livemode!==true||s?.livemode!==true||s?.payment_status!=='paid'||!(s.amount_total>0))return reply(200,true);
  if(!/^evt_[A-Za-z0-9]+$/.test(event.id)||!/^cs_[A-Za-z0-9_]+$/.test(s.id)||!/^plink_[A-Za-z0-9]+$/.test(s.payment_link)||! /^[a-f0-9]{48}$/.test(s.client_reference_id||''))return reply(200,true);
  const {error:failed}=await client.rpc('onboarding_stripe_paid',{p_event:event.id,p_token:s.client_reference_id,p_link:s.payment_link,p_session:s.id});
  return failed?reply(500):reply(200,true);
 }catch{return reply(400);}
});

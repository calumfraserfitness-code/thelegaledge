import {createClient} from 'jsr:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
const allowedHosts=new Set(['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com']);
function validSubscription(s:any){try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&allowedHosts.has(u.hostname)&&/^[A-Za-z0-9_-]{80,100}$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{20,30}$/.test(s.keys?.auth||'');}catch{return false;}}
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'',cors={'Access-Control-Allow-Origin':origin==='https://legal-edge-client-app.vercel.app'||/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)?origin:'https://legal-edge-client-app.vercel.app','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'POST required'},405);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const unwrap=(r:any)=>{if(r.error)throw Error(r.error.message);return r.data;};
 try{
  let config=unwrap(await admin.rpc('coaching_push_worker_config'));
  const worker=req.headers.get('X-Legal-Push-Worker');
  if(worker){
   if(!config.lec_push_worker||worker!==config.lec_push_worker)return reply({error:'Unauthorized'},401);
   const jobs=unwrap(await admin.rpc('claim_coaching_push_jobs'));let delivered=0,failed=0;
   for(const job of jobs){
    const subscriptions=unwrap(await admin.from('coaching_push_subscriptions').select('*').eq('user_id',job.recipient_id).eq('enabled',true));let accepted=false,transient=false;
    const payload=JSON.stringify({title:job.kind==='checkin'?'Legal Edge · New check-in':'Legal Edge · Coach review',body:job.kind==='checkin'?'A client check-in is ready for your review.':'Your coach has posted your review.',url:job.kind==='checkin'?'/'+('?section=reviews&checkin='+job.checkin_id):'/?section=checkin',tag:job.id});
    for(const sub of subscriptions){try{
      if(!validSubscription(sub.subscription)){await admin.from('coaching_push_subscriptions').update({enabled:false}).eq('id',sub.id);continue;}
      await webpush.sendNotification(sub.subscription,payload,{vapidDetails:{subject:'https://legal-edge-client-app.vercel.app',publicKey:config.lec_push_public,privateKey:config.lec_push_private},TTL:86400,timeout:12000,urgency:'normal'});accepted=true;
     }catch(e){const status=(e as any).statusCode;if(status===404||status===410)await admin.from('coaching_push_subscriptions').update({enabled:false}).eq('id',sub.id);else transient=true;}}
    const terminal=!accepted&&!transient||job.attempts>=5;
    unwrap(await admin.from('coaching_notification_jobs').update({status:accepted?'delivered':terminal?'failed':'pending',delivered_at:accepted?new Date().toISOString():null,lease_until:null,next_attempt_at:new Date(Date.now()+job.attempts*60000).toISOString(),last_error:accepted?null:terminal?'No working device subscription':'Push provider unavailable; retry queued'}).eq('id',job.id));if(accepted)delivered++;else failed++;
   }return reply({claimed:jobs.length,delivered,failed});
  }
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return reply({error:'Sign in first'},401);
  const {data:{user},error}=await admin.auth.getUser(token);if(error||!user)return reply({error:'Session expired'},401);
  const profile=unwrap(await admin.from('profiles').select('role').eq('id',user.id).single());if(!['coach','client'].includes(profile.role))return reply({error:'Account not eligible'},403);
  if(!config.lec_push_public){const keys=webpush.generateVAPIDKeys();unwrap(await admin.rpc('initialize_coaching_push',{p_public:keys.publicKey,p_private:keys.privateKey,p_worker:crypto.randomUUID()+crypto.randomUUID()}));config=unwrap(await admin.rpc('coaching_push_worker_config'));}
  const body=await req.json();
  if(body.action==='config')return reply({publicKey:config.lec_push_public});
  if(body.action==='subscribe'){
   if(!validSubscription(body.subscription))return reply({error:'Invalid notification subscription'},400);
   const existing=unwrap(await admin.from('coaching_push_subscriptions').select('user_id').eq('endpoint',body.subscription.endpoint).maybeSingle());
   if(existing&&existing.user_id!==user.id)return reply({error:'Unsubscribe the previous account on this device first'},409);
   unwrap(await admin.from('coaching_push_subscriptions').upsert({user_id:user.id,endpoint:body.subscription.endpoint,subscription:body.subscription,enabled:true,updated_at:new Date().toISOString()},{onConflict:'endpoint'}));return reply({saved:true});
  }
  if(body.action==='unsubscribe'){unwrap(await admin.from('coaching_push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',String(body.endpoint)));return reply({removed:true});}
  if(body.action==='test'){
   const subs=unwrap(await admin.from('coaching_push_subscriptions').select('subscription').eq('user_id',user.id).eq('enabled',true));if(!subs.length)return reply({error:'Enable this device first'},409);
   for(const s of subs)await webpush.sendNotification(s.subscription,JSON.stringify({title:'Legal Edge',body:'Notifications are enabled for this account.',url:'/',tag:'setup-test'}),{vapidDetails:{subject:'https://legal-edge-client-app.vercel.app',publicKey:config.lec_push_public,privateKey:config.lec_push_private},TTL:60,timeout:12000});return reply({accepted:true});
  }
  return reply({error:'Unknown action'},400);
 }catch(e){console.error('coaching-push operation failed');return reply({error:'Notifications could not complete. Retry or reconnect this device.'},500);}
});

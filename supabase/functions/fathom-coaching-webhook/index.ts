import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import {verifySignature,matchClient} from '../_shared/fathom-security.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const coach=new URL(req.url).searchParams.get('connection');if(!coach||!/^[0-9a-f-]{36}$/i.test(coach))return json({error:'Unknown connection'},401);
 if(Number(req.headers.get('content-length')||0)>2000000)return json({error:'Payload too large'},413);
 try{
  const raw=await req.text();if(raw.length>2000000)return json({error:'Payload too large'},413);
  const config=await db.rpc('coaching_fathom_secrets',{p_coach:coach});
  if(config.error||!config.data?.enabled||!await verifySignature(req.headers,raw,config.data.signing_secret))return json({error:'Invalid signature'},401);
  const meeting=JSON.parse(raw);if(!Number.isSafeInteger(meeting.recording_id)||meeting.recording_id<=0)return json({error:'Missing recording identity'},400);
  // A key for another Fathom account must never import that account's recordings.
  if(String(meeting.recorded_by?.email||'').toLowerCase()!==String(config.data.email||'').toLowerCase())return json({ignored:true});
  const clients=await db.from('clients').select('id,profile_id,display_name,email').eq('coach_id',coach).eq('status','active');if(clients.error)return json({error:'Retry later'},503);
  const match=matchClient(meeting,clients.data||[]);
  const occurred=meeting.recording_start_time||meeting.created_at;if(!occurred||Number.isNaN(Date.parse(occurred)))return json({error:'Missing recording date'},400);
  const url=typeof meeting.url==='string'&&/^https:\/\/fathom\.video\//.test(meeting.url)?meeting.url:null;
  const captured=await db.rpc('capture_fathom_recording',{p_coach:coach,p_recording:String(meeting.recording_id),p_client:match.client?.id||null,p_matching:match.status,p_url:url,p_title:String(meeting.meeting_title||meeting.title||'Coaching call').slice(0,500),p_occurred:occurred,p_summary:String(meeting.default_summary?.markdown_formatted||'').slice(0,30000),p_actions:Array.isArray(meeting.action_items)?meeting.action_items.map((a:Record<string,unknown>)=>({description:String(a.description||'').slice(0,2000),timestamp:a.recording_timestamp})):[]});
  if(captured.error)return json({error:'Capture failed; retry later'},503);
  return json({received:true,duplicate:captured.data.duplicate});
 }catch{return json({error:'Unable to process delivery; retry later'},503);}
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.57.4";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL")!;
  const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
  const {data:{user},error:userError}=await caller.auth.getUser();
  if(userError||!user) return json({error:"Unauthorised"},401);
  const admin=createClient(url,service);
  const {data:coach}=await admin.from("profiles").select("role").eq("id",user.id).single();
  if(coach?.role!=="coach") return json({error:"Coach access required"},403);
  const body=await req.json();
  const email=String(body.email||"").trim().toLowerCase();
  const password=String(body.password||"");
  const existingId=body.client_id ? String(body.client_id) : null;
  let existing: { id: string; display_name: string; profile_id: string | null } | null = null;
  if(existingId){
    const {data,error}=await admin.from("clients").select("id,display_name,profile_id").eq("id",existingId).eq("coach_id",user.id).single();
    if(error||!data) return json({error:"Existing client not found for this coach"},404);
    if(data.profile_id) return json({error:"This client already has an account"},409);
    existing=data;
  }
  const fullName=existing?.display_name||String(body.full_name||"").trim();
  const weight=Number(body.start_weight_display);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!fullName||password.length<12||(!existing&&(!Number.isFinite(weight)||weight<=0)))
    return json({error:"Name, valid email, starting weight and a 12+ character temporary password are required"},400);
  console.log('[provision-client] validated coach request', {coach_id:user.id, email});
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName},app_metadata:{role:"client"}});
  if(createError||!created.user) return json({error:createError?.message||"Could not create account"},400);
  const profile={id:created.user.id,role:"client",full_name:fullName,email};
  const {error:profileError}=await admin.from("profiles").upsert(profile);
  if(profileError){await admin.auth.admin.deleteUser(created.user.id);return json({error:profileError.message},400);}
  if(existing){
    const {data:linked,error:linkError}=await admin.from("clients")
      .update({profile_id:created.user.id,email}).eq("id",existing.id).eq("coach_id",user.id).is("profile_id",null).select().single();
    if(linkError||!linked){await admin.from("profiles").delete().eq("id",created.user.id);await admin.auth.admin.deleteUser(created.user.id);return json({error:linkError?.message||"Could not link the saved client"},409);}
    return json({client:linked});
  }
  const unit=body.market_region==="us"?"lbs":"kg";
  const {data:client,error:clientError}=await admin.from("clients").insert({profile_id:created.user.id,coach_id:user.id,display_name:fullName,email,phone:body.phone||null,status:"active",market_region:body.market_region||"other",weight_unit:unit,start_weight_kg:unit==="lbs"?weight/2.2046226218:weight,goal_summary:body.goal_summary||null,daily_steps_goal:Number(body.daily_steps_goal)||8000,checkin_day:Number(body.checkin_day??5),cardio_enabled:Boolean(body.cardio_enabled),mobility_enabled:Boolean(body.mobility_enabled),onboarding_status:"pending_legal",plan_status:"awaiting_onboarding",portal_enabled:false}).select().single();
  if(clientError){await admin.auth.admin.deleteUser(created.user.id);return json({error:clientError.message},400);}
  console.log('[provision-client] client created', {coach_id:user.id,client_id:client.id,user_id:created.user.id});
  return json({client});
});

import {createClient} from 'jsr:@supabase/supabase-js@2.57.4';
const headers={'Access-Control-Allow-Origin':'https://legal-edge-client-app.vercel.app','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Content-Type':'application/json'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL')!,caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});const {data:{user},error:authError}=await caller.auth.getUser();if(authError||!user)return reply({error:'Sign in as the assigned coach'},401);
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});let createdId:string|null=null;
 try{const b=await req.json();const {data:profile}=await caller.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='coach')return reply({error:'Coach access required'},403);
 const {data:organization}=await caller.from('firm_organizations').select('id,coach_id').eq('id',b.organization_id).eq('coach_id',user.id).maybeSingle();if(!organization)return reply({error:'Assigned firm not found'},403);
 const email=String(b.email||'').trim().toLowerCase(),name=String(b.full_name||'').trim(),password=String(b.password||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length<2||name.length>120||password.length<12)return reply({error:'Enter verified employer email, name and a temporary password of at least 12 characters'},400);
 const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});if(createError||!created.user)return reply({error:createError?.message||'Could not create account'},409);createdId=created.user.id;
 // Auth's legacy trigger creates a blank client. This fresh employer is not a coaching client.
 const {error:cleanupError}=await admin.from('clients').delete().eq('profile_id',createdId).is('coach_id',null);if(cleanupError)throw Error('Could not separate employer account');
 const {data:access,error:accessError}=await admin.from('firm_employer_access').insert({organization_id:organization.id,coach_id:user.id,user_id:createdId,display_name:name}).select('id,display_name,created_at').single();if(accessError)throw accessError;
 return reply({access,email,message:'Employer login created. Share the temporary password privately; no email was sent.'});
 }catch(error){if(createdId)await admin.auth.admin.deleteUser(createdId);return reply({error:error instanceof Error?error.message:'Could not create employer account'},400);}
});

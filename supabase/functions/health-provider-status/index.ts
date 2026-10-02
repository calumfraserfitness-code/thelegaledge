const headers = {'Access-Control-Allow-Origin':'https://legal-edge-client-app.vercel.app','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'};
Deno.serve((req: Request) => {
 if(req.method==='OPTIONS') return new Response('ok',{headers});
 if(req.method!=='POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers});
 return new Response(JSON.stringify({fitbit:{configured:Boolean(Deno.env.get('FITBIT_CLIENT_ID')?.trim() && Deno.env.get('FITBIT_CLIENT_SECRET')?.trim())},apple_health:{automatic_sync:false},health_connect:{automatic_sync:false}}),{headers});
});

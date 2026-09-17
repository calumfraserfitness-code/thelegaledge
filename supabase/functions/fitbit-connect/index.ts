import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fitbitClientId = Deno.env.get("FITBIT_CLIENT_ID");
    const fitbitClientSecret = Deno.env.get("FITBIT_CLIENT_SECRET");
    if (!fitbitClientId || !fitbitClientSecret) return json({ error: "Fitbit developer credentials are not configured yet." }, 503);
    const auth = req.headers.get("Authorization") || "";
    const userDb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userDb.auth.getUser();
    if (!user) return json({ error: "Sign in required." }, 401);
    const { client_id: clientId } = await req.json();
    if (!clientId) return json({ error: "client_id is required." }, 400);
    const { data: accessible } = await userDb.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!accessible) return json({ error: "Client access denied." }, 403);
    const admin = createClient(supabaseUrl, serviceKey);
    const state = crypto.randomUUID();
    const { error } = await admin.schema("private").from("health_oauth_states").insert({ state, client_id: clientId, user_id: user.id, provider: "fitbit" });
    if (error) throw error;
    const redirectUri = `${supabaseUrl}/functions/v1/fitbit-callback`;
    const params = new URLSearchParams({ response_type: "code", client_id: fitbitClientId, redirect_uri: redirectUri, scope: "activity heartrate profile sleep weight", state, expires_in: "604800" });
    return json({ authorization_url: `https://www.fitbit.com/oauth2/authorize?${params}` });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Could not start Fitbit connection." }, 500); }
});

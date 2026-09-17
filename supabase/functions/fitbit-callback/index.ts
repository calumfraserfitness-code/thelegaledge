import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const appUrl = Deno.env.get("APP_URL") || "https://legal-edge-client-app-calumfraser13cf-5687.vercel.app";
const finish = (status: string) => Response.redirect(`${appUrl}/?health=${encodeURIComponent(status)}`, 302);

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url), code = url.searchParams.get("code"), state = url.searchParams.get("state");
    if (!code || !state || url.searchParams.get("error")) return finish("fitbit_denied");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!, serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("FITBIT_CLIENT_ID")!, secret = Deno.env.get("FITBIT_CLIENT_SECRET")!;
    if (!clientId || !secret) return finish("fitbit_not_configured");
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: pending } = await admin.schema("private").from("health_oauth_states").select("*").eq("state", state).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!pending) return finish("fitbit_state_expired");
    const redirectUri = `${supabaseUrl}/functions/v1/fitbit-callback`;
    const tokenResponse = await fetch("https://api.fitbit.com/oauth2/token", { method: "POST", headers: { Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, grant_type: "authorization_code", redirect_uri: redirectUri, code }) });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(token.errors?.[0]?.message || "Fitbit token exchange failed.");
    const expiresAt = new Date(Date.now() + Number(token.expires_in || 28800) * 1000).toISOString();
    await admin.schema("private").from("health_provider_tokens").upsert({ client_id: pending.client_id, provider: "fitbit", provider_user_id: token.user_id, access_token: token.access_token, refresh_token: token.refresh_token, expires_at: expiresAt, scopes: String(token.scope || "").split(" ").filter(Boolean), updated_at: new Date().toISOString() });
    await admin.from("client_health_connections").upsert({ client_id: pending.client_id, provider: "fitbit", status: "connected", provider_user_id: token.user_id, scopes: String(token.scope || "").split(" ").filter(Boolean), last_synced_at: null, error_message: null, updated_at: new Date().toISOString() }, { onConflict: "client_id,provider" });
    await admin.schema("private").from("health_oauth_states").delete().eq("state", state);
    return finish("fitbit_connected");
  } catch (error) { console.error(error); return finish("fitbit_error"); }
});

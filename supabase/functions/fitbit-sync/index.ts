import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const day = (date: Date) => date.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!, anonKey = Deno.env.get("SUPABASE_ANON_KEY")!, serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "", userDb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userDb.auth.getUser(); if (!user) return json({ error: "Sign in required." }, 401);
    const { client_id: clientId, days = 14 } = await req.json();
    const { data: accessible } = await userDb.from("clients").select("id").eq("id", clientId).maybeSingle(); if (!accessible) return json({ error: "Client access denied." }, 403);
    const admin = createClient(supabaseUrl, serviceKey);
    let { data: token } = await admin.schema("private").from("health_provider_tokens").select("*").eq("client_id", clientId).eq("provider", "fitbit").maybeSingle();
    if (!token) return json({ error: "Connect Fitbit first." }, 409);
    if (new Date(token.expires_at).getTime() < Date.now() + 60000) {
      const id = Deno.env.get("FITBIT_CLIENT_ID")!, secret = Deno.env.get("FITBIT_CLIENT_SECRET")!;
      const response = await fetch("https://api.fitbit.com/oauth2/token", { method: "POST", headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token.refresh_token }) });
      const refreshed = await response.json(); if (!response.ok) throw new Error(refreshed.errors?.[0]?.message || "Fitbit session refresh failed.");
      token = { ...token, access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: new Date(Date.now() + Number(refreshed.expires_in || 28800) * 1000).toISOString() };
      await admin.schema("private").from("health_provider_tokens").update({ access_token: token.access_token, refresh_token: token.refresh_token, expires_at: token.expires_at, updated_at: new Date().toISOString() }).eq("client_id", clientId).eq("provider", "fitbit");
    }
    const headers = { Authorization: `Bearer ${token.access_token}` }, rows = [];
    for (let offset = Math.min(Number(days), 30) - 1; offset >= 0; offset--) {
      const date = new Date(); date.setUTCDate(date.getUTCDate() - offset); const dateText = day(date);
      const [activityRes, sleepRes, weightRes] = await Promise.all([
        fetch(`https://api.fitbit.com/1/user/-/activities/date/${dateText}.json`, { headers }),
        fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${dateText}.json`, { headers }),
        fetch(`https://api.fitbit.com/1/user/-/body/log/weight/date/${dateText}.json`, { headers })
      ]);
      if ([activityRes, sleepRes, weightRes].some(response => response.status === 401)) throw new Error("Fitbit authorization expired. Reconnect Fitbit.");
      const activity = activityRes.ok ? await activityRes.json() : {}, sleep = sleepRes.ok ? await sleepRes.json() : {}, weight = weightRes.ok ? await weightRes.json() : {};
      const summary = activity.summary || {}, sleepSummary = sleep.summary || {}, weightLog = weight.weight?.at(-1);
      rows.push({ client_id: clientId, date: dateText, steps: summary.steps ?? null, sleep_minutes: sleepSummary.totalMinutesAsleep ?? null, weight_kg: weightLog?.weight ?? null, resting_heart_rate: summary.restingHeartRate ?? null, active_calories: summary.activityCalories ?? summary.caloriesOut ?? null, distance_km: summary.distances?.find((item: { activity: string }) => item.activity === "total")?.distance ?? null, source: "fitbit", source_priority: 3, provider_record_id: dateText, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    const { error } = await admin.from("client_health_daily").upsert(rows, { onConflict: "client_id,date,source" }); if (error) throw error;
    const now = new Date().toISOString(); await admin.from("client_health_connections").update({ status: "connected", last_synced_at: now, error_message: null, updated_at: now }).eq("client_id", clientId).eq("provider", "fitbit");
    return json({ synced: rows.length, date_from: rows[0]?.date, date_to: rows.at(-1)?.date });
  } catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : "Fitbit sync failed." }, 500); }
});

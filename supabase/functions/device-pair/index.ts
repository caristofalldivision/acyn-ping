// Pairing flow for the Ping Agent.
//   POST /device-pair        (auth required) -> { pairing_code, expires_at, agent_id }
//   POST /device-pair/claim  (no auth)        body: { pairing_code, agent_name }
//                                              -> { agent_id, agent_secret }
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function rand(len: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const isClaim = url.pathname.endsWith("/claim");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    if (!isClaim) {
      // Authenticated user generates a pairing code
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: claims, error } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (error || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = claims.claims.sub;
      const pairing_code = rand(6);
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { data, error: insErr } = await admin.from("device_agents").insert({
        user_id: userId,
        pairing_code,
        pairing_code_expires_at: expires_at,
        status: "pending",
      }).select("id").single();
      if (insErr) throw insErr;
      return new Response(JSON.stringify({ pairing_code, expires_at, agent_id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Agent claims a pairing code (no user auth — agent isn't a user yet)
    const body = await req.json();
    const code = (body.pairing_code || "").toUpperCase().trim();
    const agent_name = (body.agent_name || "Ping Agent").slice(0, 80);
    if (!code) {
      return new Response(JSON.stringify({ error: "pairing_code required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: agent } = await admin.from("device_agents")
      .select("id, pairing_code_expires_at, status")
      .eq("pairing_code", code)
      .maybeSingle();
    if (!agent || agent.status !== "pending") {
      return new Response(JSON.stringify({ error: "Invalid or already-claimed code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (agent.pairing_code_expires_at && new Date(agent.pairing_code_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Pairing code expired" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const agent_secret = rand(32) + rand(32);
    const hash = await sha256(agent_secret);
    await admin.from("device_agents").update({
      name: agent_name,
      agent_secret_hash: hash,
      pairing_code: null,
      pairing_code_expires_at: null,
      status: "registered",
    }).eq("id", agent.id);

    return new Response(JSON.stringify({ agent_id: agent.id, agent_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("device-pair error:", e);
    return new Response(JSON.stringify({ error: e.message || "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

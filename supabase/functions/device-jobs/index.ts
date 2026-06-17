// Device job orchestration. Two audiences:
//
// === User UI endpoints (Bearer = user JWT) ===
//   POST /device-jobs            body: { device_id, kind, script_content? } -> { job_id }
//   GET  /device-jobs?device_id  -> [{ job }]      (recent history)
//
// === Agent endpoints (X-Agent-Id + X-Agent-Secret) ===
//   GET  /device-jobs/pending    -> [{ job, device }]   (pending jobs for this agent)
//   POST /device-jobs/log        body: { job_id, line }
//   POST /device-jobs/result     body: { job_id, status, output_log?, error? }
//   POST /device-jobs/device-status  body: { device_id, online, routeros_version?, model? }
//
// The agent polls /pending every few seconds (or holds an SSE stream — future).
// device-agent-bridge (WebSocket) is the optional fast path; this HTTP API is
// the always-works fallback and authoritative source.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function authUser(req: Request): Promise<string | null> {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const token = h.replace("Bearer ", "");
  const c = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: h } } });
  const { data, error } = await c.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

async function authAgent(req: Request): Promise<{ agent_id: string; user_id: string } | null> {
  const id = req.headers.get("X-Agent-Id");
  const secret = req.headers.get("X-Agent-Secret");
  if (!id || !secret) return null;
  const { data: agent } = await admin.from("device_agents")
    .select("id, user_id, agent_secret_hash, status")
    .eq("id", id).maybeSingle();
  if (!agent || agent.status === "pending") return null;
  if (await sha256(secret) !== agent.agent_secret_hash) return null;
  await admin.from("device_agents").update({
    last_seen_at: new Date().toISOString(),
    status: agent.status === "offline" ? "registered" : agent.status,
  }).eq("id", id);
  return { agent_id: agent.id, user_id: agent.user_id };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/device-jobs/, "") || "/";

  try {
    // ---------- Agent endpoints ----------
    if (path === "/pending" && req.method === "GET") {
      const auth = await authAgent(req);
      if (!auth) return json({ error: "agent unauthorized" }, 401);
      const { data } = await admin.from("device_jobs")
        .select("id, kind, script_content, device_id, devices!inner(id, name, vendor, host, port, connection_method, username, credential_encrypted, agent_id)")
        .eq("status", "pending")
        .eq("devices.agent_id", auth.agent_id)
        .order("created_at", { ascending: true })
        .limit(10);
      // Mark them running
      const ids = (data || []).map((r: any) => r.id);
      if (ids.length) {
        await admin.from("device_jobs").update({
          status: "running",
          started_at: new Date().toISOString(),
        }).in("id", ids);
      }
      return json({ jobs: data || [] });
    }

    if (path === "/log" && req.method === "POST") {
      const auth = await authAgent(req);
      if (!auth) return json({ error: "agent unauthorized" }, 401);
      const { job_id, line } = await req.json();
      if (!job_id || typeof line !== "string") return json({ error: "bad body" }, 400);
      const { data } = await admin.from("device_jobs").select("output_log").eq("id", job_id).single();
      await admin.from("device_jobs").update({
        output_log: (data?.output_log || "") + line + "\n",
      }).eq("id", job_id);
      return json({ ok: true });
    }

    if (path === "/result" && req.method === "POST") {
      const auth = await authAgent(req);
      if (!auth) return json({ error: "agent unauthorized" }, 401);
      const { job_id, status, output_log, error } = await req.json();
      if (!job_id || !["success", "failed", "rolled_back"].includes(status)) {
        return json({ error: "bad body" }, 400);
      }
      await admin.from("device_jobs").update({
        status,
        output_log: output_log ?? undefined,
        error: error ?? null,
        finished_at: new Date().toISOString(),
      }).eq("id", job_id);
      return json({ ok: true });
    }

    if (path === "/device-status" && req.method === "POST") {
      const auth = await authAgent(req);
      if (!auth) return json({ error: "agent unauthorized" }, 401);
      const { device_id, online, routeros_version, model } = await req.json();
      if (!device_id) return json({ error: "device_id required" }, 400);
      await admin.from("devices").update({
        status: online ? "online" : "offline",
        last_connected_at: online ? new Date().toISOString() : undefined,
        routeros_version: routeros_version ?? undefined,
        model: model ?? undefined,
      }).eq("id", device_id);
      return json({ ok: true });
    }

    // ---------- User endpoints ----------
    const userId = await authUser(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    if (req.method === "POST" && (path === "/" || path === "")) {
      const { device_id, kind, script_content } = await req.json();
      if (!device_id || !kind) return json({ error: "device_id and kind required" }, 400);
      const allowedKinds = ["fetch_config", "apply_script", "wizard_hotspot", "take_backup", "restore_backup"];
      if (!allowedKinds.includes(kind)) return json({ error: "invalid kind" }, 400);

      // Confirm device belongs to this user
      const { data: device } = await admin.from("devices")
        .select("id, agent_id").eq("id", device_id).eq("user_id", userId).maybeSingle();
      if (!device) return json({ error: "device not found" }, 404);
      if (!device.agent_id) return json({ error: "device has no agent assigned" }, 400);

      // Check if the agent is actually online. Still create the job either way
      // so it picks up the moment the agent comes back, but warn the caller.
      let warning: string | undefined;
      const { data: ag } = await admin.from("device_agents")
        .select("status, last_seen_at").eq("id", device.agent_id).maybeSingle();
      const lastSeenMs = ag?.last_seen_at ? Date.now() - new Date(ag.last_seen_at).getTime() : Infinity;
      if (!ag || ag.status !== "online" || lastSeenMs > 60_000) {
        warning = "Agent appears offline. Start it on your machine with `ping-agent run` (or re-run the installer). The job will run automatically once the agent reconnects.";
      }

      const { data: job, error } = await admin.from("device_jobs").insert({
        user_id: userId, device_id, kind, script_content: script_content ?? null,
        status: "pending",
      }).select("id").single();
      if (error) throw error;
      return json({ job_id: job.id, warning });
    }

    if (req.method === "GET" && (path === "/" || path === "")) {
      const device_id = url.searchParams.get("device_id");
      let q = admin.from("device_jobs").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(50);
      if (device_id) q = q.eq("device_id", device_id);
      const { data } = await q;
      return json({ jobs: data || [] });
    }

    return json({ error: "not found" }, 404);
  } catch (e: any) {
    console.error("device-jobs error", e);
    return json({ error: e.message || "internal error" }, 500);
  }
});

// WebSocket bridge between the Topha Agent (running on the ISP's LAN) and Supabase.
//
// Connect:   wss://<project>.functions.supabase.co/device-agent-bridge?agent_id=...&secret=...
//
// Wire protocol (JSON messages, both directions):
//   { type: "hello",    agent_version: string }                            (agent -> server, optional)
//   { type: "ack",      agent_id: string }                                 (server -> agent on connect)
//   { type: "job",      job_id, kind, device, script_content }             (server -> agent)
//   { type: "log",      job_id, line }                                     (agent -> server, streamed)
//   { type: "result",   job_id, status: "success"|"failed"|"rolled_back",  (agent -> server, terminal)
//                       output_log?: string, error?: string }
//   { type: "ping" } / { type: "pong" }                                    (keepalive)
//
// In-memory registry maps agent_id -> WebSocket. Each instance only knows about
// agents connected to *itself* — device-jobs uses a Postgres NOTIFY-style hop
// via supabase realtime to find which instance owns the agent. For the v0.1
// single-instance deployment this map is enough.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// In-memory: agent_id -> { socket, userId }
const agents = new Map<string, { socket: WebSocket; userId: string }>();
// Track the active job the agent is processing
const jobOwners = new Map<string, string>(); // job_id -> agent_id

(globalThis as any).__topha_agents = agents;
(globalThis as any).__topha_jobs = jobOwners;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function appendLog(jobId: string, line: string) {
  const { data } = await admin.from("device_jobs").select("output_log").eq("id", jobId).single();
  const next = (data?.output_log || "") + line + "\n";
  await admin.from("device_jobs").update({ output_log: next }).eq("id", jobId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    // Allow status check via GET
    return new Response(JSON.stringify({
      ok: true,
      connected_agents: agents.size,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const url = new URL(req.url);
  const agent_id = url.searchParams.get("agent_id") || "";
  const secret = url.searchParams.get("secret") || "";
  if (!agent_id || !secret) {
    return new Response("agent_id and secret required", { status: 400 });
  }

  // Verify the agent
  const { data: agent } = await admin.from("device_agents")
    .select("id, user_id, agent_secret_hash, status")
    .eq("id", agent_id).maybeSingle();
  if (!agent || agent.status !== "registered") {
    return new Response("unknown agent", { status: 401 });
  }
  const hash = await sha256(secret);
  if (hash !== agent.agent_secret_hash) {
    return new Response("bad secret", { status: 401 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = async () => {
    agents.set(agent_id, { socket, userId: agent.user_id });
    await admin.from("device_agents").update({
      status: "online",
      last_seen_at: new Date().toISOString(),
    }).eq("id", agent_id);
    socket.send(JSON.stringify({ type: "ack", agent_id }));
  };

  socket.onmessage = async (ev) => {
    let msg: any;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if (msg.type === "ping") { socket.send(JSON.stringify({ type: "pong" })); return; }

    if (msg.type === "log" && msg.job_id) {
      await appendLog(msg.job_id, String(msg.line || ""));
      return;
    }

    if (msg.type === "result" && msg.job_id) {
      const status = ["success", "failed", "rolled_back"].includes(msg.status) ? msg.status : "failed";
      await admin.from("device_jobs").update({
        status,
        output_log: msg.output_log ?? undefined,
        error: msg.error ?? null,
        finished_at: new Date().toISOString(),
      }).eq("id", msg.job_id);
      jobOwners.delete(msg.job_id);
      return;
    }

    if (msg.type === "device_status" && msg.device_id) {
      await admin.from("devices").update({
        status: msg.online ? "online" : "offline",
        last_connected_at: msg.online ? new Date().toISOString() : undefined,
        routeros_version: msg.routeros_version ?? undefined,
        model: msg.model ?? undefined,
      }).eq("id", msg.device_id);
    }
  };

  socket.onclose = async () => {
    agents.delete(agent_id);
    await admin.from("device_agents").update({
      status: "offline",
      last_seen_at: new Date().toISOString(),
    }).eq("id", agent_id);
  };

  socket.onerror = (e) => console.error("ws error", agent_id, e);

  return response;
});

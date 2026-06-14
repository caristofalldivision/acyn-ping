// Generates a structured, step-by-step hotspot setup plan for MikroTik routers.
// Returns: { steps: [{ id, title, description, kind: "read"|"write", commands: string[], rollback_commands: string[], requires_confirm: boolean }] }
//
// The agent runs these steps in order, reports per-step status, and on failure
// runs rollback_commands for the failed step (and the wizard UI can also restore
// from the /system backup created in step 1).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface Params {
  hotspot_interface: string;        // e.g. "ether2" or "bridge-hotspot"
  network: string;                   // e.g. "10.5.50.0/24"
  gateway_ip: string;                // e.g. "10.5.50.1"
  pool_range: string;                // e.g. "10.5.50.10-10.5.50.254"
  dns_name: string;                  // e.g. "wifi.myisp.co.ke"
  dns_servers: string;               // e.g. "1.1.1.1,8.8.8.8"
  hotspot_profile_name: string;      // e.g. "hsprof1"
  payment_walled_garden: string[];   // domains, e.g. ["*.safaricom.co.ke","*.mpesa.com"]
  voucher_user_profile: string;      // e.g. "1hr-5mb"
  rate_limit: string;                // e.g. "5M/5M"
  session_timeout: string;           // e.g. "1h"
}

function buildPlan(p: Params, deviceName: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupName = `ping-pre-hotspot-${ts}`;
  const exportName = `ping-pre-hotspot-${ts}.rsc`;
  const wg = p.payment_walled_garden.length
    ? p.payment_walled_garden
    : ["*.safaricom.co.ke", "*.safaricom.com", "*.mpesa.com", "*.gstatic.com"];

  return {
    summary: `Hotspot setup for ${deviceName} on ${p.hotspot_interface} (${p.network}). Creates pool, profile, server, walled garden (${wg.length} entries) and one user profile "${p.voucher_user_profile}".`,
    backup_name: backupName,
    steps: [
      {
        id: "backup",
        title: "Take safety backup",
        description: "Save a full system backup and an export so we can roll back if anything goes wrong.",
        kind: "write",
        requires_confirm: false,
        commands: [
          `/system backup save name=${backupName}`,
          `/export file=${exportName.replace(".rsc", "")}`,
        ],
        rollback_commands: [],
      },
      {
        id: "preflight",
        title: "Preflight checks",
        description: "Verify the interface exists and the network is not already in use.",
        kind: "read",
        requires_confirm: false,
        commands: [
          `/interface print where name=${p.hotspot_interface}`,
          `/ip address print where address~"${p.network.split("/")[0].split(".").slice(0, 3).join(".")}"`,
          `/ip hotspot print`,
        ],
        rollback_commands: [],
      },
      {
        id: "address",
        title: "Assign gateway IP to hotspot interface",
        description: `Add ${p.gateway_ip}/${p.network.split("/")[1]} to ${p.hotspot_interface}.`,
        kind: "write",
        requires_confirm: true,
        commands: [
          `/ip address add address=${p.gateway_ip}/${p.network.split("/")[1]} interface=${p.hotspot_interface} comment="ping-hotspot"`,
        ],
        rollback_commands: [
          `/ip address remove [find comment="ping-hotspot"]`,
        ],
      },
      {
        id: "pool",
        title: "Create DHCP pool",
        description: `Range ${p.pool_range} for hotspot clients.`,
        kind: "write",
        requires_confirm: true,
        commands: [
          `/ip pool add name=ping-hs-pool ranges=${p.pool_range}`,
        ],
        rollback_commands: [
          `/ip pool remove [find name=ping-hs-pool]`,
        ],
      },
      {
        id: "dhcp",
        title: "Create DHCP server",
        description: "Bind DHCP server to the hotspot interface using the pool.",
        kind: "write",
        requires_confirm: true,
        commands: [
          `/ip dhcp-server add name=ping-hs-dhcp interface=${p.hotspot_interface} address-pool=ping-hs-pool lease-time=1h disabled=no`,
          `/ip dhcp-server network add address=${p.network} gateway=${p.gateway_ip} dns-server=${p.dns_servers}`,
        ],
        rollback_commands: [
          `/ip dhcp-server remove [find name=ping-hs-dhcp]`,
          `/ip dhcp-server network remove [find address=${p.network}]`,
        ],
      },
      {
        id: "profile",
        title: "Create hotspot server profile",
        description: `Profile "${p.hotspot_profile_name}" with login method http-chap + http-pap.`,
        kind: "write",
        requires_confirm: true,
        commands: [
          `/ip hotspot profile add name=${p.hotspot_profile_name} hotspot-address=${p.gateway_ip} dns-name=${p.dns_name} html-directory=hotspot login-by=http-chap,http-pap,mac-cookie http-cookie-lifetime=1d`,
        ],
        rollback_commands: [
          `/ip hotspot profile remove [find name=${p.hotspot_profile_name}]`,
        ],
      },
      {
        id: "server",
        title: "Create hotspot server",
        description: "Bind the server to the interface using the profile and pool.",
        kind: "write",
        requires_confirm: true,
        commands: [
          `/ip hotspot add name=ping-hs interface=${p.hotspot_interface} profile=${p.hotspot_profile_name} address-pool=ping-hs-pool disabled=no idle-timeout=5m`,
        ],
        rollback_commands: [
          `/ip hotspot remove [find name=ping-hs]`,
        ],
      },
      {
        id: "user-profile",
        title: "Create voucher user profile",
        description: `"${p.voucher_user_profile}" — rate ${p.rate_limit}, timeout ${p.session_timeout}.`,
        kind: "write",
        requires_confirm: true,
        commands: [
          `/ip hotspot user profile add name=${p.voucher_user_profile} rate-limit=${p.rate_limit} session-timeout=${p.session_timeout} shared-users=1`,
        ],
        rollback_commands: [
          `/ip hotspot user profile remove [find name=${p.voucher_user_profile}]`,
        ],
      },
      {
        id: "walled-garden",
        title: "Add walled garden entries",
        description: `Allow ${wg.length} domains pre-login (payment & captive-portal probes).`,
        kind: "write",
        requires_confirm: true,
        commands: wg.map(d =>
          `/ip hotspot walled-garden add dst-host=${d} action=allow comment="ping-wg"`
        ),
        rollback_commands: [
          `/ip hotspot walled-garden remove [find comment="ping-wg"]`,
        ],
      },
      {
        id: "verify",
        title: "Verify",
        description: "Read back the created hotspot, profile and a couple of walled-garden entries.",
        kind: "read",
        requires_confirm: false,
        commands: [
          `/ip hotspot print`,
          `/ip hotspot profile print where name=${p.hotspot_profile_name}`,
          `/ip hotspot walled-garden print count-only where comment="ping-wg"`,
        ],
        rollback_commands: [],
      },
    ],
    full_rollback_commands: [
      `/ip hotspot walled-garden remove [find comment="ping-wg"]`,
      `/ip hotspot remove [find name=ping-hs]`,
      `/ip hotspot user profile remove [find name=${p.voucher_user_profile}]`,
      `/ip hotspot profile remove [find name=${p.hotspot_profile_name}]`,
      `/ip dhcp-server network remove [find address=${p.network}]`,
      `/ip dhcp-server remove [find name=ping-hs-dhcp]`,
      `/ip pool remove [find name=ping-hs-pool]`,
      `/ip address remove [find comment="ping-hotspot"]`,
    ],
    restore_command: `/system backup load name=${backupName}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = auth.replace("Bearer ", "");
    const c = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await c.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const params: Params = body.params;
    const deviceName: string = body.device_name || "router";

    if (!params?.hotspot_interface || !params?.network || !params?.gateway_ip) {
      return new Response(JSON.stringify({ error: "Missing required params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const plan = buildPlan(params, deviceName);

    let aiNotes = "";
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are Topher, a MikroTik expert. In <80 words, write a brief operator note explaining what this hotspot setup will do and what the operator should watch for. No markdown headers." },
            { role: "user", content: `Device: ${deviceName}. ${plan.summary}` },
          ],
        }),
      });
      if (r.ok) {
        const j = await r.json();
        aiNotes = j.choices?.[0]?.message?.content?.trim() || "";
      }
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ ...plan, ai_notes: aiNotes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("wizard-hotspot error", e);
    return new Response(JSON.stringify({ error: e.message || "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

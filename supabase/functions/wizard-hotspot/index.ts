// Generates a structured, step-by-step hotspot setup plan for MikroTik routers.
// Returns: { steps: [...], full_rollback_commands, ai_notes }
//
// NOTE: We intentionally do NOT take a /system backup or run /system reset
// inside the wizard — both are risky over SSH (reset kills the session, backup
// timing differs across RouterOS versions). The Add-Router UI tells the
// operator to take a backup or do a "reset no-defaults" in Winbox BEFORE
// pairing the agent. Once the agent connects, the wizard only configures.
//
// The plan ends with a `portal-files` step that uploads a Pesapal + voucher
// captive portal (login.html + alogin.html) to /flash/<html-directory>/ using
// `/file add contents="..."`. The portal posts to Ping's `captive-portal-pay`
// edge function and auto-logs the user in once payment is confirmed.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface Params {
  hotspot_interface: string;
  network: string;
  gateway_ip: string;
  pool_range: string;
  dns_name: string;
  dns_servers: string;
  hotspot_profile_name: string;
  payment_walled_garden: string[];
  voucher_user_profile: string;
  rate_limit: string;
  session_timeout: string;
}

// Escape a string so it survives RouterOS `/file add contents="..."` parsing.
// RouterOS quoted strings: `\` `"` `$` `?` are special. Newlines -> \n.
function rosEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/\?/g, "\\?")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n");
}

// Minimal MikroTik captive portal — M-Pesa via Pesapal + voucher tab.
// Uses $(link-login-only), $(error), $(link-orig), $(mac), $(ip) — RouterOS
// hotspot template variables that are substituted at serve-time.
function buildLoginHtml(opts: { backend: string; deviceId: string; brand: string }): string {
  const { backend, deviceId, brand } = opts;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${brand} WiFi</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:linear-gradient(135deg,#0e7c7b,#114b5f);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;color:#222}
.card{background:#fff;border-radius:16px;padding:24px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
h1{font-size:1.5rem;color:#0e7c7b;text-align:center;margin-bottom:4px}
.tag{text-align:center;color:#666;font-size:.85rem;margin-bottom:18px}
.tabs{display:flex;border-bottom:2px solid #eee;margin-bottom:16px}
.tab{flex:1;padding:10px;text-align:center;cursor:pointer;font-size:.9rem;color:#888}
.tab.active{color:#0e7c7b;border-bottom:2px solid #0e7c7b;margin-bottom:-2px;font-weight:600}
.panel{display:none}.panel.active{display:block}
label{display:block;font-size:.8rem;font-weight:600;color:#444;margin:12px 0 6px}
input,select{width:100%;padding:11px 13px;border:1.5px solid #ddd;border-radius:8px;font-size:.95rem;outline:none}
input:focus,select:focus{border-color:#0e7c7b}
.plans{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
.plan{padding:10px;border:1.5px solid #ddd;border-radius:8px;cursor:pointer;text-align:center;font-size:.85rem}
.plan.selected{border-color:#0e7c7b;background:#e6f5f5}
.plan b{display:block;font-size:1rem;color:#0e7c7b}
button{width:100%;margin-top:14px;padding:12px;background:#0e7c7b;color:#fff;border:0;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer}
button:disabled{opacity:.5;cursor:wait}
.status{margin-top:10px;padding:9px;border-radius:6px;font-size:.85rem;text-align:center;display:none}
.status.show{display:block}.status.ok{background:#e6f5f5;color:#0e7c7b}.status.err{background:#fde0e0;color:#c33}.status.info{background:#fef6e0;color:#a66}
.foot{text-align:center;margin-top:12px;font-size:.7rem;color:#aaa}
</style></head><body>
<div class="card">
<h1>${brand} WiFi</h1><p class="tag">Fast. Reliable. Affordable.</p>
<div class="tabs">
<div class="tab active" data-t="mpesa">M-Pesa</div>
<div class="tab" data-t="voucher">Voucher</div>
</div>
<div class="panel active" id="p-mpesa">
<label>Choose plan</label>
<div class="plans" id="plans"></div>
<label>M-Pesa phone (07xx or 2547xx)</label>
<input id="phone" type="tel" placeholder="0712345678"/>
<button id="payBtn">Pay with M-Pesa</button>
<div class="status" id="payStatus"></div>
</div>
<div class="panel" id="p-voucher">
<form name="login" action="$(link-login-only)" method="post">
<input type="hidden" name="dst" value="$(link-orig)"/>
<input type="hidden" name="popup" value="true"/>
<label>Username</label><input name="username" type="text" placeholder="PING-XXXX"/>
<label>Password</label><input name="password" type="password"/>
<button type="submit">Connect</button>
</form>
<div class="status err show" id="hsErr" style="display:none"></div>
</div>
<p class="foot">$(if chap-id)<input type="hidden" name="chap-id" value="$(chap-id)"/><input type="hidden" name="chap-challenge" value="$(chap-challenge)"/>$(endif)Powered by Ping</p>
</div>
<script>
var BACKEND="${backend}";
var DEVICE_ID="${deviceId}";
var LINK_LOGIN="$(link-login-only)";
var LINK_ORIG="$(link-orig)";
var ERR="$(error)";
if(ERR&&ERR.length&&ERR.charAt(0)!=="$"){var e=document.getElementById("hsErr");e.textContent=ERR;e.style.display="block"}
document.querySelectorAll(".tab").forEach(function(t){t.onclick=function(){document.querySelectorAll(".tab").forEach(function(x){x.classList.remove("active")});document.querySelectorAll(".panel").forEach(function(x){x.classList.remove("active")});t.classList.add("active");document.getElementById("p-"+t.dataset.t).classList.add("active")}});
var selPlan=null;
function setStatus(id,msg,cls){var el=document.getElementById(id);el.textContent=msg;el.className="status show "+cls}
fetch(BACKEND+"/plans?device_id="+DEVICE_ID).then(function(r){return r.json()}).then(function(j){
  var box=document.getElementById("plans");
  (j.plans||[]).forEach(function(p){
    var d=document.createElement("div");d.className="plan";d.innerHTML="<b>KES "+p.price_kes+"</b>"+p.name;
    d.onclick=function(){document.querySelectorAll(".plan").forEach(function(x){x.classList.remove("selected")});d.classList.add("selected");selPlan=p};
    box.appendChild(d);
  });
  if((j.plans||[]).length===0){box.innerHTML='<div style="grid-column:1/-1;font-size:.8rem;color:#888;padding:8px">No plans set up yet. Ask the operator to add one in Ping.</div>'}
}).catch(function(){setStatus("payStatus","Could not load plans (walled garden?)","err")});
document.getElementById("payBtn").onclick=function(){
  var phone=document.getElementById("phone").value.trim();
  if(!selPlan){return setStatus("payStatus","Pick a plan first","err")}
  if(!/^(07|2547)\\d{8}$/.test(phone.replace(/\\s/g,""))){return setStatus("payStatus","Enter a valid M-Pesa number","err")}
  var btn=this;btn.disabled=true;btn.textContent="Sending STK…";
  setStatus("payStatus","Check your phone for the M-Pesa prompt…","info");
  fetch(BACKEND+"/pay",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({device_id:DEVICE_ID,plan_id:selPlan.id,phone:phone})})
   .then(function(r){return r.json()}).then(function(j){
    if(!j.subscription_id){throw new Error(j.error||"failed")}
    pollPay(j.subscription_id,btn);
   }).catch(function(e){setStatus("payStatus",e.message||"Payment failed","err");btn.disabled=false;btn.textContent="Pay with M-Pesa"});
};
function pollPay(sid,btn){
  var n=0,maxN=40;
  var iv=setInterval(function(){
    n++;
    fetch(BACKEND+"/status?subscription_id="+sid).then(function(r){return r.json()}).then(function(j){
      if(j.status==="active"&&j.username){
        clearInterval(iv);setStatus("payStatus","Payment received — logging you in…","ok");
        var f=document.createElement("form");f.method="post";f.action=LINK_LOGIN;
        [["username",j.username],["password",j.password],["dst",LINK_ORIG||"http://neverssl.com"]].forEach(function(kv){var i=document.createElement("input");i.type="hidden";i.name=kv[0];i.value=kv[1];f.appendChild(i)});
        document.body.appendChild(f);f.submit();
      }else if(j.status==="failed"){clearInterval(iv);setStatus("payStatus","Payment failed. Try again.","err");btn.disabled=false;btn.textContent="Pay with M-Pesa"}
      else if(n>=maxN){clearInterval(iv);setStatus("payStatus","Timed out. If you paid, refresh in a minute.","err");btn.disabled=false;btn.textContent="Pay with M-Pesa"}
    }).catch(function(){});
  },3000);
}
</script></body></html>`;
}

// Served after MikroTik successfully authenticates. Simple status page.
function buildAloginHtml(brand: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${brand} — Connected</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0e7c7b;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}
.c{max-width:340px}h1{font-size:1.6rem;margin-bottom:8px}p{opacity:.9;font-size:.95rem;margin:6px 0}a{color:#fff;text-decoration:underline}</style></head>
<body><div class="c"><h1>You're online ✓</h1><p>Enjoy ${brand} WiFi.</p>
<p style="font-size:.8rem;opacity:.7">If your page doesn't redirect automatically, <a href="$(link-orig)">tap here</a>.</p>
<script>setTimeout(function(){location.href="$(link-orig)"||"http://neverssl.com"},2000)</script>
</div></body></html>`;
}

function buildPlan(p: Params, deviceName: string, deviceId: string, backendUrl: string, brand: string) {
  const wg = p.payment_walled_garden.length
    ? p.payment_walled_garden
    : ["*.safaricom.co.ke", "*.safaricom.com", "*.mpesa.com", "*.gstatic.com", "*.apple.com"];

  // Pesapal callbacks live on the Supabase functions host — add it to the
  // walled garden so unauthenticated devices can talk to /captive-portal-pay
  // and /pesapal-ipn before they're logged in.
  const backendHost = new URL(backendUrl).host;
  if (!wg.includes(backendHost)) wg.push(backendHost);
  for (const extra of ["pay.pesapal.com", "cybqa.pesapal.com", "captive.apple.com", "connectivitycheck.gstatic.com"]) {
    if (!wg.includes(extra)) wg.push(extra);
  }

  const htmlDir = "hotspot";
  const loginHtml = buildLoginHtml({ backend: backendUrl, deviceId, brand });
  const aloginHtml = buildAloginHtml(brand);

  return {
    summary: `Hotspot setup for ${deviceName} on ${p.hotspot_interface} (${p.network}). Creates pool, profile, server, walled garden (${wg.length} entries), voucher profile "${p.voucher_user_profile}", and uploads the Pesapal + voucher captive portal.`,
    backup_name: "",
    steps: [
      {
        id: "preflight",
        title: "Preflight checks",
        description: "Verify the interface exists and the network is not already configured.",
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
        rollback_commands: [`/ip address remove [find comment="ping-hotspot"]`],
      },
      {
        id: "pool",
        title: "Create DHCP pool",
        description: `Range ${p.pool_range} for hotspot clients.`,
        kind: "write",
        requires_confirm: true,
        commands: [`/ip pool add name=ping-hs-pool ranges=${p.pool_range}`],
        rollback_commands: [`/ip pool remove [find name=ping-hs-pool]`],
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
        description: `Profile "${p.hotspot_profile_name}" with login methods http-chap, http-pap, mac-cookie.`,
        kind: "write",
        requires_confirm: true,
        commands: [
          `/ip hotspot profile add name=${p.hotspot_profile_name} hotspot-address=${p.gateway_ip} dns-name=${p.dns_name} html-directory=${htmlDir} login-by=http-chap,http-pap,mac-cookie http-cookie-lifetime=1d`,
        ],
        rollback_commands: [`/ip hotspot profile remove [find name=${p.hotspot_profile_name}]`],
      },
      {
        id: "server",
        title: "Create hotspot server",
        description: "Activate hotspot on the interface using the profile and pool.",
        kind: "write",
        requires_confirm: true,
        commands: [
          `/ip hotspot add name=ping-hs interface=${p.hotspot_interface} profile=${p.hotspot_profile_name} address-pool=ping-hs-pool disabled=no idle-timeout=5m`,
        ],
        rollback_commands: [`/ip hotspot remove [find name=ping-hs]`],
      },
      {
        id: "user-profile",
        title: "Create voucher user profile",
        description: `"${p.voucher_user_profile}" — ${p.rate_limit}, ${p.session_timeout}.`,
        kind: "write",
        requires_confirm: true,
        commands: [
          `/ip hotspot user profile add name=${p.voucher_user_profile} rate-limit=${p.rate_limit} session-timeout=${p.session_timeout} shared-users=1`,
        ],
        rollback_commands: [`/ip hotspot user profile remove [find name=${p.voucher_user_profile}]`],
      },
      {
        id: "walled-garden",
        title: "Add walled garden entries",
        description: `Allow ${wg.length} hosts pre-login (M-Pesa, Pesapal, Ping backend, captive-portal probes).`,
        kind: "write",
        requires_confirm: true,
        commands: wg.map(d => `/ip hotspot walled-garden add dst-host=${d} action=allow comment="ping-wg"`),
        rollback_commands: [`/ip hotspot walled-garden remove [find comment="ping-wg"]`],
      },
      {
        id: "portal-files",
        title: "Upload captive portal files",
        description: "Writes login.html + alogin.html to /flash/hotspot/. These render the Pesapal + voucher login page that actually logs users in.",
        kind: "write",
        requires_confirm: true,
        commands: [
          `/file remove [find name="${htmlDir}/login.html"]`,
          `/file remove [find name="${htmlDir}/alogin.html"]`,
          `/file add name="${htmlDir}/login.html" contents="${rosEscape(loginHtml)}"`,
          `/file add name="${htmlDir}/alogin.html" contents="${rosEscape(aloginHtml)}"`,
        ],
        rollback_commands: [
          `/file remove [find name="${htmlDir}/login.html"]`,
          `/file remove [find name="${htmlDir}/alogin.html"]`,
        ],
      },
      {
        id: "verify",
        title: "Verify",
        description: "Read back the created hotspot, profile, walled-garden count, and uploaded files.",
        kind: "read",
        requires_confirm: false,
        commands: [
          `/ip hotspot print`,
          `/ip hotspot profile print where name=${p.hotspot_profile_name}`,
          `/ip hotspot walled-garden print count-only where comment="ping-wg"`,
          `/file print where name~"${htmlDir}/"`,
        ],
        rollback_commands: [],
      },
    ],
    full_rollback_commands: [
      `/file remove [find name="${htmlDir}/login.html"]`,
      `/file remove [find name="${htmlDir}/alogin.html"]`,
      `/ip hotspot walled-garden remove [find comment="ping-wg"]`,
      `/ip hotspot remove [find name=ping-hs]`,
      `/ip hotspot user profile remove [find name=${p.voucher_user_profile}]`,
      `/ip hotspot profile remove [find name=${p.hotspot_profile_name}]`,
      `/ip dhcp-server network remove [find address=${p.network}]`,
      `/ip dhcp-server remove [find name=ping-hs-dhcp]`,
      `/ip pool remove [find name=ping-hs-pool]`,
      `/ip address remove [find comment="ping-hotspot"]`,
    ],
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
    const deviceId: string = body.device_id || "";

    if (!params?.hotspot_interface || !params?.network || !params?.gateway_ip) {
      return new Response(JSON.stringify({ error: "Missing required params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Backend URL the portal will hit. captive-portal-pay handles /pay, /status, /plans.
    const backendUrl = `${SUPABASE_URL}/functions/v1/captive-portal-pay`;

    // Use brand from app_settings if present, else "Ping".
    let brand = "Ping";
    try {
      const { data: settings } = await c.from("app_settings").select("business_name").eq("user_id", claims.claims.sub).maybeSingle();
      if (settings?.business_name) brand = String(settings.business_name).replace(/"/g, "");
    } catch (_) { /* ignore */ }

    const plan = buildPlan(params, deviceName, deviceId, backendUrl, brand);

    let aiNotes = "";
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are Ping, a MikroTik expert. In <80 words, write a brief operator note explaining what this hotspot setup will do and what to watch for. No markdown." },
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

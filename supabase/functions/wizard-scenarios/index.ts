// Unified scenario plan builder. Returns the same shape as wizard-hotspot:
// { summary, backup_name, steps[], full_rollback_commands[], ai_notes? }
//
// Each scenario is a small pure function that takes params and returns
// { steps, full_rollback_commands }. The HTTP handler dispatches on `scenario`.
//
// Scenarios are intentionally additive — the agent connection is never reset.
// No /system backup, no /system reset-configuration, no /ip service disable ssh.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { lintRouterOSScript } from "../_shared/ros-lint.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Step = {
  id: string;
  title: string;
  description: string;
  kind: "read" | "write";
  requires_confirm: boolean;
  commands: string[];
  rollback_commands: string[];
};
type Plan = { summary: string; backup_name: string; steps: Step[]; full_rollback_commands: string[] };

// ───────────────────────── helpers ─────────────────────────

const cidrPrefix = (network: string) => network.split("/")[1] || "24";

// ───────────────────────── NAT only ─────────────────────────
function natOnly(p: { wan_interface: string; lan_interface: string; lan_network: string; lan_gateway: string; pool_range: string; dns_servers: string }): Plan {
  const prefix = cidrPrefix(p.lan_network);
  return {
    summary: `Basic NAT gateway: ${p.wan_interface} (DHCP client) → ${p.lan_interface} (${p.lan_network}, DHCP server, masquerade).`,
    backup_name: "",
    steps: [
      {
        id: "wan-dhcp", title: "DHCP client on WAN", description: `Get an address on ${p.wan_interface}.`,
        kind: "write", requires_confirm: true,
        commands: [`:do { /ip dhcp-client add interface=${p.wan_interface} disabled=no comment="ping-nat-wan" } on-error={}`],
        rollback_commands: [`/ip dhcp-client remove [find comment="ping-nat-wan"]`],
      },
      {
        id: "lan-addr", title: "Assign LAN gateway IP", description: `Add ${p.lan_gateway}/${prefix} to ${p.lan_interface}.`,
        kind: "write", requires_confirm: true,
        commands: [`/ip address add address=${p.lan_gateway}/${prefix} interface=${p.lan_interface} comment="ping-nat-lan"`],
        rollback_commands: [`/ip address remove [find comment="ping-nat-lan"]`],
      },
      {
        id: "lan-pool", title: "DHCP pool + server on LAN", description: `Hand out ${p.pool_range} on ${p.lan_interface}.`,
        kind: "write", requires_confirm: true,
        commands: [
          `/ip pool add name=ping-nat-pool ranges=${p.pool_range}`,
          `/ip dhcp-server add name=ping-nat-dhcp interface=${p.lan_interface} address-pool=ping-nat-pool lease-time=1h disabled=no`,
          `/ip dhcp-server network add address=${p.lan_network} gateway=${p.lan_gateway} dns-server=${p.dns_servers} comment="ping-nat-lan"`,
        ],
        rollback_commands: [
          `/ip dhcp-server network remove [find comment="ping-nat-lan"]`,
          `/ip dhcp-server remove [find name=ping-nat-dhcp]`,
          `/ip pool remove [find name=ping-nat-pool]`,
        ],
      },
      {
        id: "masq", title: "NAT masquerade", description: `Source-NAT outbound traffic out ${p.wan_interface}.`,
        kind: "write", requires_confirm: true,
        commands: [`/ip firewall nat add chain=srcnat action=masquerade out-interface=${p.wan_interface} comment="ping-nat-masq"`],
        rollback_commands: [`/ip firewall nat remove [find comment="ping-nat-masq"]`],
      },
      {
        id: "dns", title: "Enable DNS recursion", description: `Set DNS servers ${p.dns_servers} and allow LAN clients to query.`,
        kind: "write", requires_confirm: true,
        commands: [`/ip dns set servers=${p.dns_servers} allow-remote-requests=yes`],
        rollback_commands: [],
      },
    ],
    full_rollback_commands: [
      `/ip firewall nat remove [find comment="ping-nat-masq"]`,
      `/ip dhcp-server network remove [find comment="ping-nat-lan"]`,
      `/ip dhcp-server remove [find name=ping-nat-dhcp]`,
      `/ip pool remove [find name=ping-nat-pool]`,
      `/ip address remove [find comment="ping-nat-lan"]`,
      `/ip dhcp-client remove [find comment="ping-nat-wan"]`,
    ],
  };
}

// ───────────────────────── Bridge only ─────────────────────────
function bridgeOnly(p: { bridge_name: string; ports: string[]; vlan_filtering: boolean }): Plan {
  return {
    summary: `Create bridge "${p.bridge_name}" with ports: ${p.ports.join(", ")}${p.vlan_filtering ? " (vlan-filtering on)" : ""}.`,
    backup_name: "",
    steps: [
      {
        id: "bridge", title: "Create bridge", description: `Add /interface bridge named ${p.bridge_name}.`,
        kind: "write", requires_confirm: true,
        commands: [`/interface bridge add name=${p.bridge_name} vlan-filtering=${p.vlan_filtering ? "yes" : "no"} comment="ping-bridge"`],
        rollback_commands: [`/interface bridge remove [find name=${p.bridge_name}]`],
      },
      {
        id: "ports", title: "Add bridge ports", description: `Attach ${p.ports.length} ports.`,
        kind: "write", requires_confirm: true,
        commands: p.ports.map(port => `:do { /interface bridge port add bridge=${p.bridge_name} interface=${port} comment="ping-bridge" } on-error={}`),
        rollback_commands: [`/interface bridge port remove [find comment="ping-bridge"]`],
      },
    ],
    full_rollback_commands: [
      `/interface bridge port remove [find comment="ping-bridge"]`,
      `/interface bridge remove [find name=${p.bridge_name}]`,
    ],
  };
}

// ───────────────────────── Wireless only ─────────────────────────
function wirelessOnly(p: { radio: string; ssid: string; band: string; security: "open" | "wpa2-psk" | "wpa3-psk"; passphrase?: string; country?: string }): Plan {
  // Try wifiwave2 first (ROS7), fall back to legacy /interface wireless.
  const secProfile = `ping-${p.ssid.replace(/[^A-Za-z0-9]/g, "")}`;
  const wifiwave2Cmds: string[] = [
    `:do { /interface wifi security add name=${secProfile} authentication-types=${p.security === "open" ? "" : p.security === "wpa3-psk" ? "wpa3-psk" : "wpa2-psk"}${p.security !== "open" && p.passphrase ? ` passphrase="${p.passphrase}"` : ""} } on-error={}`,
    `:do { /interface wifi configuration add name=${secProfile}-cfg ssid="${p.ssid}" security=${secProfile}${p.country ? ` country="${p.country}"` : ""} } on-error={}`,
    `:do { /interface wifi set [find default-name=${p.radio}] configuration=${secProfile}-cfg disabled=no } on-error={ :log warning "ping: wifiwave2 not present, trying legacy" }`,
  ];
  const legacyCmds: string[] = [
    `:do { /interface wireless security-profiles add name=${secProfile} mode=${p.security === "open" ? "none" : "dynamic-keys"} authentication-types=${p.security === "wpa3-psk" ? "wpa2-psk" : (p.security === "open" ? "" : "wpa2-psk")}${p.security !== "open" && p.passphrase ? ` wpa2-pre-shared-key="${p.passphrase}"` : ""} } on-error={}`,
    `:do { /interface wireless set [find default-name=${p.radio}] ssid="${p.ssid}" security-profile=${secProfile} band=${p.band} disabled=no${p.country ? ` country="${p.country}"` : ""} } on-error={}`,
  ];
  return {
    summary: `Configure ${p.radio}: SSID "${p.ssid}", ${p.security}${p.security !== "open" ? ` (passphrase set)` : ""}, band ${p.band}.`,
    backup_name: "",
    steps: [
      {
        id: "wifi-detect", title: "Detect wireless stack", description: "Check if wifiwave2 (ROS7) or legacy /interface wireless is present.",
        kind: "read", requires_confirm: false,
        commands: [`:do { /interface wifi print } on-error={ /interface wireless print }`],
        rollback_commands: [],
      },
      {
        id: "wifi-config", title: "Apply SSID + security (wifiwave2)", description: "Configure on ROS7 wifiwave2 stack.",
        kind: "write", requires_confirm: true,
        commands: wifiwave2Cmds,
        rollback_commands: [
          `:do { /interface wifi configuration remove [find name=${secProfile}-cfg] } on-error={}`,
          `:do { /interface wifi security remove [find name=${secProfile}] } on-error={}`,
        ],
      },
      {
        id: "wifi-legacy", title: "Apply SSID + security (legacy fallback)", description: "Configure on legacy /interface wireless stack if wifiwave2 not present.",
        kind: "write", requires_confirm: true,
        commands: legacyCmds,
        rollback_commands: [`:do { /interface wireless security-profiles remove [find name=${secProfile}] } on-error={}`],
      },
    ],
    full_rollback_commands: [
      `:do { /interface wifi configuration remove [find name=${secProfile}-cfg] } on-error={}`,
      `:do { /interface wifi security remove [find name=${secProfile}] } on-error={}`,
      `:do { /interface wireless security-profiles remove [find name=${secProfile}] } on-error={}`,
    ],
  };
}

// ───────────────────────── PPPoE client ─────────────────────────
function pppoeClient(p: { wan_interface: string; user: string; password: string; service_name?: string }): Plan {
  return {
    summary: `PPPoE client on ${p.wan_interface} (user ${p.user}).`,
    backup_name: "",
    steps: [
      {
        id: "pppoe", title: "Create PPPoE client", description: `Dial PPPoE on ${p.wan_interface} as ${p.user}.`,
        kind: "write", requires_confirm: true,
        commands: [`/interface pppoe-client add name=ping-pppoe interface=${p.wan_interface} user="${p.user}" password="${p.password}"${p.service_name ? ` service-name="${p.service_name}"` : ""} use-peer-dns=yes add-default-route=yes disabled=no comment="ping-pppoe"`],
        rollback_commands: [`/interface pppoe-client remove [find comment="ping-pppoe"]`],
      },
      {
        id: "nat", title: "NAT masquerade out PPPoE", description: "SNAT clients via ping-pppoe.",
        kind: "write", requires_confirm: true,
        commands: [`/ip firewall nat add chain=srcnat action=masquerade out-interface=ping-pppoe comment="ping-pppoe-nat"`],
        rollback_commands: [`/ip firewall nat remove [find comment="ping-pppoe-nat"]`],
      },
    ],
    full_rollback_commands: [
      `/ip firewall nat remove [find comment="ping-pppoe-nat"]`,
      `/interface pppoe-client remove [find comment="ping-pppoe"]`,
    ],
  };
}

// ───────────────────────── PPPoE server ─────────────────────────
function pppoeServer(p: { listen_interface: string; local_ip: string; pool_range: string; profile_name: string; rate_limit: string }): Plan {
  return {
    summary: `PPPoE server on ${p.listen_interface}, profile "${p.profile_name}", pool ${p.pool_range}.`,
    backup_name: "",
    steps: [
      {
        id: "pool", title: "PPPoE address pool", description: `Range ${p.pool_range}.`,
        kind: "write", requires_confirm: true,
        commands: [`/ip pool add name=ping-ppp-pool ranges=${p.pool_range}`],
        rollback_commands: [`/ip pool remove [find name=ping-ppp-pool]`],
      },
      {
        id: "profile", title: "PPP profile", description: `${p.rate_limit} rate limit, local-address ${p.local_ip}.`,
        kind: "write", requires_confirm: true,
        commands: [`/ppp profile add name=${p.profile_name} local-address=${p.local_ip} remote-address=ping-ppp-pool rate-limit=${p.rate_limit} only-one=yes`],
        rollback_commands: [`/ppp profile remove [find name=${p.profile_name}]`],
      },
      {
        id: "server", title: "PPPoE server", description: `Listen on ${p.listen_interface}.`,
        kind: "write", requires_confirm: true,
        commands: [`/interface pppoe-server server add service-name=ping-pppoe interface=${p.listen_interface} default-profile=${p.profile_name} authentication=pap,chap,mschap1,mschap2 disabled=no`],
        rollback_commands: [`/interface pppoe-server server remove [find service-name=ping-pppoe]`],
      },
    ],
    full_rollback_commands: [
      `/interface pppoe-server server remove [find service-name=ping-pppoe]`,
      `/ppp profile remove [find name=${p.profile_name}]`,
      `/ip pool remove [find name=ping-ppp-pool]`,
    ],
  };
}

// ───────────────────────── RADIUS ─────────────────────────
function radiusClient(p: { server_ip: string; secret: string; services: string[] }): Plan {
  return {
    summary: `RADIUS client → ${p.server_ip}, services: ${p.services.join(",")}.`,
    backup_name: "",
    steps: [
      {
        id: "radius", title: "Add RADIUS server", description: `Secret hidden. Services: ${p.services.join(",")}.`,
        kind: "write", requires_confirm: true,
        commands: [
          `/radius add address=${p.server_ip} secret="${p.secret}" service=${p.services.join(",")} comment="ping-radius"`,
          `/radius incoming set accept=yes`,
        ],
        rollback_commands: [`/radius remove [find comment="ping-radius"]`],
      },
      ...p.services.map(svc => ({
        id: `use-${svc}`, title: `Enable RADIUS on ${svc}`, description: `Set use-radius=yes on ${svc} AAA.`,
        kind: "write" as const, requires_confirm: true,
        commands: svc === "ppp"
          ? [`/ppp aaa set use-radius=yes`]
          : svc === "hotspot"
            ? [`/ip hotspot profile set [find ] use-radius=yes`]
            : [`/user aaa set use-radius=yes`],
        rollback_commands: svc === "ppp"
          ? [`/ppp aaa set use-radius=no`]
          : svc === "hotspot"
            ? [`/ip hotspot profile set [find ] use-radius=no`]
            : [`/user aaa set use-radius=no`],
      })),
    ],
    full_rollback_commands: [`/radius remove [find comment="ping-radius"]`],
  };
}

// ───────────────────────── VLAN ─────────────────────────
function vlanTrunk(p: { bridge_name: string; trunk_ports: string[]; vlans: { id: number; name: string; access_ports: string[] }[] }): Plan {
  const steps: Step[] = [
    {
      id: "vlan-filtering", title: "Enable vlan-filtering on bridge", description: `Turn on vlan-filtering for ${p.bridge_name}.`,
      kind: "write", requires_confirm: true,
      commands: [`/interface bridge set [find name=${p.bridge_name}] vlan-filtering=yes`],
      rollback_commands: [`/interface bridge set [find name=${p.bridge_name}] vlan-filtering=no`],
    },
  ];
  p.vlans.forEach(v => {
    steps.push({
      id: `vlan-${v.id}`, title: `VLAN ${v.id} (${v.name})`, description: `Tagged on trunk(s), untagged on ${v.access_ports.join(",")}.`,
      kind: "write", requires_confirm: true,
      commands: [
        `:do { /interface vlan add name=${v.name} vlan-id=${v.id} interface=${p.bridge_name} comment="ping-vlan" } on-error={}`,
        `:do { /interface bridge vlan add bridge=${p.bridge_name} vlan-ids=${v.id} tagged=${p.trunk_ports.join(",")} untagged=${v.access_ports.join(",")} comment="ping-vlan" } on-error={}`,
        ...v.access_ports.map(ap => `:do { /interface bridge port set [find interface=${ap}] pvid=${v.id} } on-error={}`),
      ],
      rollback_commands: [
        `/interface bridge vlan remove [find vlan-ids=${v.id}]`,
        `/interface vlan remove [find name=${v.name}]`,
      ],
    });
  });
  return {
    summary: `Configure ${p.vlans.length} VLAN(s) on bridge ${p.bridge_name} with trunk ports ${p.trunk_ports.join(",")}.`,
    backup_name: "",
    steps,
    full_rollback_commands: [
      `/interface bridge vlan remove [find comment="ping-vlan"]`,
      `/interface vlan remove [find comment="ping-vlan"]`,
    ],
  };
}

// ───────────────────────── DHCP server on existing iface ─────────────────────────
function dhcpServer(p: { interface: string; network: string; gateway: string; pool_range: string; dns_servers: string }): Plan {
  return {
    summary: `DHCP server on ${p.interface} for ${p.network}.`,
    backup_name: "",
    steps: [
      {
        id: "pool", title: "Pool + server", description: `${p.pool_range} via ${p.interface}.`,
        kind: "write", requires_confirm: true,
        commands: [
          `/ip pool add name=ping-dhcp-pool ranges=${p.pool_range}`,
          `/ip dhcp-server add name=ping-dhcp interface=${p.interface} address-pool=ping-dhcp-pool lease-time=1h disabled=no`,
          `/ip dhcp-server network add address=${p.network} gateway=${p.gateway} dns-server=${p.dns_servers} comment="ping-dhcp"`,
        ],
        rollback_commands: [
          `/ip dhcp-server network remove [find comment="ping-dhcp"]`,
          `/ip dhcp-server remove [find name=ping-dhcp]`,
          `/ip pool remove [find name=ping-dhcp-pool]`,
        ],
      },
    ],
    full_rollback_commands: [
      `/ip dhcp-server network remove [find comment="ping-dhcp"]`,
      `/ip dhcp-server remove [find name=ping-dhcp]`,
      `/ip pool remove [find name=ping-dhcp-pool]`,
    ],
  };
}

// ───────────────────────── Firewall hardening ─────────────────────────
function firewallBaseline(p: { wan_interface: string }): Plan {
  return {
    summary: `Baseline firewall: drop invalid, accept established/related, drop input from ${p.wan_interface}, fasttrack.`,
    backup_name: "",
    steps: [
      {
        id: "filter", title: "Input/forward baseline", description: "Conntrack-based accept + drop from WAN.",
        kind: "write", requires_confirm: true,
        commands: [
          `/ip firewall filter add chain=input action=accept connection-state=established,related comment="ping-fw"`,
          `/ip firewall filter add chain=input action=drop connection-state=invalid comment="ping-fw"`,
          `/ip firewall filter add chain=input action=accept protocol=icmp comment="ping-fw"`,
          `/ip firewall filter add chain=input action=drop in-interface=${p.wan_interface} comment="ping-fw"`,
          `/ip firewall filter add chain=forward action=fasttrack-connection connection-state=established,related comment="ping-fw"`,
          `/ip firewall filter add chain=forward action=accept connection-state=established,related comment="ping-fw"`,
          `/ip firewall filter add chain=forward action=drop connection-state=invalid comment="ping-fw"`,
          `/ip firewall filter add chain=forward action=drop in-interface=${p.wan_interface} connection-nat-state=!dstnat comment="ping-fw"`,
        ],
        rollback_commands: [`/ip firewall filter remove [find comment="ping-fw"]`],
      },
    ],
    full_rollback_commands: [`/ip firewall filter remove [find comment="ping-fw"]`],
  };
}

// ───────────────────────── WireGuard ─────────────────────────
function wireguardServer(p: { listen_port: number; address: string; peers: { public_key: string; allowed_ips: string }[] }): Plan {
  return {
    summary: `WireGuard server on UDP ${p.listen_port}, ${p.peers.length} peer(s).`,
    backup_name: "",
    steps: [
      {
        id: "iface", title: "Create wg interface", description: `Listen ${p.listen_port}, address ${p.address}.`,
        kind: "write", requires_confirm: true,
        commands: [
          `/interface wireguard add name=ping-wg listen-port=${p.listen_port} comment="ping-wg"`,
          `/ip address add address=${p.address} interface=ping-wg comment="ping-wg"`,
          `/ip firewall filter add chain=input action=accept protocol=udp dst-port=${p.listen_port} comment="ping-wg" place-before=0`,
        ],
        rollback_commands: [
          `/ip firewall filter remove [find comment="ping-wg"]`,
          `/ip address remove [find comment="ping-wg"]`,
          `/interface wireguard remove [find name=ping-wg]`,
        ],
      },
      {
        id: "peers", title: "Add peers", description: `${p.peers.length} peer(s).`,
        kind: "write", requires_confirm: true,
        commands: p.peers.map(peer => `/interface wireguard peers add interface=ping-wg public-key="${peer.public_key}" allowed-address=${peer.allowed_ips} comment="ping-wg"`),
        rollback_commands: [`/interface wireguard peers remove [find comment="ping-wg"]`],
      },
    ],
    full_rollback_commands: [
      `/interface wireguard peers remove [find comment="ping-wg"]`,
      `/ip firewall filter remove [find comment="ping-wg"]`,
      `/ip address remove [find comment="ping-wg"]`,
      `/interface wireguard remove [find name=ping-wg]`,
    ],
  };
}

// ───────────────────────── Simple QoS ─────────────────────────
function simpleQos(p: { interface: string; max_upload: string; max_download: string }): Plan {
  return {
    summary: `Simple queue: ${p.interface} up ${p.max_upload}/down ${p.max_download}.`,
    backup_name: "",
    steps: [
      {
        id: "queue", title: "Add queue", description: `Total cap on ${p.interface}.`,
        kind: "write", requires_confirm: true,
        commands: [`/queue simple add name=ping-q target=${p.interface} max-limit=${p.max_upload}/${p.max_download} comment="ping-qos"`],
        rollback_commands: [`/queue simple remove [find comment="ping-qos"]`],
      },
    ],
    full_rollback_commands: [`/queue simple remove [find comment="ping-qos"]`],
  };
}

// ───────────────────────── NTP / DDNS / users ─────────────────────────
function ntpClient(p: { servers: string }): Plan {
  return {
    summary: `NTP client: ${p.servers}.`,
    backup_name: "",
    steps: [{
      id: "ntp", title: "Enable NTP client", description: "Sync clock from servers.",
      kind: "write", requires_confirm: true,
      commands: [`/system ntp client set enabled=yes servers=${p.servers}`],
      rollback_commands: [`/system ntp client set enabled=no`],
    }],
    full_rollback_commands: [`/system ntp client set enabled=no`],
  };
}
function ddns(): Plan {
  return {
    summary: "Enable MikroTik DDNS (IP Cloud).",
    backup_name: "",
    steps: [{
      id: "ddns", title: "Enable IP Cloud DDNS", description: "Free MikroTik DNS name.",
      kind: "write", requires_confirm: true,
      commands: [`/ip cloud set ddns-enabled=yes update-time=yes`],
      rollback_commands: [`/ip cloud set ddns-enabled=no`],
    }],
    full_rollback_commands: [`/ip cloud set ddns-enabled=no`],
  };
}

// ───────────────────────── Third-party provisioner ─────────────────────────
function thirdParty(p: { wan_interface: string; provisioner_script: string; provider?: string }): Plan {
  return {
    summary: `Third-party provisioner${p.provider ? ` (${p.provider})` : ""}: DHCP client on ${p.wan_interface} then run provided script verbatim.`,
    backup_name: "",
    steps: [
      {
        id: "wan", title: "DHCP client on WAN", description: `Bring ${p.wan_interface} up.`,
        kind: "write", requires_confirm: true,
        commands: [`:do { /ip dhcp-client add interface=${p.wan_interface} disabled=no comment="ping-tp-wan" } on-error={}`],
        rollback_commands: [`/ip dhcp-client remove [find comment="ping-tp-wan"]`],
      },
      {
        id: "provisioner", title: "Run third-party provisioner script", description: "Executes the operator-supplied script verbatim. Inspect before applying.",
        kind: "write", requires_confirm: true,
        commands: p.provisioner_script.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith("#")),
        rollback_commands: [`# Third-party provisioner has no auto-rollback. Restore from your pre-pairing backup if needed.`],
      },
    ],
    full_rollback_commands: [
      `# Provisioner rollback: restore your pre-pairing backup.`,
      `/ip dhcp-client remove [find comment="ping-tp-wan"]`,
    ],
  };
}

// ───────────────────────── dispatcher ─────────────────────────
const BUILDERS: Record<string, (p: any) => Plan> = {
  nat_only: natOnly,
  bridge_only: bridgeOnly,
  wireless_only: wirelessOnly,
  pppoe_client: pppoeClient,
  pppoe_server: pppoeServer,
  radius: radiusClient,
  vlan: vlanTrunk,
  dhcp_server: dhcpServer,
  firewall_baseline: firewallBaseline,
  wireguard_server: wireguardServer,
  qos_simple: simpleQos,
  ntp: ntpClient,
  ddns: () => ddns(),
  third_party: thirdParty,
};

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
    const scenario: string = body.scenario;
    const params = body.params || {};

    const builder = BUILDERS[scenario];
    if (!builder) {
      return new Response(JSON.stringify({ error: `Unknown scenario: ${scenario}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const plan = builder(params);

    // Lint the full script before returning so the UI can surface issues early.
    const fullScript = plan.steps.flatMap(s => s.commands).join("\n");
    let lintErrors: string[] = [];
    try {
      const r: any = lintRouterOSScript(fullScript);
      lintErrors = (r?.errors || []).map((e: any) => typeof e === "string" ? e : (e?.message || JSON.stringify(e)));
    } catch (_) { /* lint is advisory */ }

    return new Response(JSON.stringify({ ...plan, lint_errors: lintErrors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("wizard-scenarios error", e);
    return new Response(JSON.stringify({ error: e.message || "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Loader2, Check, AlertTriangle, Undo2, ShieldCheck, Eye, Pencil,
  Network, Cable, Radio, Lock, Boxes, Router, Server, Key, Layers, Filter,
  Shield, Gauge, Clock, Cloud, Wrench,
} from "lucide-react";
import { JobLog } from "./JobLog";

interface Props {
  device: { id: string; name: string; agent_id: string | null };
  onBack: () => void;
}

type ScenarioId =
  | "nat_only" | "bridge_only" | "wireless_only" | "pppoe_client" | "pppoe_server"
  | "radius" | "vlan" | "dhcp_server" | "firewall_baseline" | "wireguard_server"
  | "qos_simple" | "ntp" | "ddns" | "third_party";

interface ScenarioMeta {
  id: ScenarioId;
  label: string;
  blurb: string;
  icon: any;
  defaults: Record<string, any>;
}

const SCENARIOS: ScenarioMeta[] = [
  { id: "nat_only", label: "NAT gateway", blurb: "WAN DHCP client + LAN DHCP server + masquerade.", icon: Network,
    defaults: { wan_interface: "ether1", lan_interface: "ether2", lan_network: "192.168.88.0/24", lan_gateway: "192.168.88.1", pool_range: "192.168.88.10-192.168.88.254", dns_servers: "1.1.1.1,8.8.8.8" } },
  { id: "bridge_only", label: "Bridge ports", blurb: "Group selected ports into a single L2 bridge.", icon: Cable,
    defaults: { bridge_name: "bridge1", ports: "ether2,ether3,ether4,ether5", vlan_filtering: false } },
  { id: "wireless_only", label: "Wireless / SSID", blurb: "Set SSID, band, open or WPA2/WPA3.", icon: Radio,
    defaults: { radio: "wlan1", ssid: "MyWiFi", band: "2ghz-b/g/n", security: "wpa2-psk", passphrase: "", country: "kenya" } },
  { id: "pppoe_client", label: "PPPoE client (WAN)", blurb: "Dial PPPoE on a WAN port for upstream.", icon: Router,
    defaults: { wan_interface: "ether1", user: "", password: "", service_name: "" } },
  { id: "pppoe_server", label: "PPPoE server (ISP)", blurb: "Run PPPoE access concentrator with profile + pool.", icon: Server,
    defaults: { listen_interface: "ether2", local_ip: "10.10.0.1", pool_range: "10.10.0.2-10.10.0.254", profile_name: "ppp-default", rate_limit: "5M/5M" } },
  { id: "radius", label: "RADIUS client", blurb: "External AAA for hotspot, PPP, or login.", icon: Key,
    defaults: { server_ip: "10.0.0.10", secret: "", services: "ppp,hotspot" } },
  { id: "vlan", label: "VLAN trunk + access", blurb: "Tag/untag VLANs across bridge ports.", icon: Layers,
    defaults: { bridge_name: "bridge1", trunk_ports: "ether1", vlans: "10:mgmt:ether2;20:guest:ether3" } },
  { id: "dhcp_server", label: "DHCP server", blurb: "Add a DHCP server to an existing interface.", icon: Boxes,
    defaults: { interface: "ether2", network: "10.10.10.0/24", gateway: "10.10.10.1", pool_range: "10.10.10.10-10.10.10.254", dns_servers: "1.1.1.1,8.8.8.8" } },
  { id: "firewall_baseline", label: "Firewall baseline", blurb: "Conntrack, fasttrack, drop from WAN.", icon: Shield,
    defaults: { wan_interface: "ether1" } },
  { id: "wireguard_server", label: "WireGuard server", blurb: "VPN endpoint with paste-in peer keys.", icon: Lock,
    defaults: { listen_port: 51820, address: "10.222.0.1/24", peers: "" } },
  { id: "qos_simple", label: "Simple QoS", blurb: "Total upload/download cap on an interface.", icon: Gauge,
    defaults: { interface: "ether1", max_upload: "10M", max_download: "50M" } },
  { id: "ntp", label: "NTP client", blurb: "Sync the clock.", icon: Clock, defaults: { servers: "162.159.200.123,time.google.com" } },
  { id: "ddns", label: "MikroTik DDNS", blurb: "Enable IP Cloud DDNS name.", icon: Cloud, defaults: {} },
  { id: "third_party", label: "Third-party provisioner", blurb: "WAN up, then run a Centipid/Splynx/MikroWisp script verbatim.", icon: Wrench,
    defaults: { wan_interface: "ether1", provider: "centipid", provisioner_script: "" } },
];

// ---- Validation helpers --------------------------------------------------

const isIPv4 = (s: string) => {
  const t = String(s ?? "").trim();
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(t)) return false;
  return t.split(".").every((o) => Number(o) >= 0 && Number(o) <= 255);
};
const isCIDR = (s: string) => {
  const t = String(s ?? "").trim();
  const parts = t.split("/");
  if (parts.length !== 2) return false;
  const [ip, mask] = parts;
  return isIPv4(ip) && /^\d{1,2}$/.test(mask) && Number(mask) >= 0 && Number(mask) <= 32;
};
const isIPRange = (s: string) => {
  const parts = String(s ?? "").trim().split("-");
  if (parts.length !== 2) return false;
  return isIPv4(parts[0]) && isIPv4(parts[1]);
};
const isRate = (s: string) => /^\d+(\.\d+)?[kKmMgG]?$/.test(String(s ?? "").trim());
const isRatePair = (s: string) => {
  const parts = String(s ?? "").trim().split("/");
  return parts.length === 2 && parts.every(isRate);
};
const isPort = (s: string) => {
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
};
const nonEmpty = (s: any) => String(s ?? "").trim().length > 0;
const csvNonEmpty = (s: any) =>
  String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean).length > 0;

// Returns a map of field-key -> error message. Empty object means valid.
function validateParams(scenario: ScenarioId, params: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};
  const req = (key: string, label: string) => {
    if (!nonEmpty(params[key])) errors[key] = `${label} is required.`;
  };

  switch (scenario) {
    case "nat_only":
      req("wan_interface", "WAN interface");
      req("lan_interface", "LAN interface");
      if (!nonEmpty(params.lan_network)) errors.lan_network = "LAN network is required.";
      else if (!isCIDR(params.lan_network)) errors.lan_network = "Use CIDR format, e.g. 192.168.88.0/24.";
      if (!nonEmpty(params.lan_gateway)) errors.lan_gateway = "LAN gateway is required.";
      else if (!isIPv4(params.lan_gateway)) errors.lan_gateway = "Enter a valid IPv4 address.";
      if (!nonEmpty(params.pool_range)) errors.pool_range = "Pool range is required.";
      else if (!isIPRange(params.pool_range)) errors.pool_range = "Use format start-end, e.g. 192.168.88.10-192.168.88.254.";
      if (!csvNonEmpty(params.dns_servers)) errors.dns_servers = "At least one DNS server is required.";
      break;

    case "bridge_only":
      req("bridge_name", "Bridge name");
      if (!csvNonEmpty(params.ports)) errors.ports = "List at least one port.";
      break;

    case "wireless_only":
      req("radio", "Radio interface");
      req("ssid", "SSID");
      req("country", "Country");
      if (params.security && params.security !== "open") {
        if (!nonEmpty(params.passphrase)) errors.passphrase = "Passphrase is required for secured networks.";
        else if (String(params.passphrase).trim().length < 8) errors.passphrase = "WPA passphrases need at least 8 characters.";
      }
      break;

    case "pppoe_client":
      req("wan_interface", "WAN interface");
      req("user", "Username");
      req("password", "Password");
      break;

    case "pppoe_server":
      req("listen_interface", "Listen interface");
      if (!nonEmpty(params.local_ip)) errors.local_ip = "Server IP is required.";
      else if (!isIPv4(params.local_ip)) errors.local_ip = "Enter a valid IPv4 address.";
      if (!nonEmpty(params.pool_range)) errors.pool_range = "Pool range is required.";
      else if (!isIPRange(params.pool_range)) errors.pool_range = "Use format start-end.";
      req("profile_name", "Profile name");
      if (nonEmpty(params.rate_limit) && !isRatePair(params.rate_limit) && !isRate(params.rate_limit)) {
        errors.rate_limit = "Use rx/tx format, e.g. 5M/5M.";
      }
      break;

    case "radius":
      if (!nonEmpty(params.server_ip)) errors.server_ip = "RADIUS server IP is required.";
      else if (!isIPv4(params.server_ip)) errors.server_ip = "Enter a valid IPv4 address.";
      req("secret", "Shared secret");
      if (!csvNonEmpty(params.services)) errors.services = "Select at least one service.";
      break;

    case "vlan":
      req("bridge_name", "Bridge name");
      if (!csvNonEmpty(params.trunk_ports)) errors.trunk_ports = "List at least one trunk port.";
      if (!nonEmpty(params.vlans)) {
        errors.vlans = "Define at least one VLAN.";
      } else {
        const bad = String(params.vlans)
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .some((s) => {
            const [id] = s.split(":");
            const n = Number(id);
            return !Number.isInteger(n) || n < 1 || n > 4094;
          });
        if (bad) errors.vlans = "Each VLAN needs a numeric id 1-4094 (id:name:ports;…).";
      }
      break;

    case "dhcp_server":
      req("interface", "Interface");
      if (!nonEmpty(params.network)) errors.network = "Network is required.";
      else if (!isCIDR(params.network)) errors.network = "Use CIDR format, e.g. 10.10.10.0/24.";
      if (!nonEmpty(params.gateway)) errors.gateway = "Gateway is required.";
      else if (!isIPv4(params.gateway)) errors.gateway = "Enter a valid IPv4 address.";
      if (!nonEmpty(params.pool_range)) errors.pool_range = "Pool range is required.";
      else if (!isIPRange(params.pool_range)) errors.pool_range = "Use format start-end.";
      if (!csvNonEmpty(params.dns_servers)) errors.dns_servers = "At least one DNS server is required.";
      break;

    case "firewall_baseline":
      req("wan_interface", "WAN interface");
      break;

    case "wireguard_server":
      if (!nonEmpty(params.listen_port)) errors.listen_port = "Listen port is required.";
      else if (!isPort(String(params.listen_port))) errors.listen_port = "Enter a port between 1 and 65535.";
      if (!nonEmpty(params.address)) errors.address = "Tunnel address is required.";
      else if (!isCIDR(params.address)) errors.address = "Use CIDR format, e.g. 10.222.0.1/24.";
      if (nonEmpty(params.peers)) {
        const bad = String(params.peers)
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .some((line) => !line.split("|")[0]?.trim());
        if (bad) errors.peers = "Each peer needs a public key before the | separator.";
      }
      break;

    case "qos_simple":
      req("interface", "Interface");
      if (!nonEmpty(params.max_upload)) errors.max_upload = "Max upload is required.";
      else if (!isRate(params.max_upload)) errors.max_upload = "Use a value like 10M or 512k.";
      if (!nonEmpty(params.max_download)) errors.max_download = "Max download is required.";
      else if (!isRate(params.max_download)) errors.max_download = "Use a value like 50M or 1G.";
      break;

    case "ntp":
      if (!csvNonEmpty(params.servers)) errors.servers = "At least one NTP server is required.";
      break;

    case "ddns":
      break;

    case "third_party":
      req("wan_interface", "WAN interface");
      req("provider", "Provider tag");
      if (!nonEmpty(params.provisioner_script)) errors.provisioner_script = "Paste the provisioner script to run.";
      break;
  }

  return errors;
}

// ---------------------------------------------------------------------------

interface PlanStep {
  id: string; title: string; description: string;
  kind: "read" | "write"; requires_confirm: boolean;
  commands: string[]; rollback_commands: string[];
}
interface Plan {
  summary: string;
  steps: PlanStep[];
  full_rollback_commands: string[];
  lint_errors?: string[];
}

export const ScenarioBuilder = ({ device, onBack }: Props) => {
  const { toast } = useToast();
  const [phase, setPhase] = useState<"pick" | "params" | "review" | "running">("pick");
  const [selected, setSelected] = useState<ScenarioMeta | null>(null);
  const [params, setParams] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  const pick = (s: ScenarioMeta) => {
    setSelected(s);
    setParams({ ...s.defaults });
    setErrors({});
    setPhase("params");
  };

  const updateParam = (key: string, value: any) => {
    setParams((p) => ({ ...p, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const buildPlan = async () => {
    if (!selected) return;

    const validationErrors = validateParams(selected.id, params);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({
        title: "Check the highlighted fields",
        description: "Some required values are missing or invalid.",
        variant: "destructive",
      });
      return;
    }
    setErrors({});

    setLoading(true);
    // Normalize a few list/struct fields.
    const p: any = { ...params };
    // Trim stray whitespace on every string field — interface names, SSIDs,
    // and IPs all need to match exactly on the router.
    Object.keys(p).forEach((k) => {
      if (typeof p[k] === "string") p[k] = p[k].trim();
    });

    if (selected.id === "bridge_only") p.ports = String(p.ports || "").split(",").map((x: string) => x.trim()).filter(Boolean);
    if (selected.id === "vlan") {
      p.trunk_ports = String(p.trunk_ports || "").split(",").map((x: string) => x.trim()).filter(Boolean);
      p.vlans = String(p.vlans || "").split(";").map((s: string) => s.trim()).filter(Boolean).map((s: string) => {
        const [id, name, ports] = s.split(":");
        return { id: Number(id), name: name?.trim() || `vlan${id}`, access_ports: (ports || "").split(",").map(x => x.trim()).filter(Boolean) };
      });
    }
    if (selected.id === "radius") p.services = String(p.services || "").split(",").map((x: string) => x.trim()).filter(Boolean);
    if (selected.id === "wireguard_server") {
      p.listen_port = Number(p.listen_port);
      p.peers = String(p.peers || "").split("\n").map((line: string) => line.trim()).filter(Boolean).map((line: string) => {
        const [pk, ai] = line.split("|").map(x => x.trim());
        return { public_key: pk, allowed_ips: ai || "0.0.0.0/0" };
      });
    }

    const { data, error } = await supabase.functions.invoke("wizard-scenarios", {
      body: { scenario: selected.id, params: p },
    });
    setLoading(false);
    if (error || !data?.steps) {
      toast({ title: "Failed to build plan", description: error?.message, variant: "destructive" });
      return;
    }
    setPlan(data as Plan);
    if (data.lint_errors?.length) {
      toast({ title: "Lint warnings", description: data.lint_errors.slice(0, 3).join("\n"), variant: "destructive" });
    }
    setPhase("review");
  };

  const runPlan = async () => {
    if (!plan) return;
    const script = [
      `# Ping scenario: ${selected?.label} on ${device.name}`,
      ``,
      ...plan.steps.filter(s => s.kind === "write").flatMap(s => [`# === ${s.title} ===`, ...s.commands, ``]),
    ].join("\n");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("device-jobs", {
      body: { device_id: device.id, kind: "apply_script", script_content: script },
    });
    setLoading(false);
    if (error || !data?.job_id) {
      toast({ title: "Failed to enqueue", description: error?.message, variant: "destructive" });
      return;
    }
    if (data.warning) toast({ title: "Agent offline", description: data.warning, variant: "destructive" });
    setActiveJobId(data.job_id);
    setPhase("running");
  };

  if (phase === "running" && activeJobId) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <header className="flex-shrink-0 flex items-center gap-3 p-3 md:p-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1">
            <h1 className="text-base md:text-lg font-semibold">{selected?.label} · {device.name}</h1>
            <p className="text-[11px] md:text-xs text-muted-foreground">Live execution log</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          <div className="max-w-3xl mx-auto">
            <JobLog jobId={activeJobId} onClose={() => { setActiveJobId(null); setPhase("review"); }} />
            {plan && plan.full_rollback_commands.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-amber-500 mb-1">
                  <Undo2 className="w-3.5 h-3.5" /> Rollback
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={async () => {
                    const script = [`# Full rollback`, ...plan.full_rollback_commands].join("\n");
                    const { data, error } = await supabase.functions.invoke("device-jobs", {
                      body: { device_id: device.id, kind: "apply_script", script_content: script },
                    });
                    if (error || !data?.job_id) toast({ title: "Failed", variant: "destructive" });
                    else setActiveJobId(data.job_id);
                  }}>
                  Run rollback
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <header className="flex-shrink-0 flex items-center gap-3 p-3 md:p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => phase === "pick" ? onBack() : setPhase(phase === "review" ? "params" : "pick")} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base md:text-lg font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" /> Scenario builder
          </h1>
          <p className="text-[11px] md:text-xs text-muted-foreground truncate">{device.name}{selected ? ` · ${selected.label}` : ""}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {phase === "pick" && (
            <>
              <p className="text-xs text-muted-foreground">
                Pick the kind of configuration you want the agent to apply. Each scenario is additive — it
                won't reset the router or drop the agent's SSH session. For full hotspot setup with M-Pesa portal,
                use the dedicated Hotspot Wizard.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SCENARIOS.map(s => (
                  <button key={s.id} onClick={() => pick(s)}
                    className="text-left rounded-xl border border-border bg-card p-3 hover:border-primary/50 transition-colors">
                    <s.icon className="w-4 h-4 text-primary mb-2" />
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{s.blurb}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === "params" && selected && (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                <p className="font-medium">{selected.label}</p>
                <p className="text-muted-foreground">{selected.blurb}</p>
              </div>
              <div className="space-y-2">
                {Object.keys(selected.defaults).map(key => (
                  <Field key={key} label={prettyLabel(key, selected.id)} error={errors[key]}>
                    {isTextarea(key) ? (
                      <Textarea
                        value={String(params[key] ?? "")}
                        onChange={e => updateParam(key, e.target.value)}
                        rows={key === "provisioner_script" ? 10 : 4}
                        className={`font-mono text-xs ${errors[key] ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                        placeholder={placeholderFor(key, selected.id)}
                      />
                    ) : isBoolean(key) ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={!!params[key]} onChange={e => updateParam(key, e.target.checked)} />
                        Enable
                      </label>
                    ) : (
                      <input
                        value={String(params[key] ?? "")}
                        onChange={e => updateParam(key, e.target.value)}
                        placeholder={placeholderFor(key, selected.id)}
                        className={`${inp} ${errors[key] ? "border-destructive focus:ring-destructive/40" : ""}`}
                        type={key.includes("password") || key === "secret" || key === "passphrase" ? "password" : "text"}
                      />
                    )}
                  </Field>
                ))}
              </div>
              <Button onClick={buildPlan} disabled={loading} className="w-full">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building plan…</> : "Build plan"}
              </Button>
            </>
          )}

          {phase === "review" && plan && (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-primary mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Plan summary
                </div>
                <p className="text-muted-foreground">{plan.summary}</p>
                {plan.lint_errors && plan.lint_errors.length > 0 && (
                  <div className="mt-2 text-amber-500">
                    <p className="font-medium">Lint warnings:</p>
                    <ul className="list-disc ml-4">{plan.lint_errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {plan.steps.map((s, i) => (
                  <details key={s.id} className="rounded-lg border border-border bg-card p-3" open={s.kind === "write"}>
                    <summary className="flex items-center gap-2 cursor-pointer list-none">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0
                        ${s.kind === "write" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{s.title}</span>
                          <Badge variant={s.kind === "write" ? "default" : "secondary"} className="text-[10px] uppercase">
                            {s.kind === "write" ? <><Pencil className="w-2.5 h-2.5 mr-0.5" /> write</> : <><Eye className="w-2.5 h-2.5 mr-0.5" /> read</>}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{s.description}</p>
                      </div>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <pre className="text-[11px] font-mono bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                        {s.commands.join("\n")}
                      </pre>
                      {s.rollback_commands.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground mb-1 flex items-center gap-1">
                            <Undo2 className="w-3 h-3" /> Rollback
                          </p>
                          <pre className="text-[11px] font-mono bg-muted/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                            {s.rollback_commands.join("\n")}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>

              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-amber-500 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Confirm before apply
                </div>
                <p className="text-muted-foreground">
                  The agent will execute the write steps above on <span className="text-foreground">{device.name}</span>.
                  None of these scenarios reset or reboot the router.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPhase("params")} className="flex-1">Edit params</Button>
                <Button onClick={runPlan} disabled={loading} className="flex-1">
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enqueuing…</> : <><Check className="w-4 h-4 mr-2" /> Apply plan</>}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-xs text-muted-foreground mb-1 block">{label}</span>
    {children}
    {error && <span className="text-[11px] text-destructive mt-1 block">{error}</span>}
  </label>
);

function isTextarea(key: string) {
  return key === "provisioner_script" || key === "peers";
}
function isBoolean(key: string) {
  return key === "vlan_filtering";
}
function prettyLabel(key: string, scenario: ScenarioId): string {
  const map: Record<string, string> = {
    wan_interface: "WAN interface",
    lan_interface: "LAN interface",
    lan_network: "LAN network (CIDR)",
    lan_gateway: "LAN gateway IP",
    pool_range: "DHCP pool range",
    dns_servers: "DNS servers",
    bridge_name: "Bridge name",
    ports: "Ports (comma separated)",
    vlan_filtering: "VLAN filtering",
    radio: "Radio interface (wlan1 / wifi1)",
    ssid: "SSID",
    band: "Band",
    security: "Security (open / wpa2-psk / wpa3-psk)",
    passphrase: "Passphrase",
    country: "Country",
    user: "PPPoE username",
    password: "PPPoE password",
    service_name: "Service name (optional)",
    listen_interface: "Listen interface",
    local_ip: "Server IP (local-address)",
    profile_name: "PPP profile name",
    rate_limit: "Rate limit (rx/tx)",
    server_ip: "RADIUS server IP",
    secret: "RADIUS shared secret",
    services: "Services (comma: ppp,hotspot,login)",
    trunk_ports: "Trunk ports (comma separated)",
    vlans: "VLANs (id:name:access-ports;…)",
    interface: scenario === "qos_simple" ? "Interface to limit" : "Interface",
    network: "Network (CIDR)",
    gateway: "Gateway IP",
    listen_port: "Listen UDP port",
    address: "Tunnel address (CIDR)",
    peers: "Peers (one per line: <publickey>|<allowed-ips>)",
    max_upload: "Max upload (e.g. 10M)",
    max_download: "Max download (e.g. 50M)",
    servers: "NTP servers (comma)",
    provisioner_script: "Provisioner script (paste verbatim .rsc)",
    provider: "Provider tag",
  };
  return map[key] || key;
}
function placeholderFor(key: string, _scenario: ScenarioId): string {
  if (key === "provisioner_script") return "# Paste the full provisioner script from Centipid / Splynx / MikroWisp here.\n# Comments (#) are stripped. Lines run in order.";
  if (key === "peers") return "Az…publicKey…=|10.222.0.2/32\nBy…publicKey…=|10.222.0.3/32";
  if (key === "vlans") return "10:mgmt:ether2;20:guest:ether3,ether4";
  return "";
}

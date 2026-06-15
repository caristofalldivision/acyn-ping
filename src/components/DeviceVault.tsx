import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Router as RouterIcon, Wifi, Trash2, Terminal, Download } from "lucide-react";
import { JobLog } from "./JobLog";
import { HotspotWizard } from "./HotspotWizard";

interface DeviceVaultProps {
  onBack: () => void;
}

interface Device {
  id: string;
  name: string;
  vendor: string;
  model: string | null;
  host: string | null;
  connection_method: string;
  last_connected_at: string | null;
  status: string;
  agent_id: string | null;
}

export const DeviceVault = ({ onBack }: DeviceVaultProps) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [wizardDevice, setWizardDevice] = useState<Device | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("devices" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setDevices(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from("devices" as any).delete().eq("id", id);
    if (error) toast({ title: "Failed to delete", variant: "destructive" });
    else { toast({ title: "Device removed" }); load(); }
  };

  const runJob = async (device: Device, kind: "fetch_config") => {
    if (!device.agent_id) {
      toast({ title: "No agent paired", description: "Add a router via the wizard first.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.functions.invoke("device-jobs", {
      body: { device_id: device.id, kind },
    });
    if (error || !data?.job_id) {
      toast({ title: "Failed to enqueue", description: error?.message, variant: "destructive" });
      return;
    }
    setActiveJobId(data.job_id);
  };

  if (showAdd) return <AddDevice onBack={() => { setShowAdd(false); load(); }} />;
  if (wizardDevice) return <HotspotWizard device={wizardDevice} onBack={() => setWizardDevice(null)} />;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <header className="flex-shrink-0 flex items-center gap-3 p-3 md:p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-base md:text-lg font-semibold">Device Vault</h1>
          <p className="text-[11px] md:text-xs text-muted-foreground">Connect and remotely configure your routers</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="h-8 gap-1.5">
          <Plus className="w-4 h-4" /> Add Router
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {activeJobId && (
          <div className="max-w-3xl mx-auto mb-4">
            <JobLog jobId={activeJobId} onClose={() => setActiveJobId(null)} />
          </div>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Loading devices…</p>
        ) : devices.length === 0 ? (
          <div className="max-w-lg mx-auto text-center py-12 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <RouterIcon className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">No routers connected yet</h2>
            <p className="text-sm text-muted-foreground">
              Install the Ping Agent on a machine on your LAN, pair it with a one-time code, and then
              Ping can fetch configs and run setup wizards on your MikroTik routers — even behind CGNAT.
            </p>
            <Button onClick={() => setShowAdd(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add your first router
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {devices.map(d => (
              <div key={d.id} className="rounded-xl border border-border bg-card p-3 md:p-4 flex flex-col md:flex-row gap-3 md:items-center">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <RouterIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium truncate">{d.name}</h3>
                      <Badge variant="outline" className="text-[10px] uppercase">{d.vendor}</Badge>
                      <Badge variant={d.status === "online" ? "default" : "secondary"} className="text-[10px]">{d.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.model || "Unknown model"} · {d.host || "—"} · via {d.connection_method.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => runJob(d, "fetch_config")}>
                    <Download className="w-3 h-3" /> Fetch Config
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                    onClick={() => {
                      if (!d.agent_id) {
                        toast({ title: "Pair an agent first", variant: "destructive" });
                        return;
                      }
                      setWizardDevice(d);
                    }}>
                    <Wifi className="w-3 h-3" /> Hotspot Wizard
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" disabled>
                    <Terminal className="w-3 h-3" /> Jobs
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => remove(d.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground text-center pt-4">
              Actions are queued and picked up by your Ping Agent on its next poll (within ~5 seconds).
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const AddDevice = ({ onBack }: { onBack: () => void }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pairingCode, setPairingCode] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [agentOnline, setAgentOnline] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [vendor, setVendor] = useState("mikrotik");
  const [method, setMethod] = useState("ssh");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Poll device_agents while on step 2 to detect when the agent finishes pairing
  useEffect(() => {
    if (step !== 2 || !agentId) return;
    let stop = false;
    const tick = async () => {
      const { data } = await supabase
        .from("device_agents" as any)
        .select("status, last_seen_at")
        .eq("id", agentId)
        .maybeSingle();
      if (stop) return;
      const a = data as any;
      if (a && a.status && a.status !== "pending") {
        setAgentOnline(true);
        toast({ title: "Agent paired ✓", description: "Continue to add your router." });
      }
    };
    const iv = setInterval(tick, 3000);
    tick();
    return () => { stop = true; clearInterval(iv); };
  }, [step, agentId, toast]);

  const generateCode = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("device-pair", { body: {} });
    setGenerating(false);
    if (error || !data?.pairing_code) {
      toast({ title: "Failed to generate code", description: error?.message, variant: "destructive" });
      return;
    }
    setPairingCode(data.pairing_code);
    setAgentId(data.agent_id);
    setStep(2);
  };

  const save = async () => {
    if (!name || !host) {
      toast({ title: "Name and host required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("devices" as any).insert({
      user_id: user.id,
      agent_id: agentId,
      name,
      vendor,
      host,
      connection_method: method,
      username,
      credential_encrypted: password, // TODO: encrypt at rest via pgcrypto in a follow-up
      port: method === "rest" ? 443 : 22,
      status: "pending",
    });
    setSaving(false);
    if (error) toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    else { toast({ title: "Router added" }); onBack(); }
  };

  const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <header className="flex-shrink-0 flex items-center gap-3 p-3 md:p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-base md:text-lg font-semibold">Add Router</h1>
        <span className="text-xs text-muted-foreground ml-auto">Step {step} of 3</span>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-xl mx-auto space-y-6">
          {step === 1 && (
            <>
              <div>
                <h2 className="text-base font-semibold mb-2">1. Install the Ping Agent</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  The agent is a small program (~5 MB) that runs on a machine on the same LAN as your router.
                  It dials out to Ping so we never need your router's public IP — works behind CGNAT.
                </p>
                <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-xs font-mono">
                  <p className="text-muted-foreground"># Linux / macOS</p>
                  <code className="block break-all">curl -fsSL https://ping.echoisp.click/agent/install.sh | sh</code>
                  <p className="text-muted-foreground mt-3"># Windows (PowerShell)</p>
                  <code className="block break-all">iwr -useb https://ping.echoisp.click/agent/install.ps1 | iex</code>
                  <p className="text-[10px] text-muted-foreground mt-2">Mirror: https://ping.acyninnovation.com</p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Supports SSH (RouterOS v6 + v7, the same way you use Winbox) and REST API (v7.1+).
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-2">
                <p className="text-foreground font-medium">Prepare your MikroTik in Winbox (one time)</p>
                <p className="text-muted-foreground">Open a New Terminal in Winbox and paste:</p>
                <code className="block break-all whitespace-pre-wrap font-mono text-[11px]">{`/ip service enable ssh
/ip service set ssh port=22
# Optional, RouterOS v7.1+ only:
/ip service enable www-ssl
# Dedicated agent user (replace STRONGPASS):
/user group add name=ping policy=read,write,policy,test,api,ssh,rest-api,sensitive
/user add name=ping group=ping password=STRONGPASS`}</code>
                <p className="text-muted-foreground">Use these same credentials in step 3.</p>
              </div>
              <Button onClick={generateCode} disabled={generating} className="w-full">
                {generating ? "Generating…" : "I've installed it — generate pairing code"}
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-base font-semibold mb-2">2. Pair the agent</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  On the machine where you installed the agent, run this command. The code expires in 10 minutes.
                </p>
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Pairing code</p>
                  <p className="text-3xl font-mono font-bold tracking-widest text-primary">{pairingCode}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 mt-3 font-mono text-xs space-y-2">
                  <p className="text-muted-foreground"># Already installed:</p>
                  <code className="block break-all">ping-agent pair {pairingCode}</code>
                  <p className="text-muted-foreground mt-2"># Install + pair in one go (Linux / macOS):</p>
                  <code className="block break-all">curl -fsSL https://ping.echoisp.click/agent/install.sh | sh -s -- {pairingCode}</code>
                  <p className="text-muted-foreground mt-2"># Install + pair in one go (Windows PowerShell):</p>
                  <code className="block break-all">{`$env:PING_CODE="${pairingCode}"; iwr -useb https://ping.echoisp.click/agent/install.ps1 | iex`}</code>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => {
                      navigator.clipboard.writeText(`curl -fsSL https://ping.echoisp.click/agent/install.sh | sh -s -- ${pairingCode}`);
                      toast({ title: "Copied Linux/macOS command" });
                    }}>Copy Linux/macOS</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => {
                      navigator.clipboard.writeText(`$env:PING_CODE="${pairingCode}"; iwr -useb https://ping.echoisp.click/agent/install.ps1 | iex`);
                      toast({ title: "Copied Windows command" });
                    }}>Copy Windows</Button>
                  </div>
                </div>

                <div className={`mt-3 rounded-lg border p-3 text-sm flex items-center gap-2 ${agentOnline ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                  <span className={`w-2 h-2 rounded-full ${agentOnline ? "bg-primary" : "bg-muted-foreground animate-pulse"}`} />
                  {agentOnline ? "Agent paired and online ✓" : "Waiting for agent to check in…"}
                </div>

                <button type="button" onClick={() => setShowHelp(s => !s)} className="text-xs text-muted-foreground underline mt-3">
                  {showHelp ? "Hide help" : "Need help? (systemd, upgrade, uninstall)"}
                </button>
                {showHelp && (
                  <div className="mt-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground space-y-2">
                    <p><strong className="text-foreground">Verify backend:</strong> <code>ping-agent doctor</code></p>
                    <p><strong className="text-foreground">Verify MikroTik SSH:</strong> <code>ping-agent doctor --router 192.168.88.1 --user ping --password STRONGPASS</code></p>
                    <p><strong className="text-foreground">Run as a service (Linux):</strong> see <code>agent/README.md</code> for the ready-made systemd unit.</p>
                    <p><strong className="text-foreground">Upgrade:</strong> re-run the install command — it overwrites the binary in place.</p>
                    <p><strong className="text-foreground">Uninstall:</strong> <code>sudo rm /usr/local/bin/ping-agent && rm -rf ~/.ping</code></p>
                    <p><strong className="text-foreground">Binaries:</strong> served from your GitHub Releases. Maintainers cut a release with <code>cd agent && ./release.sh 0.2.0</code>.</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1">{agentOnline ? "Next: add router" : "Skip & add router anyway"}</Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-3">
                <h2 className="text-base font-semibold">3. Router details</h2>
                <Field label="Friendly name">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Office MikroTik" className={inp} />
                </Field>
                <Field label="Vendor">
                  <select value={vendor} onChange={e => setVendor(e.target.value)} className={inp}>
                    <option value="mikrotik">MikroTik</option>
                    <option value="cisco" disabled>Cisco (coming soon)</option>
                    <option value="ubiquiti" disabled>Ubiquiti (coming soon)</option>
                  </select>
                </Field>
                <Field label="LAN IP / hostname (as the agent sees it)">
                  <input value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.88.1" className={inp} />
                </Field>
                <Field label="Connection method">
                  <select value={method} onChange={e => setMethod(e.target.value)} className={inp}>
                    <option value="ssh">SSH (RouterOS v6 + v7, like Winbox)</option>
                    <option value="rest">REST API (RouterOS v7.1+)</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Username">
                    <input value={username} onChange={e => setUsername(e.target.value)} className={inp} />
                  </Field>
                  <Field label="Password">
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inp} />
                  </Field>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                <Button onClick={save} disabled={saving} className="flex-1">
                  {saving ? "Saving…" : "Save router"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-xs text-muted-foreground mb-1 block">{label}</span>
    {children}
  </label>
);

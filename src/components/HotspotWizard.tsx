import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wifi, Loader2, Check, AlertTriangle, Undo2, ShieldCheck, Eye, Pencil } from "lucide-react";
import { JobLog } from "./JobLog";

interface Props {
  device: {
    id: string;
    name: string;
    agent_id: string | null;
  };
  onBack: () => void;
}

interface PlanStep {
  id: string;
  title: string;
  description: string;
  kind: "read" | "write";
  requires_confirm: boolean;
  commands: string[];
  rollback_commands: string[];
}

interface Plan {
  summary: string;
  backup_name: string;
  steps: PlanStep[];
  full_rollback_commands: string[];
  restore_command: string;
  ai_notes?: string;
}

const defaults = {
  hotspot_interface: "ether2",
  network: "10.5.50.0/24",
  gateway_ip: "10.5.50.1",
  pool_range: "10.5.50.10-10.5.50.254",
  dns_name: "wifi.myisp.local",
  dns_servers: "1.1.1.1,8.8.8.8",
  hotspot_profile_name: "hsprof1",
  payment_walled_garden: "*.safaricom.co.ke,*.safaricom.com,*.mpesa.com,*.gstatic.com,*.apple.com",
  voucher_user_profile: "1hr-5M",
  rate_limit: "5M/5M",
  session_timeout: "1h",
};

export const HotspotWizard = ({ device, onBack }: Props) => {
  const { toast } = useToast();
  const [phase, setPhase] = useState<"params" | "review" | "running">("params");
  const [params, setParams] = useState({ ...defaults });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  const generatePlan = async () => {
    if (!device.agent_id) {
      toast({ title: "No agent paired with this device", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("wizard-hotspot", {
      body: {
        device_name: device.name,
        device_id: device.id,
        params: {
          ...params,
          payment_walled_garden: params.payment_walled_garden.split(",").map(s => s.trim()).filter(Boolean),
        },
      },
    });
    setLoading(false);
    if (error || !data?.steps) {
      toast({ title: "Failed to build plan", description: error?.message, variant: "destructive" });
      return;
    }
    setPlan(data as Plan);
    setPhase("review");
  };

  const runPlan = async () => {
    if (!plan) return;
    const script = [
      `# Ping hotspot setup for ${device.name}`,
      `# Backup: ${plan.backup_name}`,
      ``,
      ...plan.steps.flatMap(s => [`# === ${s.title} ===`, ...s.commands, ``]),
    ].join("\n");

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("device-jobs", {
      body: {
        device_id: device.id,
        kind: "wizard_hotspot",
        script_content: JSON.stringify({ plan, script }),
      },
    });
    setLoading(false);
    if (error || !data?.job_id) {
      toast({ title: "Failed to enqueue", description: error?.message, variant: "destructive" });
      return;
    }
    setActiveJobId(data.job_id);
    setPhase("running");
  };

  if (phase === "running" && activeJobId) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <header className="flex-shrink-0 flex items-center gap-3 p-3 md:p-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1">
            <h1 className="text-base md:text-lg font-semibold">Hotspot wizard · {device.name}</h1>
            <p className="text-[11px] md:text-xs text-muted-foreground">Live execution log</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          <div className="max-w-3xl mx-auto">
            <JobLog jobId={activeJobId} onClose={() => { setActiveJobId(null); setPhase("review"); }} />
            {plan && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-amber-500 mb-1">
                  <Undo2 className="w-3.5 h-3.5" /> Rollback
                </div>
                <p className="text-muted-foreground mb-2">
                  Runs the inverse of every write step. If you took a backup in Winbox before pairing,
                  you can also restore it manually from Files.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={async () => {
                      const script = [`# Full rollback`, ...plan.full_rollback_commands].join("\n");
                      const { data, error } = await supabase.functions.invoke("device-jobs", {
                        body: { device_id: device.id, kind: "apply_script", script_content: script },
                      });
                      if (error || !data?.job_id) toast({ title: "Failed", variant: "destructive" });
                      else { setActiveJobId(data.job_id); }
                    }}>
                    Run inverse rollback
                  </Button>
                </div>
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
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base md:text-lg font-semibold flex items-center gap-2">
            <Wifi className="w-4 h-4 text-primary" /> Hotspot wizard
          </h1>
          <p className="text-[11px] md:text-xs text-muted-foreground truncate">{device.name}</p>
        </div>
        {phase === "review" && (
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setPhase("params")}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {phase === "params" && (
            <>
              <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                Ping will build a step-by-step plan, take a safety backup first, and ask you to confirm
                before any write. Every write step has an inverse rollback.
              </div>
              <Field label="Hotspot interface (must already exist)">
                <input value={params.hotspot_interface} onChange={e => setParams(p => ({ ...p, hotspot_interface: e.target.value }))} className={inp} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Network (CIDR)">
                  <input value={params.network} onChange={e => setParams(p => ({ ...p, network: e.target.value }))} className={inp} />
                </Field>
                <Field label="Gateway IP">
                  <input value={params.gateway_ip} onChange={e => setParams(p => ({ ...p, gateway_ip: e.target.value }))} className={inp} />
                </Field>
              </div>
              <Field label="DHCP pool range">
                <input value={params.pool_range} onChange={e => setParams(p => ({ ...p, pool_range: e.target.value }))} className={inp} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Captive portal hostname">
                  <input value={params.dns_name} onChange={e => setParams(p => ({ ...p, dns_name: e.target.value }))} className={inp} />
                </Field>
                <Field label="DNS servers">
                  <input value={params.dns_servers} onChange={e => setParams(p => ({ ...p, dns_servers: e.target.value }))} className={inp} />
                </Field>
              </div>
              <Field label="Walled garden (comma separated, M-Pesa & captive probes pre-loaded)">
                <input value={params.payment_walled_garden} onChange={e => setParams(p => ({ ...p, payment_walled_garden: e.target.value }))} className={inp} />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Voucher profile name">
                  <input value={params.voucher_user_profile} onChange={e => setParams(p => ({ ...p, voucher_user_profile: e.target.value }))} className={inp} />
                </Field>
                <Field label="Rate limit (rx/tx)">
                  <input value={params.rate_limit} onChange={e => setParams(p => ({ ...p, rate_limit: e.target.value }))} className={inp} />
                </Field>
                <Field label="Session timeout">
                  <input value={params.session_timeout} onChange={e => setParams(p => ({ ...p, session_timeout: e.target.value }))} className={inp} />
                </Field>
              </div>
              <Button onClick={generatePlan} disabled={loading} className="w-full">
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
                {plan.ai_notes && <p className="mt-2 text-foreground/80">{plan.ai_notes}</p>}
                <p className="mt-2 text-[11px]">Backup name: <code className="text-foreground">{plan.backup_name}</code></p>
              </div>

              <div className="space-y-2">
                {plan.steps.map((s, i) => (
                  <details key={s.id} className="rounded-lg border border-border bg-card p-3 group" open={s.kind === "write"}>
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
                          {s.requires_confirm && (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> confirm
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{s.description}</p>
                      </div>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground mb-1">Commands</p>
                        <pre className="text-[11px] font-mono bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                          {s.commands.join("\n")}
                        </pre>
                      </div>
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
                  By clicking apply, the agent will execute the steps above on <span className="text-foreground">{device.name}</span>.
                  A backup is taken first and rollback is available at any time.
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

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-xs text-muted-foreground mb-1 block">{label}</span>
    {children}
  </label>
);

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, CreditCard, Trash2, Settings as SettingsIcon } from "lucide-react";
import { ProviderSettings } from "./ProviderSettings";

interface Props { onBack: () => void; }
interface Plan { id: string; name: string; price_kes: number; duration_minutes: number; bandwidth_profile: string | null; is_active: boolean; }
interface Sub { id: string; customer_phone: string; status: string; amount_kes: number; expires_at: string | null; plans: { name: string } | null; }

export const Billing = ({ onBack }: Props) => {
  const [tab, setTab] = useState<"plans" | "subs" | "settings">("plans");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("plans" as any).select("*").eq("user_id", user.id).order("price_kes");
    setPlans((p as any) || []);
    const { data: s } = await supabase.from("subscriptions" as any).select("*, plans(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setSubs((s as any) || []);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="flex items-center gap-3 p-3 md:p-4 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-base md:text-lg font-semibold">Billing & Hotspot Plans</h1>
          <p className="text-[11px] md:text-xs text-muted-foreground">Pesapal payments + auto-provision Wi-Fi users</p>
        </div>
      </header>

      <div className="flex border-b border-border flex-shrink-0">
        {(["plans", "subs", "settings"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs md:text-sm capitalize border-b-2 ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "subs" ? "Subscriptions" : t === "settings" ? "Providers" : "Plans"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="max-w-3xl mx-auto">
          {tab === "plans" && (
            showAddPlan ? <AddPlan onDone={() => { setShowAddPlan(false); load(); }} /> : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-xs text-muted-foreground">Plans shown on your captive portal</p>
                  <Button size="sm" onClick={() => setShowAddPlan(true)} className="h-8 gap-1.5"><Plus className="w-4 h-4" /> Add Plan</Button>
                </div>
                {plans.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No plans yet. Add one to start selling Wi-Fi access.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {plans.map(p => (
                      <div key={p.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-medium">{p.name}</h3>
                            <Badge variant="outline" className="text-[10px]">KES {p.price_kes}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{formatDuration(p.duration_minutes)}</Badge>
                            {p.bandwidth_profile && <Badge variant="outline" className="text-[10px]">{p.bandwidth_profile}</Badge>}
                            {!p.is_active && <Badge variant="destructive" className="text-[10px]">inactive</Badge>}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={async () => {
                          await supabase.from("plans" as any).delete().eq("id", p.id);
                          toast({ title: "Plan deleted" }); load();
                        }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          )}

          {tab === "subs" && (
            subs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No subscriptions yet. Customers buying via your captive portal will appear here.</p>
            ) : (
              <div className="space-y-2">
                {subs.map(s => (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 flex-wrap">
                    <CreditCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.customer_phone} · {s.plans?.name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        KES {s.amount_kes} · {s.expires_at ? `expires ${new Date(s.expires_at).toLocaleString()}` : "—"}
                      </p>
                    </div>
                    <Badge variant={s.status === "active" ? "default" : s.status === "expired" ? "secondary" : s.status === "failed" ? "destructive" : "outline"} className="text-[10px]">{s.status}</Badge>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "settings" && <ProviderSettings />}
        </div>
      </div>
    </div>
  );
};

function formatDuration(m: number) {
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${(m / 60).toFixed(m % 60 ? 1 : 0)}h`;
  return `${Math.round(m / 1440)}d`;
}

const AddPlan = ({ onDone }: { onDone: () => void }) => {
  const [name, setName] = useState("1 Hour");
  const [price, setPrice] = useState(20);
  const [duration, setDuration] = useState(60);
  const [profile, setProfile] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("plans" as any).insert({
      user_id: user.id, name, price_kes: price, duration_minutes: duration, bandwidth_profile: profile || null,
    });
    setSaving(false);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Plan added" }); onDone(); }
  };

  return (
    <div className="space-y-3 max-w-md mx-auto">
      <h2 className="text-base font-semibold">Add Plan</h2>
      <label className="block"><span className="text-xs text-muted-foreground mb-1 block">Name</span>
        <input value={name} onChange={e => setName(e.target.value)} className={inp} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="text-xs text-muted-foreground mb-1 block">Price (KES)</span>
          <input type="number" value={price} onChange={e => setPrice(+e.target.value)} className={inp} /></label>
        <label className="block"><span className="text-xs text-muted-foreground mb-1 block">Duration (minutes)</span>
          <input type="number" value={duration} onChange={e => setDuration(+e.target.value)} className={inp} /></label>
      </div>
      <label className="block"><span className="text-xs text-muted-foreground mb-1 block">MikroTik bandwidth profile (optional)</span>
        <input value={profile} onChange={e => setProfile(e.target.value)} placeholder="e.g. 5M-5M" className={inp} /></label>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onDone} className="flex-1">Cancel</Button>
        <Button onClick={save} disabled={saving} className="flex-1">{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
};

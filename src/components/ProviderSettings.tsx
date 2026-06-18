import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export const ProviderSettings = () => {
  const [s, setS] = useState<any>({
    business_name: "", pesapal_env: "sandbox", pesapal_consumer_key: "", pesapal_consumer_secret: "", pesapal_ipn_id: "",
    talksasa_api_key: "", talksasa_sender_id: "TalkSasa",
    sms_on_payment: true, sms_on_expiry_warn: true, sms_on_expiry: true,
    ai_provider: "lovable", gemini_api_key: "", gemini_model: "gemini-2.5-pro",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const { toast } = useToast();

  const testKey = async () => {
    if (!s.gemini_api_key) { toast({ title: "Enter a key first", variant: "destructive" }); return; }
    setTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-test-key", {
        body: { apiKey: s.gemini_api_key, model: s.gemini_model },
      });
      if (error) throw error;
      if (data?.ok) setTestResult(`✓ Key works (${data.model}, ${data.latency_ms}ms)`);
      else setTestResult(`✗ ${data?.error || "Key rejected by Google"}`);
    } catch (e: any) {
      setTestResult(`✗ ${e.message || "Test failed"}`);
    } finally { setTesting(false); }
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("app_settings" as any).select("*").eq("user_id", user.id).maybeSingle();
      if (data) setS((prev: any) => ({ ...prev, ...(data as any) }));
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { ...s, user_id: user.id };
    const { error } = await supabase.from("app_settings" as any).upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else toast({ title: "Settings saved" });
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Business</h2>
        <label className="block"><span className="text-xs text-muted-foreground mb-1 block">Business name (shown on receipts & SMS)</span>
          <input value={s.business_name || ""} onChange={e => setS({ ...s, business_name: e.target.value })} className={inp} placeholder="ACYN ISP" /></label>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Pesapal (M-Pesa STK + cards)</h2>
        <p className="text-[11px] text-muted-foreground">Get keys from <a href="https://developer.pesapal.com" target="_blank" rel="noreferrer" className="text-primary underline">developer.pesapal.com</a>. Register your IPN URL pointing to <code className="text-[10px] bg-muted px-1 rounded">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/pesapal-ipn</code> and paste the IPN ID below.</p>
        <label className="block"><span className="text-xs text-muted-foreground mb-1 block">Environment</span>
          <select value={s.pesapal_env || "sandbox"} onChange={e => setS({ ...s, pesapal_env: e.target.value })} className={inp}>
            <option value="sandbox">Sandbox (testing)</option>
            <option value="live">Live</option>
          </select></label>
        <label className="block"><span className="text-xs text-muted-foreground mb-1 block">Consumer Key</span>
          <input value={s.pesapal_consumer_key || ""} onChange={e => setS({ ...s, pesapal_consumer_key: e.target.value })} className={inp} /></label>
        <label className="block"><span className="text-xs text-muted-foreground mb-1 block">Consumer Secret</span>
          <input type="password" value={s.pesapal_consumer_secret || ""} onChange={e => setS({ ...s, pesapal_consumer_secret: e.target.value })} className={inp} /></label>
        <label className="block"><span className="text-xs text-muted-foreground mb-1 block">IPN ID</span>
          <input value={s.pesapal_ipn_id || ""} onChange={e => setS({ ...s, pesapal_ipn_id: e.target.value })} className={inp} /></label>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">TalkSasa SMS</h2>
        <p className="text-[11px] text-muted-foreground">Get an API key from <a href="https://talksasa.com" target="_blank" rel="noreferrer" className="text-primary underline">talksasa.com</a>. Sender ID must be approved by TalkSasa first.</p>
        <label className="block"><span className="text-xs text-muted-foreground mb-1 block">API Key</span>
          <input type="password" value={s.talksasa_api_key || ""} onChange={e => setS({ ...s, talksasa_api_key: e.target.value })} className={inp} /></label>
        <label className="block"><span className="text-xs text-muted-foreground mb-1 block">Sender ID</span>
          <input value={s.talksasa_sender_id || ""} onChange={e => setS({ ...s, talksasa_sender_id: e.target.value })} className={inp} /></label>
        <div className="space-y-1.5 pt-2">
          {[["sms_on_payment", "SMS receipt + credentials on payment"], ["sms_on_expiry_warn", "SMS 24h before expiry"], ["sms_on_expiry", "SMS on expiry"]].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!s[k]} onChange={e => setS({ ...s, [k]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </section>

      <Button onClick={save} disabled={saving} className="w-full">{saving ? "Saving…" : "Save settings"}</Button>
    </div>
  );
};

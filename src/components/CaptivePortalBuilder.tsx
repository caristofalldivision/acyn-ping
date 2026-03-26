import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Copy, Check, Save, Eye, Palette, CreditCard,
  Type, Download
} from "lucide-react";

interface PortalConfig {
  ispName: string;
  tagline: string;
  logoUrl: string;
  bgColor: string;
  cardBgColor: string;
  primaryColor: string;
  textColor: string;
  accentColor: string;
  layout: "centered" | "split" | "minimal";
  showMpesa: boolean;
  showStripe: boolean;
  showPaypal: boolean;
  showVoucher: boolean;
  mpesaPaybill: string;
  mpesaAccountNo: string;
}

interface CaptivePortalBuilderProps {
  onBack: () => void;
}

interface ThemePreset {
  name: string;
  emoji: string;
  colors: Pick<PortalConfig, "bgColor" | "cardBgColor" | "primaryColor" | "textColor" | "accentColor" | "layout">;
}

const themePresets: ThemePreset[] = [
  {
    name: "Default",
    emoji: "🌐",
    colors: {
      bgColor: "#0f172a",
      cardBgColor: "#1e293b",
      primaryColor: "#3b82f6",
      textColor: "#f8fafc",
      accentColor: "#22c55e",
      layout: "centered",
    },
  },
  {
    name: "Dark Gaming",
    emoji: "🎮",
    colors: {
      bgColor: "#0a0015",
      cardBgColor: "#150025",
      primaryColor: "#8b5cf6",
      textColor: "#e0e7ff",
      accentColor: "#00ff88",
      layout: "minimal",
    },
  },
  {
    name: "Corporate",
    emoji: "🏢",
    colors: {
      bgColor: "#f8fafc",
      cardBgColor: "#ffffff",
      primaryColor: "#1e3a5f",
      textColor: "#1e293b",
      accentColor: "#0ea5e9",
      layout: "centered",
    },
  },
  {
    name: "Cafe",
    emoji: "☕",
    colors: {
      bgColor: "#2c1810",
      cardBgColor: "#3d2419",
      primaryColor: "#f97316",
      textColor: "#fef3c7",
      accentColor: "#eab308",
      layout: "centered",
    },
  },
];

const defaultConfig: PortalConfig = {
  ispName: "FastNet WiFi",
  tagline: "High Speed Internet Access",
  logoUrl: "",
  ...themePresets[0].colors,
  showMpesa: true,
  showStripe: false,
  showPaypal: false,
  showVoucher: true,
  mpesaPaybill: "",
  mpesaAccountNo: "",
};

const generateHTML = (c: PortalConfig): string => {
  const paymentButtons = [
    c.showMpesa ? `<div class="payment-btn" style="background:${c.accentColor};" onclick="alert('Pay via M-Pesa:\\nPaybill: ${c.mpesaPaybill || "XXXXXX"}\\nAccount: ${c.mpesaAccountNo || "Your Phone"}')">
        <span>📱</span> Pay with M-Pesa
      </div>` : "",
    c.showStripe ? `<div class="payment-btn" style="background:#635bff;" onclick="alert('Stripe payment integration - configure walled garden for checkout.stripe.com')">
        <span>💳</span> Pay with Card
      </div>` : "",
    c.showPaypal ? `<div class="payment-btn" style="background:#003087;" onclick="alert('PayPal payment - configure walled garden for paypal.com')">
        <span>🅿️</span> Pay with PayPal
      </div>` : "",
  ].filter(Boolean).join("\n        ");

  const hasPayments = c.showMpesa || c.showStripe || c.showPaypal;

  const glowStyles = c.bgColor === "#0a0015" ? `
    .card { border: 1px solid ${c.primaryColor}33; box-shadow: 0 0 40px ${c.primaryColor}15, 0 20px 60px rgba(0,0,0,0.5); }
    .login-btn { box-shadow: 0 0 20px ${c.primaryColor}40; }
    .payment-btn { box-shadow: 0 0 15px ${c.accentColor}30; }
  ` : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${c.ispName} - Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${c.bgColor};
      color: ${c.textColor};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .card {
      background: ${c.cardBgColor};
      border-radius: 16px;
      padding: 28px 24px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    ${c.layout === "split" ? `.card { max-width: 480px; border-radius: 0 16px 16px 0; }
    body { justify-content: flex-end; background-image: linear-gradient(135deg, ${c.primaryColor}44, ${c.bgColor}); }` : ""}
    ${c.layout === "minimal" ? `.card { background: transparent; box-shadow: none; max-width: 360px; text-align: center; }` : ""}
    ${glowStyles}
    .logo { text-align: center; margin-bottom: 20px; }
    .logo img { max-width: 120px; max-height: 60px; }
    .logo h1 { font-size: 22px; font-weight: 700; color: ${c.primaryColor}; }
    .logo p { font-size: 13px; opacity: 0.7; margin-top: 4px; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 13px; margin-bottom: 6px; opacity: 0.8; }
    .form-group input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid ${c.primaryColor}33;
      border-radius: 8px;
      background: ${c.bgColor};
      color: ${c.textColor};
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-group input:focus { border-color: ${c.primaryColor}; }
    .login-btn {
      width: 100%;
      padding: 12px;
      background: ${c.primaryColor};
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
      transition: opacity 0.2s;
    }
    .login-btn:hover { opacity: 0.9; }
    .divider { text-align: center; margin: 18px 0; font-size: 12px; opacity: 0.5; }
    .payment-section h3 { font-size: 13px; opacity: 0.7; margin-bottom: 10px; text-align: center; }
    .payment-btn {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      margin-bottom: 8px;
      text-align: center;
      transition: opacity 0.2s;
    }
    .payment-btn:hover { opacity: 0.85; }
    .status { text-align: center; margin-top: 16px; font-size: 11px; opacity: 0.4; }
    .error { color: #ef4444; font-size: 13px; text-align: center; margin-bottom: 10px; display: none; }
    @media (max-width: 400px) {
      .card { padding: 20px 16px; }
      .logo h1 { font-size: 18px; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      ${c.logoUrl ? `<img src="${c.logoUrl}" alt="${c.ispName}">` : `<h1>${c.ispName}</h1>`}
      <p>${c.tagline}</p>
    </div>

    <div class="error" id="error">$(error)</div>

    <form action="$(link-login-only)" method="post" name="login">
      ${c.showVoucher ? `<div class="form-group">
        <label>Voucher Code</label>
        <input type="text" name="username" placeholder="Enter your voucher code" required>
        <input type="hidden" name="password" value="voucher">
      </div>` : `<div class="form-group">
        <label>Username</label>
        <input type="text" name="username" placeholder="Enter username" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" placeholder="Enter password" required>
      </div>`}
      
      <input type="hidden" name="dst" value="$(link-orig)">
      <button type="submit" class="login-btn">
        ${c.showVoucher ? "🔑 Redeem Voucher & Connect" : "🔐 Login & Connect"}
      </button>
    </form>

    ${hasPayments ? `<div class="divider">— or buy access —</div>
    <div class="payment-section">
      ${paymentButtons}
    </div>` : ""}

    <div class="status">
      ⚡ Powered by ${c.ispName} • $(hostname)
    </div>
  </div>

  <script>
    var err = "$(error)";
    if (err && err !== "$(err" + "or)") {
      document.getElementById("error").style.display = "block";
    }
  </script>
</body>
</html>`;
};

export const CaptivePortalBuilder = ({ onBack }: CaptivePortalBuilderProps) => {
  const [config, setConfig] = useState<PortalConfig>(defaultConfig);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const html = useMemo(() => generateHTML(config), [config]);

  const update = (key: keyof PortalConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const applyTheme = (theme: ThemePreset) => {
    setConfig(prev => ({ ...prev, ...theme.colors }));
  };

  const copyHTML = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "HTML copied!", description: "Upload as login.html to MikroTik via WinBox > Files" });
  };

  const downloadHTML = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.ispName.replace(/[^a-zA-Z0-9_-]/g, "_")}_login.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "Upload login.html to MikroTik via WinBox > Files" });
  };

  const saveAsScript = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("saved_scripts").insert({
      user_id: user.id,
      title: `${config.ispName} Captive Portal`,
      description: `Login page for ${config.ispName} hotspot with ${[config.showMpesa && "M-Pesa", config.showStripe && "Stripe", config.showPaypal && "PayPal", config.showVoucher && "Voucher"].filter(Boolean).join(", ")}`,
      category: "Captive Portal",
      template_id: "captive-portal",
      script_content: html,
      form_values: config as any,
    });
    setSaving(false);
    if (!error) toast({ title: "Saved!", description: "Portal saved to your scripts" });
    else toast({ title: "Error saving", variant: "destructive" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">🌐 Captive Portal Builder</h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Design your MikroTik login page</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="brand" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-3 sm:px-4 pt-3">
          <TabsList className="w-full grid grid-cols-4 h-9">
            <TabsTrigger value="brand" className="text-[10px] sm:text-xs gap-1"><Type className="w-3 h-3" /><span className="hidden sm:inline">Brand</span></TabsTrigger>
            <TabsTrigger value="colors" className="text-[10px] sm:text-xs gap-1"><Palette className="w-3 h-3" /><span className="hidden sm:inline">Colors</span></TabsTrigger>
            <TabsTrigger value="payments" className="text-[10px] sm:text-xs gap-1"><CreditCard className="w-3 h-3" /><span className="hidden sm:inline">Pay</span></TabsTrigger>
            <TabsTrigger value="preview" className="text-[10px] sm:text-xs gap-1"><Eye className="w-3 h-3" /><span className="hidden sm:inline">Preview</span></TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 sm:p-4">
            <TabsContent value="brand" className="mt-0 space-y-4">
              {/* Theme Presets */}
              <div className="space-y-1.5">
                <Label className="text-sm">🎨 Theme Preset</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {themePresets.map(theme => (
                    <button
                      key={theme.name}
                      onClick={() => applyTheme(theme)}
                      className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                        config.bgColor === theme.colors.bgColor && config.primaryColor === theme.colors.primaryColor
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                          : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50"
                      }`}
                    >
                      <span className="text-lg block mb-0.5">{theme.emoji}</span>
                      <span className="text-[10px]">{theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">ISP / Business Name</Label>
                <Input value={config.ispName} onChange={e => update("ispName", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Tagline</Label>
                <Input value={config.tagline} onChange={e => update("tagline", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">🖼️ Logo URL (optional)</Label>
                <Input value={config.logoUrl} onChange={e => update("logoUrl", e.target.value)} placeholder="https://..." className="h-9 text-sm" />
                <p className="text-[10px] text-muted-foreground">Direct link to your logo image</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">📐 Layout Style</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["centered", "split", "minimal"] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => update("layout", l)}
                      className={`p-2.5 sm:p-3 rounded-lg border text-xs font-medium capitalize transition-colors ${
                        config.layout === l
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">🔑 Login Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => update("showVoucher", true)}
                    className={`p-2.5 sm:p-3 rounded-lg border text-xs font-medium transition-colors ${
                      config.showVoucher
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🎫 Voucher Code
                  </button>
                  <button
                    onClick={() => update("showVoucher", false)}
                    className={`p-2.5 sm:p-3 rounded-lg border text-xs font-medium transition-colors ${
                      !config.showVoucher
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    👤 User/Pass
                  </button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="colors" className="mt-0 space-y-4">
              {([
                ["bgColor", "🎨 Background"],
                ["cardBgColor", "📦 Card Background"],
                ["primaryColor", "🔵 Primary / Buttons"],
                ["textColor", "✏️ Text Color"],
                ["accentColor", "✨ Accent / Payment Buttons"],
              ] as [keyof PortalConfig, string][]).map(([key, label]) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config[key] as string}
                    onChange={e => update(key, e.target.value)}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-border cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm">{label}</Label>
                    <Input
                      value={config[key] as string}
                      onChange={e => update(key, e.target.value)}
                      className="h-7 sm:h-8 text-[10px] sm:text-xs mt-1 font-mono"
                    />
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="payments" className="mt-0 space-y-4">
              <p className="text-xs text-muted-foreground">Enable payment buttons on the login page. Remember to configure matching walled garden rules on your MikroTik.</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-medium text-foreground">📱 M-Pesa</p>
                    <p className="text-[10px] text-muted-foreground truncate">Walled garden: *.safaricom.co.ke, *.mpesa.in</p>
                  </div>
                  <Switch checked={config.showMpesa} onCheckedChange={v => update("showMpesa", v)} />
                </div>
                {config.showMpesa && (
                  <div className="pl-3 sm:pl-4 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Paybill Number</Label>
                      <Input value={config.mpesaPaybill} onChange={e => update("mpesaPaybill", e.target.value)} placeholder="e.g., 123456" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Account Number</Label>
                      <Input value={config.mpesaAccountNo} onChange={e => update("mpesaAccountNo", e.target.value)} placeholder="e.g., Phone Number" className="h-8 text-xs" />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-medium text-foreground">💳 Stripe</p>
                    <p className="text-[10px] text-muted-foreground truncate">Walled garden: *.stripe.com, checkout.stripe.com</p>
                  </div>
                  <Switch checked={config.showStripe} onCheckedChange={v => update("showStripe", v)} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-medium text-foreground">🅿️ PayPal</p>
                    <p className="text-[10px] text-muted-foreground truncate">Walled garden: *.paypal.com, *.paypalobjects.com</p>
                  </div>
                  <Switch checked={config.showPaypal} onCheckedChange={v => update("showPaypal", v)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-0 space-y-3">
              <div className="rounded-xl border border-border overflow-hidden bg-secondary/30 aspect-[9/16] sm:aspect-auto sm:h-[400px]">
                <iframe
                  srcDoc={html}
                  className="w-full h-full border-0"
                  title="Captive Portal Preview"
                  sandbox="allow-scripts"
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                MikroTik variables like $(link-login-only) will work when deployed on the router
              </p>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>

      <div className="flex-shrink-0 p-3 sm:p-4 border-t border-border">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            <Button onClick={copyHTML} variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-9">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button onClick={downloadHTML} variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-9">
              <Download className="w-3.5 h-3.5" />
              .html
            </Button>
          </div>
          <Button onClick={saveAsScript} disabled={saving} size="sm" className="flex-1 gap-1.5 text-xs h-9">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "💾 Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};
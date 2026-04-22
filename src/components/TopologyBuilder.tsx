import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Trash2, Link2, Cloud, Router, Server, Wifi, Monitor,
  Workflow, Loader2, Copy, Download, Save, Sparkles, X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TopologyBuilderProps {
  onBack: () => void;
}

type DeviceType =
  | "mikrotik-router" | "mikrotik-switch" | "mikrotik-hotspot"
  | "cisco-switch" | "edgerouter"
  | "unifi-controller" | "unifi-ap" | "unifi-switch"
  | "freeradius" | "client" | "internet";

interface Device {
  id: string;
  type: DeviceType;
  name: string;
  model?: string;
  mgmtIp?: string;
  notes?: string;
}

interface Link {
  id: string;
  fromId: string;
  toId: string;
  label: string;
}

interface Vlan { id: string; vlanId: string; name: string; subnet: string; }

const PALETTE: { type: DeviceType; label: string; icon: any }[] = [
  { type: "internet", label: "Internet", icon: Cloud },
  { type: "mikrotik-router", label: "MikroTik Router", icon: Router },
  { type: "mikrotik-switch", label: "MikroTik Switch", icon: Router },
  { type: "mikrotik-hotspot", label: "MikroTik Hotspot", icon: Wifi },
  { type: "edgerouter", label: "EdgeRouter", icon: Router },
  { type: "cisco-switch", label: "Cisco Switch", icon: Router },
  { type: "unifi-controller", label: "UniFi Controller", icon: Server },
  { type: "unifi-ap", label: "UniFi AP", icon: Wifi },
  { type: "unifi-switch", label: "UniFi Switch", icon: Router },
  { type: "freeradius", label: "FreeRADIUS Server", icon: Server },
  { type: "client", label: "PC / Client", icon: Monitor },
];

const uid = () => Math.random().toString(36).slice(2, 9);

export const TopologyBuilder = ({ onBack }: TopologyBuilderProps) => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([
    { id: uid(), type: "internet", name: "Internet" },
  ]);
  const [links, setLinks] = useState<Link[]>([]);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [ispName, setIspName] = useState("");
  const [ipScheme, setIpScheme] = useState("10.10.0.0/16");
  const [vlans, setVlans] = useState<Vlan[]>([
    { id: uid(), vlanId: "10", name: "Office", subnet: "10.10.10.0/24" },
    { id: uid(), vlanId: "20", name: "Guest", subnet: "10.10.20.0/24" },
  ]);
  const [dns, setDns] = useState("1.1.1.1, 8.8.8.8");
  const [ntp, setNtp] = useState("pool.ntp.org");
  const [radiusIp, setRadiusIp] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");

  const addDevice = (type: DeviceType) => {
    const count = devices.filter(d => d.type === type).length + 1;
    const meta = PALETTE.find(p => p.type === type)!;
    const dev: Device = { id: uid(), type, name: `${meta.label} ${count}` };
    setDevices(d => [...d, dev]);
    setSelected(dev.id);
  };

  const removeDevice = (id: string) => {
    setDevices(d => d.filter(x => x.id !== id));
    setLinks(l => l.filter(x => x.fromId !== id && x.toId !== id));
    if (selected === id) setSelected(null);
  };

  const updateDevice = (id: string, patch: Partial<Device>) => {
    setDevices(d => d.map(x => x.id === id ? { ...x, ...patch } : x));
  };

  const handleLinkClick = (deviceId: string) => {
    if (!linkFrom) { setLinkFrom(deviceId); return; }
    if (linkFrom === deviceId) { setLinkFrom(null); return; }
    setLinks(l => [...l, { id: uid(), fromId: linkFrom, toId: deviceId, label: "trunk: all VLANs" }]);
    setLinkFrom(null);
  };

  const updateLink = (id: string, label: string) => {
    setLinks(l => l.map(x => x.id === id ? { ...x, label } : x));
  };

  const removeLink = (id: string) => setLinks(l => l.filter(x => x.id !== id));

  const addVlan = () => setVlans(v => [...v, { id: uid(), vlanId: "", name: "", subnet: "" }]);
  const updateVlan = (id: string, patch: Partial<Vlan>) => setVlans(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
  const removeVlan = (id: string) => setVlans(v => v.filter(x => x.id !== id));

  const buildTopologyJson = () => ({
    global: { ispName, ipScheme, vlans, dns, ntp, radiusIp },
    devices: devices.map(d => ({
      ...d,
      links: links
        .filter(l => l.fromId === d.id || l.toId === d.id)
        .map(l => {
          const otherId = l.fromId === d.id ? l.toId : l.fromId;
          const other = devices.find(x => x.id === otherId);
          return { peer: other?.name || "?", peerType: other?.type, label: l.label };
        }),
    })),
  });

  const generate = async () => {
    setGenerating(true);
    setGeneratedReply(null);
    try {
      const topology = buildTopologyJson();
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [{ role: "user", content: "Generate per-device configs for the topology I designed. One labelled script per device using the ### DEVICE: format." }],
          mode: "topology",
          topology,
          userId: user?.id,
          conversationId: null,
        },
      });
      if (error) throw error;
      setGeneratedReply(data.reply);
      const first = data.reply.match(/### DEVICE:\s*(.+)/);
      if (first) setActiveTab(first[1].trim());
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const saveTopology = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("saved_scripts").insert({
      user_id: user.id,
      title: `Topology: ${ispName || "Untitled"}`,
      category: "topology",
      script_content: generatedReply || JSON.stringify(buildTopologyJson(), null, 2),
      form_values: buildTopologyJson() as any,
    });
    if (error) toast({ title: "Save failed", variant: "destructive" });
    else toast({ title: "Topology saved" });
  };

  // Parse ### DEVICE: blocks into tabs
  const deviceBlocks = (() => {
    if (!generatedReply) return [] as { name: string; content: string }[];
    const parts = generatedReply.split(/^###\s*DEVICE:\s*/m).slice(1);
    return parts.map(p => {
      const nl = p.indexOf("\n");
      return { name: p.slice(0, nl).trim(), content: p.slice(nl + 1).trim() };
    });
  })();

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); };
  const download = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]+/gi, "_")}.rsc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedDevice = devices.find(d => d.id === selected);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-3 md:p-4 border-b border-border">
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
              <Workflow className="w-4 h-4 text-primary" /> Topology Builder
            </h2>
            <p className="text-[11px] text-muted-foreground">Design your network → generate consistent per-device configs</p>
          </div>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={generate} disabled={generating || devices.length < 2}>
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Generate
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 md:p-4 space-y-4">
          {/* Global settings */}
          <Card className="p-3 md:p-4 space-y-3">
            <h3 className="text-sm font-semibold">Global Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">ISP / Network Name</Label><Input value={ispName} onChange={e => setIspName(e.target.value)} placeholder="e.g., FastNet" className="h-9 text-sm" /></div>
              <div><Label className="text-xs">IP Scheme</Label><Input value={ipScheme} onChange={e => setIpScheme(e.target.value)} className="h-9 text-sm" /></div>
              <div><Label className="text-xs">DNS</Label><Input value={dns} onChange={e => setDns(e.target.value)} className="h-9 text-sm" /></div>
              <div><Label className="text-xs">NTP</Label><Input value={ntp} onChange={e => setNtp(e.target.value)} className="h-9 text-sm" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">RADIUS Server IP (optional)</Label><Input value={radiusIp} onChange={e => setRadiusIp(e.target.value)} placeholder="e.g., 10.10.99.10" className="h-9 text-sm" /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">VLANs</Label>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={addVlan}><Plus className="w-3 h-3" />Add</Button>
              </div>
              <div className="space-y-2">
                {vlans.map(v => (
                  <div key={v.id} className="grid grid-cols-[60px_1fr_1fr_28px] gap-2 items-center">
                    <Input value={v.vlanId} onChange={e => updateVlan(v.id, { vlanId: e.target.value })} placeholder="ID" className="h-8 text-xs" />
                    <Input value={v.name} onChange={e => updateVlan(v.id, { name: e.target.value })} placeholder="Name" className="h-8 text-xs" />
                    <Input value={v.subnet} onChange={e => updateVlan(v.id, { subnet: e.target.value })} placeholder="Subnet" className="h-8 text-xs" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeVlan(v.id)}><X className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Device palette */}
          <Card className="p-3 md:p-4">
            <h3 className="text-sm font-semibold mb-2">Add Device</h3>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map(p => (
                <Button key={p.type} variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => addDevice(p.type)}>
                  <p.icon className="w-3 h-3" /> {p.label}
                </Button>
              ))}
            </div>
          </Card>

          {/* Devices list (mobile-friendly vertical) */}
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Devices ({devices.length})</h3>
              {linkFrom && <Badge variant="secondary" className="text-[10px]">Click another device to link</Badge>}
            </div>
            <div className="space-y-2">
              {devices.map(d => {
                const meta = PALETTE.find(p => p.type === d.type)!;
                const isLinking = linkFrom === d.id;
                return (
                  <div key={d.id} className={`p-2 rounded-lg border ${isLinking ? "border-primary bg-primary/5" : selected === d.id ? "border-primary/40 bg-secondary/40" : "border-border"} `}>
                    <div className="flex items-center gap-2">
                      <meta.icon className="w-4 h-4 text-primary flex-shrink-0" />
                      <button onClick={() => setSelected(d.id === selected ? null : d.id)} className="flex-1 text-left text-sm font-medium truncate">{d.name}</button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleLinkClick(d.id)} title="Link to another device">
                        <Link2 className={`w-3 h-3 ${isLinking ? "text-primary" : ""}`} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeDevice(d.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    {selected === d.id && d.type !== "internet" && d.type !== "client" && (
                      <div className="mt-2 pt-2 border-t border-border space-y-2">
                        <Input value={d.name} onChange={e => updateDevice(d.id, { name: e.target.value })} placeholder="Device name" className="h-8 text-xs" />
                        <Input value={d.model || ""} onChange={e => updateDevice(d.id, { model: e.target.value })} placeholder="Model (e.g., hAP ac², USW-24)" className="h-8 text-xs" />
                        <Input value={d.mgmtIp || ""} onChange={e => updateDevice(d.id, { mgmtIp: e.target.value })} placeholder="Management IP" className="h-8 text-xs" />
                        <Textarea value={d.notes || ""} onChange={e => updateDevice(d.id, { notes: e.target.value })} placeholder="Role notes (e.g. WAN=ether1, LAN=bridge1, hotspot, PPPoE...)" className="text-xs min-h-[60px]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Links */}
          <Card className="p-3 md:p-4">
            <h3 className="text-sm font-semibold mb-2">Links ({links.length})</h3>
            {links.length === 0 ? (
              <p className="text-xs text-muted-foreground">Click the link icon on a device, then click another to connect.</p>
            ) : (
              <div className="space-y-2">
                {links.map(l => {
                  const a = devices.find(d => d.id === l.fromId);
                  const b = devices.find(d => d.id === l.toId);
                  return (
                    <div key={l.id} className="flex items-center gap-2 text-xs">
                      <span className="font-medium truncate flex-shrink-0 max-w-[100px]">{a?.name}</span>
                      <span className="text-muted-foreground">↔</span>
                      <span className="font-medium truncate flex-shrink-0 max-w-[100px]">{b?.name}</span>
                      <Input value={l.label} onChange={e => updateLink(l.id, e.target.value)} className="h-7 text-xs flex-1" />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLink(l.id)}><X className="w-3 h-3" /></Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Generated output */}
          {generatedReply && (
            <Card className="p-3 md:p-4">
              <div className="flex items-center justify-between mb-2 gap-2">
                <h3 className="text-sm font-semibold">Generated Configurations</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={saveTopology}>
                  <Save className="w-3 h-3" /> Save Topology
                </Button>
              </div>
              {deviceBlocks.length > 0 ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <ScrollArea className="w-full">
                    <TabsList className="h-auto flex-wrap justify-start">
                      {deviceBlocks.map(b => (
                        <TabsTrigger key={b.name} value={b.name} className="text-xs">{b.name}</TabsTrigger>
                      ))}
                    </TabsList>
                  </ScrollArea>
                  {deviceBlocks.map(b => (
                    <TabsContent key={b.name} value={b.name} className="mt-3">
                      <div className="flex gap-2 mb-2 flex-wrap">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copy(b.content)}>
                          <Copy className="w-3 h-3" /> Copy
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => download(b.name, b.content)}>
                          <Download className="w-3 h-3" /> .rsc
                        </Button>
                      </div>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.content}</ReactMarkdown>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{generatedReply}</ReactMarkdown>
                </div>
              )}
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

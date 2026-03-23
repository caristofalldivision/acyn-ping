import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Wifi, Server, Router, Globe, Shield, Terminal,
  Copy, Check, ChevronRight, Zap, Network, MonitorSpeaker
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScriptGeneratorProps {
  onSendToChat: (prompt: string) => void;
  onBack: () => void;
}

interface TemplateField {
  id: string;
  label: string;
  placeholder: string;
  type: "text" | "select" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
  helpText?: string;
}

interface Template {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: string;
  tools: string[];
  fields: TemplateField[];
  promptBuilder: (values: Record<string, string>) => string;
}

const templates: Template[] = [
  {
    id: "mikrotik-hotspot",
    title: "MikroTik Hotspot Setup",
    description: "Complete hotspot server with captive portal, user profiles, and bandwidth limits",
    icon: Wifi,
    category: "MikroTik",
    tools: ["WinBox", "Terminal/SSH"],
    fields: [
      { id: "routeros_version", label: "RouterOS Version", placeholder: "e.g., 7.14, 6.49", type: "text", required: true, helpText: "Check in WinBox: System > Resources" },
      { id: "model", label: "Device Model", placeholder: "e.g., hAP ac2, RB750Gr3, CCR1009", type: "text", required: true },
      { id: "hotspot_interface", label: "Hotspot Interface", placeholder: "e.g., ether2, wlan1, bridge1", type: "text", required: true, helpText: "The interface clients connect to" },
      { id: "wan_interface", label: "WAN/Internet Interface", placeholder: "e.g., ether1, pppoe-out1", type: "text", required: true },
      { id: "network", label: "Hotspot Network", placeholder: "e.g., 192.168.88.0/24", type: "text", required: true },
      { id: "gateway", label: "Gateway IP", placeholder: "e.g., 192.168.88.1", type: "text", required: true },
      { id: "dns", label: "DNS Server", placeholder: "e.g., 8.8.8.8, 1.1.1.1", type: "text" },
      { id: "plans", label: "Bandwidth Plans", placeholder: "e.g., Basic 2Mbps, Standard 5Mbps, Premium 10Mbps", type: "textarea", helpText: "List plans with speeds, one per line" },
      { id: "payment", label: "Payment Gateway", placeholder: "", type: "select", options: [
        { value: "none", label: "None (manual vouchers)" },
        { value: "mpesa", label: "M-Pesa (Daraja API)" },
        { value: "stripe", label: "Stripe" },
        { value: "paypal", label: "PayPal" },
      ]},
    ],
    promptBuilder: (v) => `Generate a COMPLETE, COPY-PASTE READY MikroTik hotspot configuration script for RouterOS ${v.routeros_version} on a ${v.model}.

Details:
- Hotspot interface: ${v.hotspot_interface}
- WAN interface: ${v.wan_interface}
- Network: ${v.network}
- Gateway: ${v.gateway}
- DNS: ${v.dns || "8.8.8.8, 1.1.1.1"}
- Bandwidth plans: ${v.plans || "Basic 2M/1M, Standard 5M/2M, Premium 10M/5M"}
- Payment: ${v.payment || "none"}

REQUIREMENTS:
1. Provide the EXACT CLI commands in order - user will paste directly into terminal
2. Include: IP pool, DHCP server, hotspot server, hotspot profiles with rate limits, user profiles, walled garden rules${v.payment !== "none" ? ", payment gateway integration details" : ""}
3. Include NAT/masquerade rules for internet access
4. Include DNS configuration
5. Include firewall rules to protect the router
6. Add verification commands after each section
7. Tell the user EXACTLY which tool to use (WinBox Terminal, SSH via PuTTY, or direct console)
8. Warn about any steps that will disconnect existing users
9. Format as a step-by-step guide with clear sections`
  },
  {
    id: "mikrotik-pppoe",
    title: "MikroTik PPPoE Server",
    description: "Full PPPoE server with user profiles, bandwidth management, and RADIUS",
    icon: Network,
    category: "MikroTik",
    tools: ["WinBox", "Terminal/SSH"],
    fields: [
      { id: "routeros_version", label: "RouterOS Version", placeholder: "e.g., 7.14, 6.49", type: "text", required: true },
      { id: "model", label: "Device Model", placeholder: "e.g., CCR1009, RB3011, hEX", type: "text", required: true },
      { id: "pppoe_interface", label: "PPPoE Interface", placeholder: "e.g., ether2, bridge-local", type: "text", required: true, helpText: "Interface facing clients/switches" },
      { id: "wan_interface", label: "WAN Interface", placeholder: "e.g., ether1, pppoe-out1", type: "text", required: true },
      { id: "pool_range", label: "Client IP Pool Range", placeholder: "e.g., 10.0.0.2-10.0.0.254", type: "text", required: true },
      { id: "local_ip", label: "PPPoE Server Local IP", placeholder: "e.g., 10.0.0.1", type: "text", required: true },
      { id: "plans", label: "Speed Plans", placeholder: "e.g., 5M/2M, 10M/5M, 20M/10M", type: "textarea", helpText: "Download/Upload speeds per plan" },
      { id: "radius", label: "Use RADIUS?", type: "select", placeholder: "", options: [
        { value: "no", label: "No - local PPP secrets" },
        { value: "freeradius", label: "Yes - FreeRADIUS" },
        { value: "daloradius", label: "Yes - DaloRADIUS" },
        { value: "splynx", label: "Yes - Splynx" },
      ]},
      { id: "radius_ip", label: "RADIUS Server IP (if applicable)", placeholder: "e.g., 192.168.1.100 or VPS IP", type: "text" },
    ],
    promptBuilder: (v) => `Generate a COMPLETE, COPY-PASTE READY MikroTik PPPoE server configuration for RouterOS ${v.routeros_version} on ${v.model}.

Details:
- PPPoE interface: ${v.pppoe_interface}
- WAN interface: ${v.wan_interface}
- Client IP pool: ${v.pool_range}
- Local address: ${v.local_ip}
- Speed plans: ${v.plans || "5M/2M, 10M/5M, 20M/10M"}
- RADIUS: ${v.radius || "no"}${v.radius_ip ? `, RADIUS IP: ${v.radius_ip}` : ""}

REQUIREMENTS:
1. Complete CLI script - paste directly into MikroTik terminal
2. Include: PPPoE server, PPP profiles with rate limits, IP pool, ${v.radius !== "no" ? "RADIUS client config, " : "sample PPP secrets, "}NAT masquerade, firewall rules
3. Include queue setup (simple queues or queue tree with PCQ)
4. Show how to monitor active PPPoE connections
5. Include verification commands
6. Tell user exactly which tool to use (WinBox New Terminal, SSH)
7. If RADIUS: include the RADIUS server-side setup commands too${v.radius === "freeradius" || v.radius === "daloradius" ? " (FreeRADIUS + MySQL on Ubuntu)" : ""}`
  },
  {
    id: "cisco-vlan",
    title: "Cisco Switch VLAN Setup",
    description: "VLAN configuration, trunk ports, inter-VLAN routing on Cisco switches",
    icon: MonitorSpeaker,
    category: "Cisco",
    tools: ["PuTTY/SSH", "Console Cable"],
    fields: [
      { id: "model", label: "Switch Model", placeholder: "e.g., Catalyst 2960, 3750, 9300", type: "text", required: true },
      { id: "ios_version", label: "IOS Version", placeholder: "e.g., 15.2, 16.12, 17.6", type: "text", required: true, helpText: "Check with: show version" },
      { id: "vlans", label: "VLANs to Create", placeholder: "e.g., VLAN 10 (Office) 192.168.10.0/24, VLAN 20 (Guest) 192.168.20.0/24", type: "textarea", required: true },
      { id: "trunk_ports", label: "Trunk Ports", placeholder: "e.g., Gi0/1, Gi0/2", type: "text", helpText: "Ports connecting to other switches or router" },
      { id: "access_ports", label: "Access Port Assignments", placeholder: "e.g., Fa0/1-12 = VLAN 10, Fa0/13-24 = VLAN 20", type: "textarea" },
      { id: "routing", label: "Inter-VLAN Routing", type: "select", placeholder: "", options: [
        { value: "none", label: "No routing needed" },
        { value: "svi", label: "Layer 3 Switch (SVI)" },
        { value: "router-on-stick", label: "Router-on-a-Stick (external router)" },
      ]},
      { id: "management_vlan", label: "Management VLAN & IP", placeholder: "e.g., VLAN 99, 192.168.99.1/24", type: "text" },
    ],
    promptBuilder: (v) => `Generate COMPLETE Cisco IOS configuration commands for VLAN setup on ${v.model} running IOS ${v.ios_version}.

Details:
- VLANs: ${v.vlans}
- Trunk ports: ${v.trunk_ports || "none specified"}
- Access ports: ${v.access_ports || "assign as needed"}
- Inter-VLAN routing: ${v.routing || "none"}
- Management VLAN: ${v.management_vlan || "VLAN 1 default"}

REQUIREMENTS:
1. Provide exact IOS commands - enter config mode, create VLANs, assign ports
2. Include trunk configuration with allowed VLANs
3. Include port security basics (sticky MAC, violation shutdown)
4. ${v.routing === "svi" ? "Configure SVIs for each VLAN with IP addresses and ip routing" : v.routing === "router-on-stick" ? "Show the router sub-interface configuration too" : "No routing config needed"}
5. Include spanning-tree PortFast on access ports
6. Include verification: show vlan brief, show interfaces trunk, show ip interface brief
7. Tell user to connect via Console cable + PuTTY (9600 baud) or SSH
8. Include save config command (write memory)`
  },
  {
    id: "contabo-vps",
    title: "Contabo VPS Server Setup",
    description: "Set up Ubuntu VPS for ISP management with RADIUS, billing, and monitoring",
    icon: Server,
    category: "Server",
    tools: ["PuTTY/SSH", "WinSCP", "Web Browser"],
    fields: [
      { id: "os", label: "Operating System", type: "select", placeholder: "", options: [
        { value: "ubuntu22", label: "Ubuntu 22.04 LTS" },
        { value: "ubuntu24", label: "Ubuntu 24.04 LTS" },
        { value: "debian12", label: "Debian 12" },
        { value: "centos9", label: "CentOS Stream 9" },
      ], required: true },
      { id: "vps_ip", label: "VPS Public IP", placeholder: "e.g., 185.xxx.xxx.xxx", type: "text", required: true },
      { id: "purpose", label: "Primary Purpose", type: "select", placeholder: "", options: [
        { value: "radius", label: "FreeRADIUS + DaloRADIUS (ISP billing)" },
        { value: "splynx", label: "Splynx ISP Platform" },
        { value: "mikrotik-manager", label: "MikroTik central management (The Dude)" },
        { value: "monitoring", label: "Monitoring (Grafana + InfluxDB)" },
        { value: "webserver", label: "Web Server (Nginx + SSL)" },
        { value: "custom", label: "Custom setup" },
      ], required: true },
      { id: "domain", label: "Domain Name (optional)", placeholder: "e.g., billing.myisp.com", type: "text" },
      { id: "mikrotik_ip", label: "MikroTik Router IP (if connecting)", placeholder: "e.g., public IP or VPN IP of your MikroTik", type: "text" },
      { id: "tunnel", label: "Tunnel to MikroTik?", type: "select", placeholder: "", options: [
        { value: "none", label: "No tunnel needed" },
        { value: "l2tp", label: "L2TP/IPsec tunnel" },
        { value: "gre", label: "GRE tunnel" },
        { value: "wireguard", label: "WireGuard VPN" },
      ]},
    ],
    promptBuilder: (v) => `Generate a COMPLETE server setup script for a Contabo VPS (${v.os}) at IP ${v.vps_ip}.

Purpose: ${v.purpose}
Domain: ${v.domain || "no domain yet"}
MikroTik IP: ${v.mikrotik_ip || "not specified"}
Tunnel: ${v.tunnel || "none"}

REQUIREMENTS:
1. Start with initial server hardening: update packages, create admin user, disable root SSH login, configure UFW/firewall, install fail2ban, set timezone
2. Provide ALL commands in order - user will SSH in and paste them
3. Tell user exactly: "Open PuTTY, enter IP ${v.vps_ip}, port 22, login as root with your Contabo password"
${v.purpose === "radius" ? `4. Install FreeRADIUS + MySQL/MariaDB + DaloRADIUS web interface
5. Configure Apache/Nginx for DaloRADIUS web panel
6. Set up SSL with Let's Encrypt (if domain provided)
7. Configure RADIUS clients (MikroTik NAS)
8. Create sample user accounts and test authentication
9. Show how to connect MikroTik to this RADIUS server` : ""}
${v.purpose === "monitoring" ? `4. Install InfluxDB, Grafana, and Telegraf
5. Configure Grafana dashboards for network monitoring
6. Set up SNMP polling for MikroTik devices` : ""}
${v.tunnel !== "none" ? `Include ${v.tunnel} tunnel configuration - BOTH the VPS side AND the MikroTik side commands` : ""}
Include verification steps after each major section`
  },
  {
    id: "mikrotik-firewall",
    title: "MikroTik Firewall Hardening",
    description: "Comprehensive firewall rules, NAT, and security for your MikroTik",
    icon: Shield,
    category: "MikroTik",
    tools: ["WinBox", "Terminal/SSH"],
    fields: [
      { id: "routeros_version", label: "RouterOS Version", placeholder: "e.g., 7.14, 6.49", type: "text", required: true },
      { id: "wan_interface", label: "WAN Interface", placeholder: "e.g., ether1, pppoe-out1", type: "text", required: true },
      { id: "lan_network", label: "LAN Network", placeholder: "e.g., 192.168.88.0/24", type: "text", required: true },
      { id: "services", label: "Services to Allow From WAN", placeholder: "", type: "select", options: [
        { value: "none", label: "None (block all inbound)" },
        { value: "winbox", label: "WinBox only" },
        { value: "winbox_ssh", label: "WinBox + SSH" },
        { value: "webserver", label: "Web server (80/443)" },
        { value: "custom", label: "Custom ports" },
      ]},
      { id: "custom_ports", label: "Custom Ports (if applicable)", placeholder: "e.g., 8080, 8443, 1723", type: "text" },
    ],
    promptBuilder: (v) => `Generate COMPLETE MikroTik firewall rules for RouterOS ${v.routeros_version}.

WAN interface: ${v.wan_interface}
LAN: ${v.lan_network}
WAN services: ${v.services || "none"}${v.custom_ports ? `, ports: ${v.custom_ports}` : ""}

REQUIREMENTS:
1. Complete /ip firewall filter rules (input, forward, output chains)
2. Include protection against: port scanning, brute force, DDoS, DNS amplification
3. Include NAT masquerade for internet access
4. Include address-lists for blocking/allowing
5. Add connection tracking rules (established, related, invalid)
6. Include /ip firewall raw rules for DDoS protection
7. Disable unnecessary services (/ip service)
8. Change default ports for WinBox/SSH
9. All commands copy-paste ready for terminal`
  },
  {
    id: "tplink-managed",
    title: "TP-Link Managed Switch",
    description: "VLAN, port config, and STP setup for TP-Link managed switches",
    icon: Router,
    category: "TP-Link",
    tools: ["Web Browser", "Console Cable + PuTTY"],
    fields: [
      { id: "model", label: "Switch Model", placeholder: "e.g., TL-SG3428, T2600G-28TS", type: "text", required: true },
      { id: "management_ip", label: "Management IP", placeholder: "e.g., 192.168.0.1 (default)", type: "text", required: true },
      { id: "vlans", label: "VLANs to Create", placeholder: "e.g., VLAN 10 (Data), VLAN 20 (VoIP), VLAN 30 (Guest)", type: "textarea", required: true },
      { id: "uplink_port", label: "Uplink/Trunk Port", placeholder: "e.g., Port 1 or SFP1", type: "text", required: true },
      { id: "port_assignments", label: "Port VLAN Assignments", placeholder: "e.g., Ports 2-8 = VLAN 10, Ports 9-16 = VLAN 20", type: "textarea" },
    ],
    promptBuilder: (v) => `Generate a COMPLETE configuration guide for TP-Link managed switch ${v.model}.

Management IP: ${v.management_ip}
VLANs: ${v.vlans}
Uplink: ${v.uplink_port}
Port assignments: ${v.port_assignments || "assign based on VLANs listed"}

REQUIREMENTS:
1. Provide BOTH web GUI steps (with exact menu paths and screenshots descriptions) AND CLI commands if available
2. Tell user: "Open browser, go to http://${v.management_ip}, login with admin/admin (default)"
3. Include 802.1Q VLAN configuration, PVID settings, tagged/untagged assignments
4. Configure uplink as trunk (tagged for all VLANs)
5. Enable STP (RSTP preferred) and configure root bridge priority if needed
6. Include saving configuration
7. Include verification steps`
  },
  {
    id: "ngrok-remote",
    title: "Remote Access Setup",
    description: "Set up ngrok, Tailscale, or ZeroTier for remote device management",
    icon: Globe,
    category: "Remote Access",
    tools: ["PuTTY/SSH", "ngrok", "PowerShell"],
    fields: [
      { id: "tool", label: "Remote Access Tool", type: "select", placeholder: "", options: [
        { value: "ngrok", label: "ngrok (quick tunnels)" },
        { value: "tailscale", label: "Tailscale (mesh VPN)" },
        { value: "zerotier", label: "ZeroTier (virtual network)" },
        { value: "cloudflare", label: "Cloudflare Tunnel" },
      ], required: true },
      { id: "target_device", label: "Device to Access Remotely", placeholder: "e.g., MikroTik router, Ubuntu server, Windows PC", type: "text", required: true },
      { id: "target_ip", label: "Device Local IP", placeholder: "e.g., 192.168.88.1", type: "text", required: true },
      { id: "services", label: "Services to Expose", placeholder: "e.g., WinBox (8291), SSH (22), Web UI (80)", type: "text", required: true },
      { id: "os", label: "Your Local OS", type: "select", placeholder: "", options: [
        { value: "windows", label: "Windows" },
        { value: "macos", label: "macOS" },
        { value: "linux", label: "Linux" },
      ], required: true },
    ],
    promptBuilder: (v) => `Generate a COMPLETE guide to set up remote access to ${v.target_device} at ${v.target_ip} using ${v.tool}.

Services to expose: ${v.services}
User's OS: ${v.os}

REQUIREMENTS:
1. Step-by-step installation of ${v.tool} on ${v.os}
2. Configuration to expose the specified services
3. Tell user EXACTLY which tools to download and from where (URLs)
4. ${v.tool === "ngrok" ? "Include: ngrok install, authtoken setup, tunnel command for each service, and how to get a fixed domain" : ""}
5. ${v.tool === "tailscale" ? "Include: Tailscale install on both ends, network setup, ACL configuration" : ""}
6. Include security best practices (authentication, access control)
7. Show how to connect to the remote device after setup
8. Include commands for ${v.os === "windows" ? "PowerShell" : "Terminal"}`
  },
  {
    id: "custom-config",
    title: "Custom Configuration",
    description: "Describe any network/server setup and get complete scripts",
    icon: Terminal,
    category: "Custom",
    tools: ["Varies"],
    fields: [
      { id: "description", label: "What do you want to configure?", placeholder: "Describe your setup in detail: what devices, what you want to achieve, your network layout...", type: "textarea", required: true },
      { id: "devices", label: "Devices Involved", placeholder: "e.g., MikroTik hAP ac2 (RouterOS 7.14), Cisco 2960 switch, Ubuntu 22.04 VPS", type: "textarea", required: true },
      { id: "current_setup", label: "Current Network Setup (if any)", placeholder: "Describe what's already configured, IP ranges in use, etc.", type: "textarea" },
      { id: "experience", label: "Your Experience Level", type: "select", placeholder: "", options: [
        { value: "beginner", label: "Beginner - explain everything" },
        { value: "intermediate", label: "Intermediate - know basics" },
        { value: "advanced", label: "Advanced - just give me the commands" },
      ]},
    ],
    promptBuilder: (v) => `Generate a COMPLETE configuration guide for this setup:

${v.description}

Devices: ${v.devices}
Current setup: ${v.current_setup || "fresh/new setup"}
Experience level: ${v.experience || "beginner"}

REQUIREMENTS:
1. Provide complete, copy-paste ready scripts for EVERY device mentioned
2. Tell the user exactly which tool to use for each device (WinBox, PuTTY, SSH, Console, Web Browser, PowerShell, etc.)
3. Include download links for any required tools
4. ${v.experience === "beginner" ? "Explain each command and what it does. Include screenshots descriptions where helpful." : ""}
5. Include verification and testing commands after each section
6. Warn about any steps that could cause downtime
7. Include backup commands before making changes
8. Format as a numbered step-by-step guide with clear device labels`
  },
];

const categories = ["All", "MikroTik", "Cisco", "Server", "TP-Link", "Remote Access", "Custom"];

export const ScriptGenerator = ({ onSendToChat, onBack }: ScriptGeneratorProps) => {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredTemplates = selectedCategory === "All"
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleGenerate = () => {
    if (!selectedTemplate) return;
    const missing = selectedTemplate.fields
      .filter(f => f.required && !formValues[f.id]?.trim())
      .map(f => f.label);
    
    if (missing.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please fill in: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    const prompt = selectedTemplate.promptBuilder(formValues);
    onSendToChat(prompt);
    setSelectedTemplate(null);
    setFormValues({});
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Template selection view
  if (!selectedTemplate) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-4 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Script Generator</h2>
              <p className="text-xs text-muted-foreground">Fill in your details, get copy-paste ready scripts</p>
            </div>
          </div>
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {filteredTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => { setSelectedTemplate(template); setFormValues({}); }}
                className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-secondary/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <template.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground text-sm">{template.title}</h3>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {template.tools.map(tool => (
                        <Badge key={tool} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Form view
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setSelectedTemplate(null); setFormValues({}); }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">{selectedTemplate.title}</h2>
            <div className="flex gap-1.5 mt-0.5">
              {selectedTemplate.tools.map(tool => (
                <Badge key={tool} variant="outline" className="text-[10px] px-1.5 py-0">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">How it works</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Fill in your device details below. Topha will generate complete, copy-paste ready scripts
              and tell you exactly which tools to use.
            </p>
          </div>

          {selectedTemplate.fields.map(field => (
            <div key={field.id} className="space-y-1.5">
              <Label className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {field.helpText && (
                <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
              )}
              {field.type === "text" && (
                <Input
                  value={formValues[field.id] || ""}
                  onChange={e => handleFieldChange(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className="h-9 text-sm"
                />
              )}
              {field.type === "textarea" && (
                <Textarea
                  value={formValues[field.id] || ""}
                  onChange={e => handleFieldChange(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="text-sm resize-none"
                />
              )}
              {field.type === "select" && field.options && (
                <Select value={formValues[field.id] || ""} onValueChange={v => handleFieldChange(field.id, v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex-shrink-0 p-4 border-t border-border">
        <Button onClick={handleGenerate} className="w-full gap-2">
          <Terminal className="w-4 h-4" />
          Generate Scripts
        </Button>
      </div>
    </div>
  );
};

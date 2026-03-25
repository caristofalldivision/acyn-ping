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
  Copy, Check, ChevronRight, Zap, Network, MonitorSpeaker, CreditCard, Lock, Radio
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScriptGeneratorProps {
  onSendToChat: (prompt: string) => void;
  onBack: () => void;
  onOpenSaved?: () => void;
  onOpenPortalBuilder?: () => void;
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
  // === NEW: Complete ISP Hotspot Business ===
  {
    id: "isp-hotspot-business",
    title: "Complete ISP Hotspot Business",
    description: "Full hotspot business: IP setup, DHCP, hotspot server, captive portal, billing, payments, walled garden, NAT, firewall, user management - everything",
    icon: CreditCard,
    category: "ISP Business",
    tools: ["WinBox", "Terminal/SSH", "Web Browser"],
    fields: [
      { id: "routeros_version", label: "RouterOS Version", placeholder: "e.g., 7.14, 6.49", type: "text", required: true, helpText: "System > Resources in WinBox" },
      { id: "model", label: "MikroTik Model", placeholder: "e.g., hAP ac2, RB750Gr3, CCR1009", type: "text", required: true },
      { id: "wan_interface", label: "WAN/Internet Interface", placeholder: "e.g., ether1", type: "text", required: true },
      { id: "hotspot_interface", label: "Hotspot Interface (clients connect here)", placeholder: "e.g., ether2, wlan1, bridge1", type: "text", required: true },
      { id: "network", label: "Hotspot Network Range", placeholder: "e.g., 192.168.88.0/24", type: "text", required: true },
      { id: "gateway", label: "Gateway IP", placeholder: "e.g., 192.168.88.1", type: "text", required: true },
      { id: "isp_name", label: "Your ISP/Business Name", placeholder: "e.g., FastNet WiFi", type: "text", required: true },
      { id: "plans", label: "Bandwidth Plans (name, speed, price, duration)", placeholder: "e.g.,\n1hr - 2Mbps - KES 20\n24hr - 5Mbps - KES 100\nWeekly - 10Mbps - KES 500\nMonthly - 10Mbps - KES 1500", type: "textarea", required: true, helpText: "One plan per line: name - speed - price - duration" },
      { id: "payment", label: "Payment Method", type: "select", placeholder: "", options: [
        { value: "voucher", label: "Manual Vouchers (print & sell)" },
        { value: "mpesa", label: "M-Pesa (auto-activate on payment)" },
        { value: "stripe", label: "Stripe (card payments)" },
        { value: "paypal", label: "PayPal" },
      ], required: true },
      { id: "radius", label: "Use RADIUS for billing?", type: "select", placeholder: "", options: [
        { value: "no", label: "No - MikroTik local users (simpler)" },
        { value: "yes", label: "Yes - FreeRADIUS + DaloRADIUS on VPS" },
      ]},
      { id: "radius_ip", label: "RADIUS Server IP (if using RADIUS)", placeholder: "e.g., VPS IP", type: "text" },
      { id: "dns", label: "DNS Servers", placeholder: "e.g., 8.8.8.8, 1.1.1.1", type: "text" },
    ],
    promptBuilder: (v) => `I need a COMPLETE ISP hotspot business setup on my MikroTik ${v.model} running RouterOS ${v.routeros_version}. Give me EVERYTHING step by step - I should be able to start selling internet access after following your guide.

My details:
- WAN interface: ${v.wan_interface}
- Hotspot interface: ${v.hotspot_interface}
- Network: ${v.network}
- Gateway: ${v.gateway}
- Business name: ${v.isp_name}
- DNS: ${v.dns || "8.8.8.8, 1.1.1.1"}
- Payment method: ${v.payment}
${v.radius === "yes" ? `- RADIUS server: ${v.radius_ip || "need VPS setup too"}` : "- Using local MikroTik user management"}

My bandwidth plans:
${v.plans}

I need EVERYTHING configured:
1. IP addressing and DHCP server
2. Hotspot server with captive portal
3. User profiles for EACH plan with exact rate limits matching my plans above
4. ${v.payment === "voucher" ? "Voucher generation script to create batches of vouchers for each plan" : `Walled garden rules for ${v.payment} payment pages so users can pay before login`}
5. Custom captive portal login page with my business name "${v.isp_name}" ${v.payment !== "voucher" ? `and ${v.payment} payment button` : ""}
6. NAT/masquerade for internet access
7. Firewall rules to protect the router
8. Queue setup (PCQ for fair bandwidth distribution)
9. ${v.radius === "yes" ? "RADIUS client config on MikroTik + full FreeRADIUS server setup on the VPS" : "Local user management"}
10. Session management (idle timeout, keepalive)
11. Monitoring: how to see active users, bandwidth usage, connected clients

Give me copy-paste ready commands for each step. Start with Step 1 and wait for me to confirm before moving to the next step.`
  },

  // === NEW: Complete PPPoE ISP Business ===
  {
    id: "isp-pppoe-business",
    title: "Complete PPPoE ISP Business",
    description: "Full PPPoE ISP: server setup, user profiles, queues, RADIUS billing, monitoring, customer management - complete business solution",
    icon: Network,
    category: "ISP Business",
    tools: ["WinBox", "Terminal/SSH", "PuTTY"],
    fields: [
      { id: "routeros_version", label: "RouterOS Version", placeholder: "e.g., 7.14, 6.49", type: "text", required: true },
      { id: "model", label: "MikroTik Model", placeholder: "e.g., CCR1009, RB3011, hEX S", type: "text", required: true },
      { id: "wan_interface", label: "WAN Interface", placeholder: "e.g., ether1", type: "text", required: true },
      { id: "pppoe_interface", label: "PPPoE Client Interface", placeholder: "e.g., ether2, bridge-local", type: "text", required: true, helpText: "Interface facing your clients/switches" },
      { id: "pool_range", label: "Client IP Pool", placeholder: "e.g., 10.0.0.2-10.0.0.254", type: "text", required: true },
      { id: "local_ip", label: "PPPoE Server Local IP", placeholder: "e.g., 10.0.0.1", type: "text", required: true },
      { id: "isp_name", label: "ISP Business Name", placeholder: "e.g., SpeedNet ISP", type: "text", required: true },
      { id: "plans", label: "Speed Plans (name, download/upload, price)", placeholder: "e.g.,\nBasic - 5M/2M - KES 1500/month\nStandard - 10M/5M - KES 2500/month\nPremium - 20M/10M - KES 4000/month\nBusiness - 50M/25M - KES 8000/month", type: "textarea", required: true },
      { id: "radius", label: "Billing System", type: "select", placeholder: "", options: [
        { value: "local", label: "Local PPP secrets (small scale)" },
        { value: "daloradius", label: "FreeRADIUS + DaloRADIUS (recommended)" },
        { value: "splynx", label: "Splynx (commercial ISP platform)" },
      ], required: true },
      { id: "radius_ip", label: "Billing Server IP", placeholder: "e.g., VPS public IP", type: "text" },
      { id: "queue_type", label: "Queue Method", type: "select", placeholder: "", options: [
        { value: "simple", label: "Simple Queues (easier)" },
        { value: "pcq", label: "Queue Tree + PCQ (better for many users)" },
      ]},
    ],
    promptBuilder: (v) => `Set up a COMPLETE PPPoE ISP business on my MikroTik ${v.model} running RouterOS ${v.routeros_version}. I need everything to run an ISP.

Details:
- WAN: ${v.wan_interface}
- PPPoE client-facing interface: ${v.pppoe_interface}
- Client IP pool: ${v.pool_range}
- Server local IP: ${v.local_ip}
- ISP name: ${v.isp_name}
- Billing: ${v.radius}${v.radius_ip ? ` at ${v.radius_ip}` : ""}
- Queue method: ${v.queue_type || "pcq"}

Speed plans:
${v.plans}

Configure EVERYTHING:
1. PPPoE server with service name "${v.isp_name}"
2. PPP profiles for EACH plan with exact rate limits
3. IP pool configuration
4. ${v.radius !== "local" ? `RADIUS client on MikroTik + complete ${v.radius === "daloradius" ? "FreeRADIUS + DaloRADIUS" : "Splynx"} server setup` : "Sample PPP secrets for testing"}
5. ${v.queue_type === "pcq" ? "Queue tree with PCQ for fair bandwidth" : "Simple queues per PPP profile"}
6. NAT masquerade for internet
7. Firewall rules (protect router, allow PPPoE)
8. DNS configuration
9. Monitoring: active connections, bandwidth per user, disconnecting users
10. Accounting and session management

Step by step please. Start with Step 1.`
  },

  // === NEW: RADIUS Server + Billing ===
  {
    id: "radius-billing",
    title: "RADIUS Server + Billing",
    description: "Complete FreeRADIUS + DaloRADIUS setup on VPS with MikroTik integration, user groups, bandwidth profiles",
    icon: Radio,
    category: "ISP Business",
    tools: ["PuTTY/SSH", "WinSCP", "Web Browser"],
    fields: [
      { id: "os", label: "VPS Operating System", type: "select", placeholder: "", options: [
        { value: "ubuntu22", label: "Ubuntu 22.04 LTS" },
        { value: "ubuntu24", label: "Ubuntu 24.04 LTS" },
        { value: "debian12", label: "Debian 12" },
      ], required: true },
      { id: "vps_ip", label: "VPS Public IP", placeholder: "e.g., 185.xxx.xxx.xxx", type: "text", required: true },
      { id: "domain", label: "Domain for Web Panel (optional)", placeholder: "e.g., billing.myisp.com", type: "text" },
      { id: "nas_ip", label: "MikroTik NAS IP", placeholder: "e.g., your MikroTik public IP", type: "text", required: true, helpText: "The IP your MikroTik uses to reach this VPS" },
      { id: "radius_secret", label: "RADIUS Shared Secret", placeholder: "e.g., MySecretKey123", type: "text", required: true, helpText: "A password shared between MikroTik and RADIUS server" },
      { id: "service_type", label: "Service Type", type: "select", placeholder: "", options: [
        { value: "hotspot", label: "Hotspot users" },
        { value: "pppoe", label: "PPPoE users" },
        { value: "both", label: "Both Hotspot + PPPoE" },
      ], required: true },
      { id: "plans", label: "Bandwidth Plans", placeholder: "e.g.,\n1hr-2Mbps\n24hr-5Mbps\n5M-monthly\n10M-monthly", type: "textarea", required: true },
      { id: "mikrotik_version", label: "MikroTik RouterOS Version", placeholder: "e.g., 7.14", type: "text", required: true },
    ],
    promptBuilder: (v) => `Set up a COMPLETE RADIUS billing server on my VPS (${v.os}, IP: ${v.vps_ip}) and connect it to my MikroTik (RouterOS ${v.mikrotik_version}).

Details:
- Domain: ${v.domain || "no domain, use IP"}
- MikroTik NAS IP: ${v.nas_ip}
- RADIUS secret: ${v.radius_secret}
- Service type: ${v.service_type}
- Plans: ${v.plans}

I need EVERYTHING:
1. VPS initial hardening (updates, firewall, fail2ban)
2. Install MariaDB + create radius database
3. Install FreeRADIUS + MySQL module
4. Configure FreeRADIUS: clients.conf (add MikroTik as NAS), SQL module, authorize/authenticate
5. Install DaloRADIUS web panel with Apache + PHP
6. ${v.domain ? `SSL with Let's Encrypt for ${v.domain}` : "Access via http://VPS_IP/daloradius"}
7. Create user groups for each plan with Mikrotik-Rate-Limit attributes
8. Create sample users in each group
9. Test authentication with radtest
10. MikroTik side: configure RADIUS client, enable RADIUS for ${v.service_type}
11. Verify end-to-end: user connects > RADIUS authenticates > bandwidth limit applied

Step by step. Start with Step 1.`
  },

  // === NEW: WireGuard VPN Tunnel ===
  {
    id: "wireguard-tunnel",
    title: "WireGuard VPN Tunnel",
    description: "Secure tunnel between MikroTik and VPS - for RADIUS traffic, remote management, or routing",
    icon: Lock,
    category: "VPN",
    tools: ["WinBox", "Terminal/SSH", "PuTTY"],
    fields: [
      { id: "routeros_version", label: "MikroTik RouterOS Version", placeholder: "e.g., 7.14 (must be v7+)", type: "text", required: true, helpText: "WireGuard requires RouterOS 7+" },
      { id: "mikrotik_ip", label: "MikroTik Public IP", placeholder: "e.g., 41.xxx.xxx.xxx or dynamic", type: "text", required: true },
      { id: "vps_ip", label: "VPS Public IP", placeholder: "e.g., 185.xxx.xxx.xxx", type: "text", required: true },
      { id: "tunnel_subnet", label: "Tunnel Subnet", placeholder: "e.g., 10.10.10.0/30", type: "text", required: true, helpText: "Private IPs for the tunnel endpoints" },
      { id: "vps_os", label: "VPS Operating System", type: "select", placeholder: "", options: [
        { value: "ubuntu22", label: "Ubuntu 22.04" },
        { value: "ubuntu24", label: "Ubuntu 24.04" },
        { value: "debian12", label: "Debian 12" },
      ], required: true },
      { id: "purpose", label: "Tunnel Purpose", type: "select", placeholder: "", options: [
        { value: "radius", label: "RADIUS traffic (billing server on VPS)" },
        { value: "management", label: "Remote management of MikroTik" },
        { value: "route_traffic", label: "Route all client traffic through VPS" },
        { value: "site_to_site", label: "Site-to-site (connect two networks)" },
      ], required: true },
      { id: "lan_behind_mikrotik", label: "LAN Network Behind MikroTik", placeholder: "e.g., 192.168.88.0/24", type: "text" },
    ],
    promptBuilder: (v) => `Set up a WireGuard VPN tunnel between my MikroTik (RouterOS ${v.routeros_version}, IP: ${v.mikrotik_ip}) and my VPS (${v.vps_os}, IP: ${v.vps_ip}).

Tunnel subnet: ${v.tunnel_subnet}
Purpose: ${v.purpose}
${v.lan_behind_mikrotik ? `LAN behind MikroTik: ${v.lan_behind_mikrotik}` : ""}

I need BOTH sides configured:
1. VPS side: install WireGuard, generate keys, create wg0.conf, enable service
2. MikroTik side: create WireGuard interface, generate keys, add peer, assign IP
3. Exchange public keys between both sides
4. IP addressing on the tunnel
5. ${v.purpose === "radius" ? "Routing so RADIUS traffic goes through the tunnel" : v.purpose === "route_traffic" ? "NAT on VPS + routing all MikroTik client traffic through VPS" : v.purpose === "management" ? "Allow WinBox/SSH access to MikroTik through tunnel" : "Routes for both LANs to reach each other"}
6. Firewall rules on both sides to allow tunnel traffic
7. Verification: ping through tunnel, test connectivity
8. Make it persistent (survive reboots on both sides)

Step by step. Start with Step 1.`
  },

  // === EXISTING TEMPLATES (reordered) ===
  {
    id: "mikrotik-hotspot",
    title: "MikroTik Hotspot Setup",
    description: "Hotspot server with captive portal, user profiles, and bandwidth limits",
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
    promptBuilder: (v) => `Generate a COMPLETE MikroTik hotspot configuration for RouterOS ${v.routeros_version} on ${v.model}.

Details:
- Hotspot interface: ${v.hotspot_interface}
- WAN: ${v.wan_interface}
- Network: ${v.network}, Gateway: ${v.gateway}
- DNS: ${v.dns || "8.8.8.8, 1.1.1.1"}
- Plans: ${v.plans || "Basic 2M/1M, Standard 5M/2M, Premium 10M/5M"}
- Payment: ${v.payment || "none"}

Include: IP pool, DHCP, hotspot server, profiles with rate limits, user profiles, walled garden${v.payment !== "none" ? `, ${v.payment} payment integration` : ""}, NAT, DNS, firewall, verification commands. Step by step, start with Step 1.`
  },
  {
    id: "mikrotik-pppoe",
    title: "MikroTik PPPoE Server",
    description: "PPPoE server with user profiles, bandwidth management, and RADIUS",
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
      { id: "radius_ip", label: "RADIUS Server IP", placeholder: "e.g., 192.168.1.100 or VPS IP", type: "text" },
    ],
    promptBuilder: (v) => `Generate a COMPLETE MikroTik PPPoE server configuration for RouterOS ${v.routeros_version} on ${v.model}.

Details:
- PPPoE interface: ${v.pppoe_interface}, WAN: ${v.wan_interface}
- Client IP pool: ${v.pool_range}, Local: ${v.local_ip}
- Plans: ${v.plans || "5M/2M, 10M/5M, 20M/10M"}
- RADIUS: ${v.radius || "no"}${v.radius_ip ? `, IP: ${v.radius_ip}` : ""}

Include: PPPoE server, PPP profiles with rate limits, IP pool, ${v.radius !== "no" ? "RADIUS client + server setup, " : "sample PPP secrets, "}NAT, firewall, queue setup, monitoring. Step by step, start with Step 1.`
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
      { id: "trunk_ports", label: "Trunk Ports", placeholder: "e.g., Gi0/1, Gi0/2", type: "text" },
      { id: "access_ports", label: "Access Port Assignments", placeholder: "e.g., Fa0/1-12 = VLAN 10, Fa0/13-24 = VLAN 20", type: "textarea" },
      { id: "routing", label: "Inter-VLAN Routing", type: "select", placeholder: "", options: [
        { value: "none", label: "No routing needed" },
        { value: "svi", label: "Layer 3 Switch (SVI)" },
        { value: "router-on-stick", label: "Router-on-a-Stick" },
      ]},
      { id: "management_vlan", label: "Management VLAN & IP", placeholder: "e.g., VLAN 99, 192.168.99.1/24", type: "text" },
    ],
    promptBuilder: (v) => `Generate COMPLETE Cisco IOS VLAN config for ${v.model} running IOS ${v.ios_version}.

VLANs: ${v.vlans}
Trunks: ${v.trunk_ports || "none"}, Access: ${v.access_ports || "assign as needed"}
Routing: ${v.routing || "none"}, Mgmt VLAN: ${v.management_vlan || "default"}

Include: VLAN creation, port assignments, trunk config, port security, ${v.routing === "svi" ? "SVIs with ip routing" : v.routing === "router-on-stick" ? "router sub-interfaces" : "no routing"}, STP PortFast, verification commands. Step by step, start with Step 1.`
  },
  {
    id: "contabo-vps",
    title: "Contabo VPS Server Setup",
    description: "VPS setup for ISP management with RADIUS, billing, and monitoring",
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
        { value: "radius", label: "FreeRADIUS + DaloRADIUS" },
        { value: "splynx", label: "Splynx ISP Platform" },
        { value: "mikrotik-manager", label: "MikroTik central management" },
        { value: "monitoring", label: "Monitoring (Grafana + InfluxDB)" },
        { value: "webserver", label: "Web Server (Nginx + SSL)" },
        { value: "custom", label: "Custom setup" },
      ], required: true },
      { id: "domain", label: "Domain Name (optional)", placeholder: "e.g., billing.myisp.com", type: "text" },
      { id: "mikrotik_ip", label: "MikroTik Router IP", placeholder: "e.g., public IP of MikroTik", type: "text" },
      { id: "tunnel", label: "Tunnel to MikroTik?", type: "select", placeholder: "", options: [
        { value: "none", label: "No tunnel needed" },
        { value: "l2tp", label: "L2TP/IPsec" },
        { value: "gre", label: "GRE tunnel" },
        { value: "wireguard", label: "WireGuard VPN" },
      ]},
    ],
    promptBuilder: (v) => `Set up my Contabo VPS (${v.os}) at ${v.vps_ip} for ${v.purpose}.

Domain: ${v.domain || "no domain"}
MikroTik: ${v.mikrotik_ip || "not specified"}
Tunnel: ${v.tunnel || "none"}

Start with server hardening, then install and configure everything needed for ${v.purpose}. ${v.tunnel !== "none" ? `Include ${v.tunnel} tunnel setup on BOTH VPS and MikroTik sides.` : ""} Step by step, start with Step 1.`
  },
  {
    id: "mikrotik-firewall",
    title: "MikroTik Firewall Hardening",
    description: "Comprehensive firewall rules, NAT, and security",
    icon: Shield,
    category: "MikroTik",
    tools: ["WinBox", "Terminal/SSH"],
    fields: [
      { id: "routeros_version", label: "RouterOS Version", placeholder: "e.g., 7.14, 6.49", type: "text", required: true },
      { id: "wan_interface", label: "WAN Interface", placeholder: "e.g., ether1, pppoe-out1", type: "text", required: true },
      { id: "lan_network", label: "LAN Network", placeholder: "e.g., 192.168.88.0/24", type: "text", required: true },
      { id: "services", label: "Services to Allow From WAN", type: "select", placeholder: "", options: [
        { value: "none", label: "None (block all inbound)" },
        { value: "winbox", label: "WinBox only" },
        { value: "winbox_ssh", label: "WinBox + SSH" },
        { value: "webserver", label: "Web server (80/443)" },
        { value: "custom", label: "Custom ports" },
      ]},
      { id: "custom_ports", label: "Custom Ports", placeholder: "e.g., 8080, 8443, 1723", type: "text" },
    ],
    promptBuilder: (v) => `Generate COMPLETE MikroTik firewall rules for RouterOS ${v.routeros_version}.

WAN: ${v.wan_interface}, LAN: ${v.lan_network}
Allow from WAN: ${v.services || "none"}${v.custom_ports ? `, ports: ${v.custom_ports}` : ""}

Include: filter rules (input/forward/output), DDoS/brute force protection, NAT masquerade, address-lists, connection tracking, raw rules, disable unnecessary services, change default ports. Step by step, start with Step 1.`
  },
  {
    id: "tplink-managed",
    title: "TP-Link Managed Switch",
    description: "VLAN, port config, and STP setup for TP-Link switches",
    icon: Router,
    category: "TP-Link",
    tools: ["Web Browser", "Console Cable + PuTTY"],
    fields: [
      { id: "model", label: "Switch Model", placeholder: "e.g., TL-SG3428, T2600G-28TS", type: "text", required: true },
      { id: "management_ip", label: "Management IP", placeholder: "e.g., 192.168.0.1", type: "text", required: true },
      { id: "vlans", label: "VLANs to Create", placeholder: "e.g., VLAN 10 (Data), VLAN 20 (VoIP)", type: "textarea", required: true },
      { id: "uplink_port", label: "Uplink/Trunk Port", placeholder: "e.g., Port 1 or SFP1", type: "text", required: true },
      { id: "port_assignments", label: "Port VLAN Assignments", placeholder: "e.g., Ports 2-8 = VLAN 10", type: "textarea" },
    ],
    promptBuilder: (v) => `Configure my TP-Link ${v.model} managed switch at ${v.management_ip}.

VLANs: ${v.vlans}
Uplink: ${v.uplink_port}
Ports: ${v.port_assignments || "assign based on VLANs"}

Include BOTH web GUI steps (exact menu paths) AND CLI commands. Configure 802.1Q VLANs, PVID, trunk, RSTP, save config. Step by step, start with Step 1.`
  },
  {
    id: "ngrok-remote",
    title: "Remote Access Setup",
    description: "ngrok, Tailscale, or ZeroTier for remote device management",
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
      { id: "target_device", label: "Device to Access", placeholder: "e.g., MikroTik router, Ubuntu server", type: "text", required: true },
      { id: "target_ip", label: "Device Local IP", placeholder: "e.g., 192.168.88.1", type: "text", required: true },
      { id: "services", label: "Services to Expose", placeholder: "e.g., WinBox (8291), SSH (22)", type: "text", required: true },
      { id: "os", label: "Your Local OS", type: "select", placeholder: "", options: [
        { value: "windows", label: "Windows" },
        { value: "macos", label: "macOS" },
        { value: "linux", label: "Linux" },
      ], required: true },
    ],
    promptBuilder: (v) => `Set up remote access to ${v.target_device} at ${v.target_ip} using ${v.tool}.

Services: ${v.services}
My OS: ${v.os}

Include: installation, configuration, security, and how to connect after setup. Step by step, start with Step 1.`
  },
  {
    id: "custom-config",
    title: "Custom Configuration",
    description: "Describe any setup and get complete scripts",
    icon: Terminal,
    category: "Custom",
    tools: ["Varies"],
    fields: [
      { id: "description", label: "What do you want to configure?", placeholder: "Describe your setup in detail...", type: "textarea", required: true },
      { id: "devices", label: "Devices Involved", placeholder: "e.g., MikroTik hAP ac2 (RouterOS 7.14), Cisco 2960", type: "textarea", required: true },
      { id: "current_setup", label: "Current Setup (if any)", placeholder: "What's already configured?", type: "textarea" },
      { id: "experience", label: "Experience Level", type: "select", placeholder: "", options: [
        { value: "beginner", label: "Beginner - explain everything" },
        { value: "intermediate", label: "Intermediate" },
        { value: "advanced", label: "Advanced - just commands" },
      ]},
    ],
    promptBuilder: (v) => `Configure this setup: ${v.description}

Devices: ${v.devices}
Current: ${v.current_setup || "fresh setup"}
Level: ${v.experience || "beginner"}

Complete copy-paste scripts for every device. Tell me which tools to use. ${v.experience === "beginner" ? "Explain each command." : ""} Step by step, start with Step 1.`
  },
];

const categories = ["All", "ISP Business", "MikroTik", "Cisco", "VPN", "Server", "TP-Link", "Remote Access", "Custom"];

export const ScriptGenerator = ({ onSendToChat, onBack, onOpenSaved, onOpenPortalBuilder }: ScriptGeneratorProps) => {
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
              and guide you step by step - one step at a time.
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

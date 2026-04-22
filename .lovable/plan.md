

# UniFi Knowledge, Topology Builder & Smarter Scripting

Three improvements grouped together:

## 1. Fix the AI's scripting weakness (highest impact)

The current chat function uses Gemini 2.5 Flash with a 400-line system prompt that forces step-by-step delivery on every request. That's why simple asks like "give me a walled garden script" come back as a 4-step interrogation instead of a script.

**Changes to `supabase/functions/chat/index.ts`:**

- **Upgrade model** from `google/gemini-2.5-flash` to `google/gemini-2.5-pro` for chat (better at long-context technical reasoning and producing accurate, complete scripts). Keep Flash as fallback if Pro is rate-limited.
- **Refactor delivery rules** so step-by-step is opt-in, not mandatory:
  - If the user asks a small/specific thing ("walled garden for M-Pesa", "block YouTube", "show me the firewall rules") → answer with the complete script in one message, no interrogation.
  - Step-by-step mode only triggers for complete end-to-end builds (full hotspot, full PPPoE ISP, full RADIUS server) OR when the user explicitly asks "walk me through it".
  - Add explicit examples in the prompt of "give immediate full answer" vs "use step-by-step" cases.
- **Add ready-made script library** to the system prompt - copy-paste blocks the AI can lift directly when asked common things:
  - Walled garden: M-Pesa, Stripe, PayPal, Airtel Money, Flutterwave (full domain lists)
  - Hotspot end-to-end: one-shot script using `/ip hotspot setup` style commands
  - Block social media / streaming / adult content via Layer7 + DNS
  - PPPoE server one-shot
  - Common firewall hardening one-shot
  - DHCP server one-shot
  - WiFi setup one-shot (v6 wireless + v7 wifi)
- **Smart-defaults rule**: when the user gives partial info, the AI should use clearly-labelled placeholders (`<YOUR_WAN_INTERFACE>` etc.) and a one-line "replace these:" callout instead of refusing to answer until every field is filled. Only ask if truly ambiguous (router model affects syntax).
- **Tighten honesty rule**: still no fabricated facts, but stop blocking responses behind "what's your version" when v6/v7 syntax differences are minor — provide both inline.

## 2. Ubiquiti / UniFi expertise

Add a new section to the system prompt (`supabase/functions/chat/index.ts`):

- **EdgeRouter (EdgeOS, Vyatta-based):** `configure` mode, `set/delete/commit/save`, `show configuration`, interfaces eth0–ethN, firewall rule sets (in/out/local), NAT masquerade, DHCP server, hairpin NAT, PPPoE WAN, OSPF/BGP basics, common gotchas (`commit-confirm`, offloading hardware NAT/IPsec).
- **UniFi Switches (USW):** managed via UniFi Network Controller (cloud or self-hosted), VLAN profiles, port profiles (Access/Trunk), tagged/untagged networks, link aggregation (LAG), PoE per-port control, jumbo frames, storm control, STP/RSTP, mirror ports. Also CLI fallback via SSH (`telnet localhost`, vyatta-style or busybox depending on model).
- **UniFi APs (UAP/U6/U7):** SSID + WLAN groups, RADIUS profiles, dynamic VLAN, fast roaming (802.11r/k/v), band steering, minimum RSSI, broadcast filtering, guest portal with hotspot manager + payments (PayPal, Stripe, authorize.net), bandwidth profiles, adoption flow (`set-inform`, SSH `info`).
- **UniFi Controller setup:** self-hosted on Ubuntu (`apt` repo), site management, backup/restore, controller migration, custom config via `config.gateway.json` for USG/UDM advanced rules.
- **Common integration patterns:** UniFi APs + MikroTik router, UniFi switches + RouterOS, EdgeRouter + UniFi APs, hand-off scenarios.
- **Ready-made scripts:** EdgeRouter PPPoE WAN + DHCP LAN, UniFi guest portal walled garden, UniFi RADIUS auth via FreeRADIUS, AP standalone provisioning when no controller.

Add new templates to `src/components/ScriptGenerator.tsx`:
- **EdgeRouter Home/Office Setup** (PPPoE/DHCP WAN, LAN, firewall, port forward)
- **UniFi Switch VLAN Configuration** (via controller JSON)
- **UniFi Guest Hotspot with Payments**
- **UniFi Site-to-Site VPN** (auto IPsec)

## 3. Network Topology Diagram Builder

A new visual canvas where the user drags devices, draws links between them, fills basic per-device fields, and gets one auto-generated config bundle per device — all consistent (matching VLANs, IPs, trunk ports, etc.).

**New component:** `src/components/TopologyBuilder.tsx`

- **Canvas:** simple grid using HTML/SVG (no heavy library). Click-to-add devices from a palette: MikroTik Router, MikroTik Switch, Cisco Switch, UniFi Controller, UniFi AP, UniFi Switch, EdgeRouter, FreeRADIUS Server, MikroTik Hotspot, PCs/Clients, Internet cloud.
- **Connect devices:** click one device's port, then another's port, to draw a link. Link gets a label (e.g., "trunk: VLAN 10,20" or "access: VLAN 30").
- **Per-device side panel** (opens on click): name, model, mgmt IP, interfaces auto-listed from links, role-specific fields (e.g., for MikroTik: WAN iface, LAN iface, hotspot? PPPoE?; for UniFi AP: SSIDs, VLAN per SSID).
- **Global settings panel:** ISP name, IP scheme (e.g., 10.10.0.0/16), VLAN list with names + subnets, DNS, NTP, RADIUS server IP if any.
- **"Generate All Configs" button:** sends the topology JSON to the chat edge function with a special prompt that instructs the AI to return one labelled script per device, all consistent. Output displays as tabs (one tab per device) with copy / download .rsc / save buttons.
- **Save topology:** stored as a saved_script with `category = 'topology'` and `form_values` = topology JSON, so the user can reload and edit later.
- **Mobile responsive:** on small screens canvas becomes a vertical list view of devices + links instead of free-form drag.

**Entry points:**
- New button in `ScriptGenerator.tsx` header: "Topology Builder" alongside "Saved Scripts" and "Portal Builder".
- Suggestion chip in `ChatInterface.tsx`: "Design my network".

**No DB changes** — reuses the existing `saved_scripts` table.

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Switch model to gemini-2.5-pro, refactor step-by-step rules to be opt-in, add ready-made script library, add full UniFi/EdgeRouter knowledge section, add topology-builder prompt mode |
| `src/components/ScriptGenerator.tsx` | Add 4 UniFi/EdgeRouter templates, add Topology Builder button |
| `src/components/TopologyBuilder.tsx` (NEW) | Visual topology canvas + per-device generator |
| `src/components/ChatInterface.tsx` | Add "Design my network" suggestion chip |

## Why this fixes the scripting issue specifically

Right now: user asks "walled garden for M-Pesa" → AI replies "What's your RouterOS version? What's your hotspot interface name? What model?" → user gives up.

After: same question → AI replies with the full 8-line walled garden script (M-Pesa domains pre-loaded), with one note saying "this works on v6 and v7 — if your hotspot server isn't named `hotspot1`, change that one word." Done.


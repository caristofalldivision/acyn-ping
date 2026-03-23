

# Enhance Topher: Networking/IT Expertise & Improved Self-Learning

## What This Plan Does

Two changes:

1. **Massively expand the system prompt** in the chat edge function to include deep networking/IT expertise (Cisco IOS, MikroTik RouterOS, WinBox, hotspot/PPPoE setup, captive portals, payment gateways, managed switches, cloud server configuration, IT support workflows)
2. **Improve self-learning** to auto-extract and save knowledge after every conversation turn (not just background cron), with stronger anti-hallucination instructions

## Changes

### 1. Update `supabase/functions/chat/index.ts`

**System prompt expansion** - Add comprehensive networking/IT expertise section:
- Cisco device configuration (IOS CLI, running-config, VLANs, ACLs, OSPF, BGP, port security)
- MikroTik RouterOS (WinBox, CLI, hotspot setup, PPPoE server, queues, firewall, NAT, VLAN, bonding, CAPsMAN/WiFi)
- Captive portal design with payment gateway integration (M-Pesa, PayPal, Stripe)
- Managed switch configuration (VLANs, STP, LACP, port mirroring)
- Cloud-hosted PPPoE/hotspot servers (VPS setup, tunnel configs)
- Server administration (Linux, Windows Server, DNS, DHCP, Active Directory)
- Network troubleshooting methodology (Layer 1-7 approach)
- Remote management tools (WinBox, SSH, Telnet, SNMP, The Dude)

**Anti-hallucination directives** added to system prompt:
- "If you are not certain about a specific command syntax, version compatibility, or configuration detail, explicitly say so"
- "Never fabricate CLI commands, IP addresses, or configuration snippets"
- "When providing device configurations, specify the exact RouterOS version or IOS version the commands apply to"
- "Ask clarifying questions about the user's exact hardware model, firmware version, and network topology before providing configurations"

**Inline real-time learning enhancement** - After every assistant response, trigger a lightweight knowledge extraction call that saves important facts from the current exchange automatically (not waiting for 6-hour cron). This uses the existing `learned_knowledge` table.

### 2. Update `supabase/functions/background-learning/index.ts`

**Enhanced extraction prompt** - Add networking/IT-specific categories to the knowledge extraction:
- New category hints: "network_config", "device_inventory", "topology", "credentials_context" (not actual passwords, just context like "user manages a MikroTik hAP ac2 at office")
- Stronger validation: reject any items that appear assumed rather than stated by the user
- Add instruction: "Only extract facts the user explicitly stated or confirmed. Never infer unstated preferences or technical details."

---

## Technical Details

### Files Modified
| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Expanded system prompt with IT/networking expertise, anti-hallucination rules, inline auto-learning after each response |
| `supabase/functions/background-learning/index.ts` | Enhanced extraction prompt with IT-specific categories and stricter validation |

### Inline Auto-Learning (New Logic in chat function)
After generating the assistant reply, fire a non-blocking knowledge extraction call:
```typescript
// After getting the reply, extract knowledge from this exchange (non-blocking)
const recentExchange = messages.slice(-4); // last 2 turns
fetch(`${supabaseUrl}/functions/v1/analyze-conversations`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
  body: JSON.stringify({ userId }),
}).catch(() => {}); // fire-and-forget
```
This ensures knowledge is captured immediately, not just every 6 hours.

### Anti-Hallucination Rules (Added to System Prompt)
```
ACCURACY & HONESTY RULES (CRITICAL):
- Never guess or assume. If uncertain, say "I'm not sure about X, let me know your exact setup"
- Never fabricate CLI commands, IPs, or configs
- Always specify which RouterOS/IOS version a command applies to
- Ask for hardware model, firmware version, and topology before providing configs
- Distinguish between "I know this" and "this is a common approach" 
- If the user's scenario has multiple valid solutions, present options with tradeoffs
```


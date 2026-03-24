

# Add Critical Thinking, Step-by-Step Delivery & Complete ISP Scripts

## What This Does

1. **Add "thinking" behavior** to the system prompt - the AI reasons through problems before answering, asks clarifying questions instead of assuming, and delivers responses in digestible steps (not walls of text)
2. **Expand Script Generator** with complete ISP business templates covering RADIUS, WireGuard, Walled Garden, NAT, captive portal with payments, and full user billing
3. **Update system prompt** with step-by-step delivery rules and complete MikroTik ISP knowledge (RADIUS server integration, captive portal with M-Pesa/Stripe billing, WireGuard VPN, walled garden, user management)

## Changes

### 1. Update `supabase/functions/chat/index.ts` - System Prompt Enhancements

**Add THINKING & REASONING section:**
- Before answering any configuration question, internally reason through: what device, what version, what's the goal, what are the dependencies
- Break every configuration response into numbered steps - never dump everything at once
- Each step: what to do, which tool to open, the exact commands, then a verification check
- After each step, ask "Ready for the next step?" or "Did that work? Any errors?"
- Keep each step to 3-5 commands max so the user isn't overwhelmed

**Add STEP-BY-STEP DELIVERY rules:**
- Step 1: Prerequisites (tools to download, access needed)
- Step 2-N: One logical section at a time (IP addressing, then DHCP, then hotspot, then firewall, etc.)
- Each step ends with verification commands
- Never combine unrelated config sections

**Add COMPLETE ISP/HOTSPOT KNOWLEDGE section:**
- RADIUS server setup: FreeRADIUS + MySQL + DaloRADIUS on Ubuntu, NAS client config, user groups, bandwidth profiles
- WireGuard: key generation, peer config on both MikroTik and VPS, routing through tunnel
- Walled garden: exact rules for payment pages (M-Pesa, Stripe, PayPal domains), DNS exceptions
- NAT: srcnat masquerade, dstnat for captive portal redirect, hairpin NAT
- Captive portal HTML/CSS: login page template with payment button integration
- User billing: time-based profiles, data-based profiles, voucher generation, auto-disconnect on expiry
- Complete MikroTik user management: hotspot users, profiles with rate limits, session timeouts, MAC binding

### 2. Update `src/components/ScriptGenerator.tsx` - New Templates

Add 4 new templates:

**a) "Complete ISP Hotspot Business" template:**
Fields: RouterOS version, model, interfaces, network range, ISP name, currency, payment method, bandwidth plans (with prices), RADIUS server IP (optional)
Generates prompt for: everything from IP addressing to captive portal to payment integration to user billing - the full business setup

**b) "RADIUS Server + Billing" template:**
Fields: VPS OS, VPS IP, domain, billing platform (DaloRADIUS/Splynx), MikroTik NAS IP, RADIUS secret
Generates: complete FreeRADIUS + MySQL + DaloRADIUS install, MikroTik RADIUS client config, user groups, bandwidth profiles

**c) "WireGuard VPN Tunnel" template:**
Fields: MikroTik RouterOS version, MikroTik public IP, VPS IP, tunnel subnet, routes to push
Generates: key generation, interface creation, peer config on both sides, firewall rules, routing

**d) "Complete PPPoE ISP Business" template:**
Fields: RouterOS version, model, interfaces, IP pool, plans with prices, RADIUS (yes/no), RADIUS IP, billing system
Generates: full PPPoE server + queues + RADIUS + billing + monitoring

### 3. Reorder existing templates

Put the new "Complete ISP Hotspot Business" and "Complete PPPoE ISP Business" templates first since they're the most comprehensive use cases.

---

## Technical Details

### Files Modified
| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Add thinking/reasoning rules, step-by-step delivery, complete ISP knowledge to system prompt |
| `src/components/ScriptGenerator.tsx` | Add 4 new templates (ISP Hotspot Business, RADIUS+Billing, WireGuard, PPPoE ISP Business) |

### Key System Prompt Additions

**Thinking behavior:**
```
THINKING & REASONING (ALWAYS DO THIS):
Before any technical response:
1. Identify: What device? What version? What's the end goal?
2. Check: Do I have all the info I need? If not, ASK.
3. Plan: What's the logical order of operations?
4. Deliver: One step at a time, not everything at once.

STEP-BY-STEP DELIVERY (MANDATORY for all config tasks):
- Never dump a 100-line script. Break it into logical steps of 3-5 commands each.
- Format: "Step 1: [Section Name]" → tool instruction → commands → verify → "Step 2..."
- After complex steps, check in: "Run those commands and let me know if you see any errors."
- If the user says "give me everything at once", then provide the full script.
```

**Complete ISP knowledge additions:**
- Full walled garden domain lists for M-Pesa (safaricom.co.ke, *.mpesa.in), Stripe, PayPal
- RADIUS dictionary attributes for MikroTik (Mikrotik-Rate-Limit, Mikrotik-Group)
- Captive portal redirect chain (dstnat rules for port 80/443 to hotspot)
- Session management: idle-timeout, keepalive-timeout, session-timeout per profile
- Voucher generation scripts (MikroTik scripting for batch user creation)
- Queue tree with PCQ for fair bandwidth distribution across hotspot users


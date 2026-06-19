# MikroTik Scenario Builder + Editable Scripts + Hotspot Fix

Three independent workstreams. Nothing touches the agent, pairing, device-jobs polling, or installer.

---

## 1. Why current hotspot clients "connect but have no internet / no portal"

The `wizard-hotspot` plan creates the hotspot, DHCP, pool, profile, walled garden, and uploads `login.html`, but it is **missing the pieces that make traffic actually flow and the portal intercept work**:

- No `/ip firewall nat add chain=srcnat action=masquerade out-interface-list=WAN` (or detected WAN). Clients get a lease but no NAT → no internet → no captive redirect either (the hotspot redirect only fires on intercepted HTTP, which needs DNS + a reachable upstream).
- No `/ip dns set servers=… allow-remote-requests=yes`. Without `allow-remote-requests`, the hotspot can't resolve `dns-name` and Android/iOS captive checks fail silently.
- No `/ip firewall filter` allow rule for the hotspot subnet → input (DNS, hotspot HTTP 80/443/64872/64873).
- WAN interface is never asked for or auto-detected. Even if the user has a working WAN, masquerade is never created.
- `html-directory=hotspot` is set, but RouterOS expects the profile's html-directory to exist before files are written. The current order writes files after the profile is created — OK — but if `/flash/hotspot/` doesn't exist on some boards the `/file add name="hotspot/login.html"` silently lands in `/`. Need an explicit `/ip hotspot profile set [find name=…] html-directory-override=tmpfs` fallback, or copy the default `hotspot/` dir first.

### Fix
Add three new steps to the hotspot plan, in this order, between `walled-garden` and `portal-files`:

1. **Detect WAN** (read step): `/interface/list/member print where list=WAN` and `/ip route print where dst-address=0.0.0.0/0 active=yes` — pick `gateway-interface`. If user supplied `wan_interface` param, use that.
2. **NAT masquerade** (write): `/ip firewall nat add chain=srcnat action=masquerade out-interface=<wan> comment="ping-hotspot-nat"`.
3. **DNS + input allow** (write):
   - `/ip dns set servers=<dns_servers> allow-remote-requests=yes`
   - `/ip firewall filter add chain=input action=accept in-interface=<hotspot_iface> protocol=udp dst-port=53 comment="ping-hs-dns"`
   - `/ip firewall filter add chain=input action=accept in-interface=<hotspot_iface> protocol=tcp dst-port=53,80,443,64872,64873 comment="ping-hs-input"`
   - place rules before any drop rule using `place-before=[find chain=input action=drop]` with `:do {} on-error={}`.
4. **Ensure html-directory** (write): `/ip hotspot profile set [find name=<profile>] html-directory=flash/hotspot` and `:do { /file add name="flash/hotspot" type=directory } on-error={}` so uploads always land in the right place.

Add corresponding entries to `full_rollback_commands` (remove by comment). New params on the wizard form: `wan_interface` (optional, auto-detect if blank).

---

## 2. Editable Saved Scripts (TBD placeholders + drop-in provisioner)

### UI (`src/components/SavedScripts.tsx`)
- Replace the "Show script" `<pre>` block with an inline editor:
  - `<Textarea>` (monospace, auto-grow) bound to a local draft.
  - "Save changes" + "Revert" buttons; on save, `UPDATE saved_scripts SET script_content=…, updated_at=now()`.
  - Above the editor, render a **Placeholders** panel: regex-scan for `«TBD:label»` or `{{label}}` tokens and render one input per unique token; "Apply" rewrites the draft, replacing all occurrences. This lets the user fill TBDs without hunting through the script.
- Add a new top-level button **"Import provisioner"** which opens a dialog:
  - Title, category (default `third-party`), paste area for the raw `.rsc` from Centipid/Splynx/Radius Manager/etc.
  - Optional `provider` tag (centipid, splynx, mikrowisp, custom).
  - Inserts a row into `saved_scripts` with `template_id='external_provisioner'`.
- "Apply to device" button on each script card: opens a device picker, enqueues a `device-jobs` job of kind `apply_script` with the (placeholder-resolved) content. Reuses the existing agent path — nothing new server-side.

### Backend
- Migration: add `saved_scripts.updated_at timestamptz default now()` if missing, plus trigger; add `saved_scripts.provider text` and `saved_scripts.placeholders jsonb` (cached parse result).
- No change to `device-jobs` or the agent.

---

## 3. Scenario Builder (replaces "Hotspot wizard" tile with a richer picker)

### New component `src/components/ScenarioBuilder.tsx`
A 2-step flow opened from the device card:
1. **Pick scenario** — grid of cards. User can combine compatible ones (multi-select where it makes sense).
2. **Fill params** — only the fields the picked scenarios need.
3. **Build plan** → calls the matching edge function → reuses the existing review/apply UI (`JobLog`, rollback panel) from `HotspotWizard`.

### Scenarios (each is a small plan builder, same shape as `wizard-hotspot`)

| Scenario | Key params | What it configures |
|---|---|---|
| **Full hotspot (M-Pesa + voucher)** | hotspot_iface, network, pool, wan_iface, dns | The fixed plan from §1 — DHCP, hotspot, NAT, DNS, walled garden, portal upload |
| **Third-party billing provisioner** | wan_iface (ether1 default), provisioner script (from Saved Scripts or paste) | Sets `/ip dhcp-client add interface=<wan> disabled=no`, basic firewall, then runs the user-supplied provisioner verbatim. No portal, no hotspot. |
| **Bridge only** | bridge_name, port list (multi-select from `/interface print`), vlan-filtering on/off | `/interface bridge add`, `/interface bridge port add` for each port |
| **Wireless only** | radio (wlan1/wifi1), ssid, band, security (open / wpa2-psk / wpa3-psk), passphrase, country | Detect WiFi stack (`/interface wifi print` for ROS7 wifiwave2 vs `/interface wireless` legacy), create security profile, set ssid, enable |
| **NAT only (basic gateway)** | wan_iface, lan_iface, lan_network | DHCP client on WAN, address+DHCP server on LAN, masquerade, baseline firewall |
| **PPPoE client (WAN)** | wan_iface, user, password, service-name | `/interface pppoe-client add`, default route via pppoe-out1, masquerade |
| **PPPoE server (ISP)** | listen_iface, pool, profile, local_ip | `/ip pool`, `/ppp profile`, `/interface pppoe-server server add` |
| **RADIUS client (hotspot/PPPoE auth)** | server_ip, secret, services (hotspot/ppp/login) | `/radius add`, enable on selected services, `incoming accept=yes` |
| **VLAN trunk + access ports** | trunk_iface, vlan list (id+name+access ports) | bridge vlan-filtering, `/interface vlan`, `/interface bridge vlan` tagged/untagged |
| **DHCP server on existing iface** | iface, network, pool, dns | pool + dhcp-server + network |
| **Firewall hardening baseline** | wan_iface | input drop !established, fasttrack, block bogons, allow icmp |
| **WireGuard server** | listen_port, peer pubkeys (paste), allowed-ips | `/interface wireguard add`, peers, address, firewall accept |
| **Site-to-site IPsec** | remote_ip, psk, local/remote subnets | `/ip ipsec peer/identity/policy` |
| **Queue / simple QoS** | iface, max-up, max-down, per-client option | `/queue simple` parent + child |
| **DDNS (MikroTik cloud)** | enable | `/ip cloud set ddns-enabled=yes` |
| **Backup-to-email schedule** | smtp_user, smtp_pass | `/system scheduler` weekly export+email |
| **NTP client** | servers | `/system ntp client set` |
| **User management** | admin user rename, new password | rename `admin`, add operator user, disable defaults |

Compatibility rules (enforced in UI):
- Full hotspot is exclusive with Third-party provisioner.
- Bridge-only, Wireless-only, NAT-only, VLAN can be combined.
- RADIUS attaches to either Full hotspot or PPPoE server if either is also selected.

### Backend
- One new edge function: `wizard-scenarios/index.ts` (single dispatcher) with one builder per scenario in `_shared/scenarios/*.ts` (`hotspot.ts`, `nat.ts`, `bridge.ts`, `wireless.ts`, `pppoe-client.ts`, `pppoe-server.ts`, `radius.ts`, `vlan.ts`, `dhcp.ts`, `firewall.ts`, `wireguard.ts`, `ipsec.ts`, `qos.ts`, `ddns.ts`, `backup-sched.ts`, `ntp.ts`, `users.ts`, `third-party.ts`).
- Each builder returns the same `{ steps, full_rollback_commands, ai_notes }` shape `HotspotWizard` already consumes, so the review/apply UI is reused unchanged.
- All generated scripts run through the existing `ros-lint.ts` before being returned.
- Existing `wizard-hotspot` function stays as a thin wrapper that calls the new hotspot builder, so the current Hotspot wizard tile keeps working unchanged.

---

## 4. Protected — do not touch
- `agent/`, `public/agent/`, installer scripts, `device-jobs` polling, `device-agent-bridge`, `device-pair`, `DeviceVault.tsx` status badge.
- `captive-portal-pay`, `pesapal-*`, `send-sms`, `send-email`, billing, calendar.
- `chat/index.ts` AI logic, `ai-call.ts`, BYO Gemini settings.

## 5. Files

**New:** `src/components/ScenarioBuilder.tsx`, `supabase/functions/wizard-scenarios/index.ts`, `supabase/functions/_shared/scenarios/*.ts` (one per scenario), migration for `saved_scripts.updated_at/provider/placeholders`.

**Edited:** `src/components/SavedScripts.tsx` (editor + placeholder panel + import provisioner + apply-to-device), `src/components/HotspotWizard.tsx` (add `wan_interface` field), `supabase/functions/wizard-hotspot/index.ts` (NAT + DNS + html-dir steps), `src/components/DeviceVault.tsx` (entry point to Scenario Builder alongside existing Hotspot wizard button), `supabase/config.toml` (register `wizard-scenarios`).

## 6. Acceptance
- Existing Hotspot wizard run on a fresh router → client gets DHCP, DNS resolves, portal page appears on first HTTP, M-Pesa/voucher login succeeds, browsing works.
- Saved Scripts: a script containing `«TBD:hotspot_iface»` shows a labeled input; filling it rewrites the body; "Apply" enqueues a job the existing agent runs.
- Third-party scenario: pasting a Centipid `.rsc` and selecting "Third-party" produces a plan whose last write step is the verbatim provisioner; agent runs it.
- Bridge / Wireless / NAT / RADIUS / VLAN / PPPoE / WireGuard each build a plan, pass `ros-lint`, and apply without breaking the agent connection.
- Agent online status, pairing, and chat are unchanged.

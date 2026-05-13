## Part 1 — Finish wiring TopologyBuilder (small, do first)

Four edits to `src/components/ChatInterface.tsx`:

1. Add import: `TopologyBuilder` and `Workflow` icon from lucide-react.
2. Add a 5th suggestion chip: `{ icon: Workflow, label: "Design my network", prompt: "__OPEN_TOPOLOGY__" }`. Switch the empty-state grid to `grid-cols-2 md:grid-cols-3` so 5 chips wrap cleanly on mobile.
3. Add `const [showTopology, setShowTopology] = useState(false);`, handle `__OPEN_TOPOLOGY__` in `sendMessage`, and add a render block that returns `<TopologyBuilder onBack={() => setShowTopology(false)} />` when active.
4. Pass `onOpenTopology={() => { setShowScriptGenerator(false); setShowTopology(true); }}` into `<ScriptGenerator>` (the prop already exists on that component).

No other files change. Ship this independently — it's safe and self-contained.

---

## Part 2 — Remote Device Agent (Phase 1: MikroTik only)

Goal: an ISP saves a router in Topha, clicks **Set up hotspot**, Topha runs the wizard end-to-end on the real router, with a confirm step before each write and automatic rollback on failure.

### Architecture

```text
Browser (Topha UI)
   │  HTTPS
   ▼
Supabase Edge Function: device-agent-bridge
   │  WebSocket (outbound from agent)
   ▼
Topha Agent (small Go binary on ISP's LAN)
   │  REST / API / SSH (loopback or LAN)
   ▼
MikroTik Router
```

Why an outbound-from-agent WebSocket: routers behind CGNAT/NAT are unreachable from the cloud. The agent dials out to Topha, holds the socket open, and the edge function forwards commands over it. The edge function never needs the router's public IP.

### Phase 1 scope

In:
- Device vault (saved routers per user, with credentials encrypted at rest).
- Topha Agent v0.1 (Go) — single binary, installer for Linux/Windows/RouterOS container, supports REST API + legacy API + SSH, picks best available per device.
- Pairing flow: user clicks "Add Router" → gets a one-time pairing code → runs `topha-agent pair <code>` on a machine on their LAN → agent registers itself and its reachable routers.
- "Set up hotspot" wizard runs the existing AI hotspot script generator, then pushes via the agent in a transaction (export config first → apply → if any line fails, restore from export).
- Live execution log streamed to the chat as the wizard runs.
- Read-only "Fetch config" action on each saved device (proves the pipe end-to-end).

Out (later phases):
- Cisco devices (Phase 2 — same agent, adds IOS/IOS-XE driver).
- Topology builder → push to real devices (Phase 3 — wires the existing TopologyBuilder to the agent).
- Scheduled config backups, drift detection, multi-router rollouts.

### Database changes (one migration)

| Table | Purpose |
|------|---------|
| `device_agents` | One row per installed Topha Agent. Fields: `user_id`, `name`, `pairing_code`, `agent_secret_hash`, `last_seen_at`, `status`. |
| `devices` | Saved routers. Fields: `user_id`, `agent_id` (FK), `name`, `vendor` (enum: mikrotik, cisco, ubiquiti), `model`, `routeros_version`, `connection_method` (rest/api/ssh), `host`, `port`, `username`, `credential_encrypted` (pgcrypto with secret-stored key), `last_connected_at`. |
| `device_jobs` | Every push attempt. Fields: `user_id`, `device_id`, `kind` (fetch_config/apply_script/wizard_hotspot), `script_content`, `status` (pending/running/success/failed/rolled_back), `output_log`, `error`, `started_at`, `finished_at`. Powers the live log + history. |

All RLS scoped to `auth.uid() = user_id`. Credentials encrypted with `pgp_sym_encrypt` using a server-side key from a new secret `DEVICE_CRED_KEY`.

### Edge functions

| Function | Purpose |
|---|---|
| `device-agent-bridge` | WebSocket endpoint. Agents connect with their `agent_secret`. Routes commands from the UI to the right agent and streams responses back. |
| `device-jobs` | REST. UI calls this to enqueue a job (fetch config, apply script, run wizard). Inserts `device_jobs` row, pushes the job over the bridge, streams progress back via Supabase Realtime on `device_jobs`. |
| `device-pair` | Generates pairing codes, validates agent registration, issues `agent_secret`. |

The hotspot wizard is just a special `kind` on `device_jobs` — its `script_content` is built by reusing the existing `chat` function in a new `mode: "wizard_hotspot"` that returns a structured `{ steps: [{ description, commands, rollback_commands }] }` instead of free text. The agent runs steps in order and reports per-step status.

### Topha Agent (new repo asset, distributed as binary)

Single Go binary, ~5 MB. Responsibilities:
- Pair once with `topha-agent pair <code>` (stores secret in `~/.topha/agent.key`).
- Maintain WebSocket to `device-agent-bridge`.
- Handle commands: `discover`, `fetch_export`, `apply_script`, `take_backup`, `restore_backup`.
- Drivers: `mikrotik-rest` (v7.1+), `mikrotik-api` (go-routeros lib, v6+), `mikrotik-ssh` (golang.org/x/crypto/ssh). Auto-pick: try REST → API → SSH.
- Logs every command with redaction of passwords.

Distribution: download links + install instructions shown on the "Add Router" screen. Source lives outside this repo; the Lovable project just hosts the install instructions and the bridge.

### New UI

- `src/components/DeviceVault.tsx` — list saved devices, "Add Router" flow, per-device actions (Fetch Config, Run Hotspot Wizard, View Job History).
- `src/components/AddDeviceWizard.tsx` — agent install instructions → pairing code → device discovery → save.
- `src/components/HotspotWizard.tsx` — collects hotspot params (interface, IP pool, payment method, voucher format), shows preview script, runs it via `device-jobs`, streams live log.
- `src/components/JobLog.tsx` — reusable live log panel subscribed to a `device_jobs` row via Realtime.
- `src/components/ChatInterface.tsx` — add 6th suggestion chip "Configure my router" that opens DeviceVault. Add an inline action on any AI-generated script in chat: "Push to device →" that opens device picker and runs it as a job.
- `src/components/ScriptGenerator.tsx` — add "Push to device" button alongside Save Script.

### Safety rules baked in

- Every apply takes a `/system backup save` and `/export` first; rollback = restore the backup.
- Wizard steps run inside `/system scheduler` `safe-mode`-style guard: each step has explicit rollback commands the agent runs on failure.
- Mandatory user confirmation in the UI before any write step. Read steps run without confirm.
- Hard-stop if connectivity to the router drops mid-apply (agent waits 60s, then triggers rollback via the backup).

### Files modified / created

**Modified**
- `src/components/ChatInterface.tsx` — Part 1 wiring + Part 2 chip + push-to-device action
- `src/components/ScriptGenerator.tsx` — push-to-device button
- `supabase/functions/chat/index.ts` — add `mode: "wizard_hotspot"` structured output

**Created**
- `supabase/functions/device-agent-bridge/index.ts`
- `supabase/functions/device-jobs/index.ts`
- `supabase/functions/device-pair/index.ts`
- `src/components/DeviceVault.tsx`
- `src/components/AddDeviceWizard.tsx`
- `src/components/HotspotWizard.tsx`
- `src/components/JobLog.tsx`
- `supabase/migrations/<timestamp>_device_vault.sql`

**New secret to add**: `DEVICE_CRED_KEY` (32-byte random, used by pgcrypto).

### Suggested execution order

1. Ship Part 1 (TopologyBuilder wiring) — 5 minutes, zero risk.
2. Migration + `device-pair` + `device-agent-bridge` skeleton + DeviceVault UI with mocked agent (so the UX is testable without the binary).
3. Build the Go agent v0.1 (REST driver only first), publish download.
4. Wire Fetch Config end-to-end on a real MikroTik. Validate.
5. Add Hotspot Wizard with structured AI output + rollback.
6. Phase 2 (Cisco) and Phase 3 (Topology push) as follow-up plans.

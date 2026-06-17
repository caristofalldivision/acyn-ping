# Why jobs stay stuck at "Waiting for agent…"

Pairing works, but the agent **process is not running** after install in the common path.

- The PowerShell installer only registers the scheduled task **when a `PING_CODE` is passed at install time**. The Device Vault install command does NOT pass one — users install, then run `ping-agent pair <CODE>` manually.
- `pair` only writes the config file. It does **not** start the polling loop.
- Result: `device-jobs` is enqueued, but no agent is polling `/device-jobs/pending`, so JobLog sits on "Waiting for agent…" forever.
- Nothing on the server side is actually broken — `device-jobs/pending`, the bridge, and the wizard work as soon as the agent process exists.

# Fix (minimal, additive — does not break installs or pairing)

## 1. Make `pair` self-bootstrap the background runner

In `agent/main.go`:

- After `doPair` succeeds, call a new `installService()` that:
  - **Windows**: `schtasks /Create /TN "Ping Agent" /SC ONLOGON /TR "<exe> run" /RL LIMITED /F`, then `Start-Process` the exe with `run` detached (same as today's installer block, just moved into the agent itself so it runs whenever the user pairs, regardless of how they installed).
  - **Linux**: write `~/.config/systemd/user/ping-agent.service`, `systemctl --user daemon-reload && systemctl --user enable --now ping-agent` if `systemctl` is on PATH; otherwise spawn `nohup ping-agent run >/tmp/ping-agent.log 2>&1 &`.
  - **macOS**: write `~/Library/LaunchAgents/click.echoisp.ping-agent.plist` and `launchctl load -w` it; fallback to `nohup`.
- All three branches are **idempotent** and **best-effort**: any failure prints a friendly hint ("background start failed — run `ping-agent run` manually") and `pair` still exits 0.
- Also expose it as a standalone command: `ping-agent install-service` (so users who paired with an older binary can run it once).
- Print a final line: `agent running in background — JobLog will start updating within ~5s`.

## 2. Update installers to call `pair` (which now auto-starts)

- `public/agent/install.ps1`: leave existing behavior; remove the duplicated `schtasks` block inside the `PING_CODE` branch (it now happens inside `ping-agent pair`). Keeps the script simpler and avoids double-registration.
- `public/agent/install.sh`: same — when `PING_CODE` is set, just call `ping-agent pair $PING_CODE`. The agent handles service install.

## 3. Surface "agent running" in Device Vault

In `src/components/DeviceVault.tsx`:

- Next to the **Add Router** button (or in the device row), show a small dot + label driven by `device_agents.status`:
  - `online` → green "Agent online"
  - `registered` / `offline` → amber "Agent paired but not polling — run `ping-agent run` (or re-run installer)"
- In `runJob`, before enqueueing, fetch the latest `device_agents.status` for the device's agent; if not `online`, toast a clear actionable warning instead of silently enqueuing a job that will time out.
- Add a one-line note under the install commands: "After pairing, the agent installs itself as a background service. If your computer reboots, it comes back automatically."

## 4. Safety net on the server (no behavior change for healthy path)

In `supabase/functions/device-jobs/index.ts`:

- When a job is enqueued (POST `/`), check `device_agents.status` and `last_seen_at` for the device's `agent_id`. If status != `online` OR `last_seen_at` older than 60s, still create the job (so it picks up the moment the agent comes back), but **return a `warning` field** in the response: `{ job_id, warning: "Agent appears offline — start ping-agent on your machine." }`.
- `DeviceVault.runJob` surfaces this warning via toast.

## Files touched

- `agent/main.go` — add `installService()` and call from `doPair`; add `install-service` subcommand.
- `public/agent/install.ps1` — drop the inline scheduled-task block; rely on `pair` for service registration.
- `public/agent/install.sh` — same simplification; rebuild any references.
- `src/components/DeviceVault.tsx` — agent status badge + pre-flight check on `runJob` + small docs line.
- `supabase/functions/device-jobs/index.ts` — return non-fatal `warning` when agent is offline at enqueue time.

## What is intentionally NOT touched

- `device-agent-bridge`, `device-pair`, `wizard-hotspot`, `captive-portal-pay`, agent transport / SSH / REST code, pairing UI flow, AI / chat / billing — all unchanged.
- Rebuilt agent binaries in `public/agent/bin/` will need to be regenerated after the Go change; the existing CI workflow already covers Windows/Linux/macOS amd64+arm64.

## Validation

1. Fresh Windows VM: install → pair → confirm scheduled task exists and `tasklist` shows `ping-agent.exe`. Click "Fetch config" in Device Vault → JobLog goes pending → running → success.
2. Linux: install → pair → `systemctl --user status ping-agent` shows active. Same Device Vault round-trip.
3. macOS: install → pair → `launchctl list | grep ping-agent` shows it. Same Device Vault round-trip.
4. Negative path: stop the service, click "Fetch config" — toast warns "Agent appears offline", JobLog still appears and resumes when service is restarted.

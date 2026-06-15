## Plan

1. **Fix the release workflow warning and binary mismatch**
   - Add `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` to `.github/workflows/agent-release.yml` so GitHub Actions runs JavaScript actions on Node 24 now.
   - Fix `agent/Makefile` from `topha-agent` to `ping-agent`; this is currently why releases would upload the wrong binary names while the installer downloads `ping-agent-windows-amd64.exe`.
   - Update `agent/go.mod` module name away from old `topha` naming.

2. **Make PowerShell install reliable and easier to diagnose**
   - Improve `public/agent/install.ps1` so it fails with a clear exact reason when the GitHub release asset is missing, instead of dying immediately.
   - Add a GitHub API fallback check for the latest release and show the exact missing asset name.
   - Support install-only and install+pair reliably via `$env:PING_CODE`.
   - After install, run `ping-agent status` or `ping-agent doctor` so the user immediately sees whether pairing/backend access works.
   - Keep only the Vercel-hosted domains: `ping.echoisp.click` primary and `ping.acyninnovation.com` mirror.

3. **Improve Linux/macOS installer parity**
   - Update `public/agent/install.sh` with the same clearer missing-release diagnostics.
   - Keep binary names aligned with the fixed `Makefile` output.

4. **Harden the agent for first MikroTik configuration**
   - Add `ping-agent doctor --router <host> --user <user> --password <password> [--port 22]` to test MikroTik SSH reachability before running jobs.
   - Improve SSH command execution with clearer errors for auth failure, timeout, disabled SSH, and wrong port.
   - Add a lightweight `ping-agent test-router ...` alias or doctor mode that runs `/system resource print` and confirms RouterOS version/model.
   - Keep SSH as the primary Winbox-friendly path for RouterOS v6/v7.

5. **Fix backend job compatibility gaps**
   - Ensure `deploy_portal` is accepted by `device-jobs` if the UI/agent can create or execute that job kind.
   - Confirm agent endpoints return clean JSON and that pairing/pending polling still work after changes.

6. **Update UI/docs for the new working commands**
   - Update Device Vault install copy blocks and README to show `ping-agent doctor` and the MikroTik preflight command.
   - Remove any remaining old `topha` user-facing references found during the scan.

7. **End-to-end validation**
   - Build the agent locally to confirm the binary is named `ping-agent-*`.
   - Run agent pairing against the backend using a generated pairing code.
   - Run `ping-agent doctor` against the backend.
   - Verify the Vercel installer URLs serve the latest scripts.
   - Verify GitHub release asset URLs match the installer’s expected names.

## Important external blocker

Right now both Vercel install scripts are reachable, but GitHub returns `404` for:

```text
https://github.com/caristofalldivision/ping/releases/latest/download/ping-agent-windows-amd64.exe
```

So the installer cannot succeed until the GitHub release workflow publishes assets with the corrected `ping-agent-*` names. This plan fixes the workflow and naming, but the release still needs to be run once after the changes sync to GitHub.
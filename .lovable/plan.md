## Findings

- `https://ping.echoisp.click/agent/install.ps1` and `https://ping.acyninnovation.com/agent/install.ps1` currently return `DEPLOYMENT_NOT_FOUND`, so those domains are not serving this Lovable app yet.
- The public GitHub release page for `caristofalldivision/topha` still returns 404, so the installer has no binary to download.
- The hosted backend is healthy.
- `device-pair/claim` now responds with clean JSON errors, and `device-jobs/pending` returns clean unauthorized JSON for bad agent credentials, so the functions are reachable.
- Database API grants for `device_agents`, `devices`, and `device_jobs` appear missing even though policies exist; this can break UI reads/writes and pairing status updates.
- The app UI still shows old `topha.acyn.world` commands, not the new `ping.echoisp.click` / `ping.acyninnovation.com` domains.
- The agent supports SSH and REST, but the UI offers “legacy API” even though the agent currently falls that option back to SSH.
- “Configure via Winbox easily” means the agent should guide users to enable the same RouterOS services Winbox users normally manage: SSH/API/REST and a dedicated admin user, without requiring direct public router access.

## Plan

1. Fix backend access for agent tables
   - Add a database migration granting the required Data API permissions on `device_agents`, `devices`, and `device_jobs` to authenticated users and service role.
   - Keep RLS policies in place so users still only access their own records.
   - Re-check grants after migration.

2. Make domains consistent in app and docs
   - Update Device Vault install/pair commands to use `https://ping.echoisp.click` as the primary installer domain.
   - Add a secondary note/command for `https://ping.acyninnovation.com` only if needed as an alternate mirror.
   - Update agent README references from `topha.acyn.world` to the new primary domain.
   - Keep backend calls inside the agent pointed to the Lovable Cloud functions URL, because that is the actual API endpoint the binary must call.

3. Make Windows install-and-pair robust
   - Improve `install.ps1` to:
     - Force modern TLS.
     - Support `$env:TOPHA_CODE` and `-code` style pairing.
     - Fail with clear messages if the GitHub release asset is missing.
     - Verify that the downloaded file is an EXE, not a GitHub 404 HTML page.
     - Show `topha-agent status` and next commands after install.
   - Add a Windows copy button in the UI beside the Linux/macOS copy button.

4. Stop offering unsupported “legacy API” until implemented
   - Change Device Vault’s connection options to:
     - SSH / Winbox-friendly (recommended for RouterOS v6/v7)
     - REST API (RouterOS v7.1+)
   - Save SSH as the default method so users can configure routers they normally manage via Winbox after enabling SSH.
   - Remove or disable the legacy API option unless we implement a real RouterOS API client in Go.

5. Add Winbox-friendly MikroTik setup guidance
   - Add a compact “Prepare MikroTik in Winbox” section in the Add Router flow with copy-paste RouterOS commands:
     - Enable SSH.
     - Optionally enable REST API on RouterOS v7.1+.
     - Create a dedicated `topha` group/user with required permissions.
     - Restrict service access to LAN/subnet where possible.
   - Keep it short and operational, not a marketing explanation.

6. Improve agent diagnostics for real support
   - Add `topha-agent doctor` command that checks:
     - Pairing config exists.
     - Backend `/device-jobs/pending` accepts the saved credentials.
     - Optional router reachability when host/user/pass/method are supplied.
   - Add clearer connection logs for SSH vs REST failures.

7. Validate end to end
   - Redeploy `device-pair`, `device-jobs`, and `device-agent-bridge` after code changes if needed.
   - Test function responses directly:
     - invalid pair code returns clean 400 JSON.
     - bad agent credentials return clean 401 JSON.
   - Verify database grants exist.
   - Verify the generated UI commands contain the new domains.

## Remaining external action

Even after code fixes, the installer cannot download until one of these is true:

- The `caristofalldivision/topha` GitHub release exists and contains `topha-agent-windows-amd64.exe`, or
- We move binaries to an app-hosted/static download location.

Also, `ping.echoisp.click` and `ping.acyninnovation.com` must be connected/published to this Lovable app before those URLs can serve `/agent/install.ps1`.
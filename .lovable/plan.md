## What is failing

- The live domain `https://topha.acyn.world/agent/install.ps1` is still serving the old installer that points to `https://github.com/topha/agent/...`.
- The correct repo URL in the codebase is `https://github.com/caristofalldivision/topha/...`, but those frontend/static files have not been published to the live custom domain yet.
- The GitHub binary URL for `caristofalldivision/topha` currently returns 404, so the first agent release binary is not available yet.
- The deployed backend function `device-pair` is returning “function not found”, so pairing cannot work until the agent backend functions are deployed.

## Implementation plan

1. Deploy and harden the backend agent functions
   - Deploy these backend functions immediately:
     - `device-pair`
     - `device-jobs`
     - `device-agent-bridge`
   - Fix any deploy/import issue found during deployment.
   - Re-test `device-pair/claim` with an invalid code and confirm it returns a clean JSON error instead of “function not found”.

2. Fix installer reliability and live-domain mismatch
   - Keep the repo default as `https://github.com/caristofalldivision/topha/releases/latest/download` in both installers.
   - Improve `install.ps1` so GitHub 404/connection failures show a clear message instead of a raw PowerShell exception.
   - Add a Windows one-command install-and-pair path in the UI, because the current UI only shows install-and-pair for Linux/macOS.
   - Update installer help text to tell you exactly what to do if binaries are missing.

3. Make the release workflow produce the missing binaries
   - Verify `.github/workflows/agent-release.yml` builds the exact filenames the installers download:
     - `topha-agent-windows-amd64.exe`
     - `topha-agent-linux-amd64`
     - `topha-agent-linux-arm64`
     - `topha-agent-darwin-amd64`
     - `topha-agent-darwin-arm64`
   - If needed, adjust the workflow so manual “Run workflow” creates/uses tag `agent-v<version>` and attaches the binaries reliably.

4. Validate end-to-end pairing path
   - Test deployed `device-pair` function behavior.
   - Confirm the app’s “Generate pairing code” call targets the deployed function.
   - Confirm the Go agent’s `pair` command posts to `/device-pair/claim`, saves `agent_id` and `agent_secret`, and then `run` can authenticate against `/device-jobs/pending`.
   - Fix any backend response, CORS, or routing issues found.

5. Final instructions for you
   - After code/backend fixes, I’ll give you the exact GitHub click path to create the first release.
   - You will still need to click **Publish/Update** for the live `topha.acyn.world` installer files to change, because static frontend files do not go live automatically.
   - Backend functions deploy automatically/immediately once fixed.
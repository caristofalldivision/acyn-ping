# Plan: Ship the Topha Agent to GitHub Releases (guided, end-to-end)

Goal: make the `curl … install.sh | sh` flow actually work, without you touching a terminal except to copy/paste one command. Since this Lovable project is already connected to GitHub, every file we add here lands in your repo automatically.

## What we'll add

### 1. GitHub Actions workflow that builds + publishes binaries

Create `.github/workflows/agent-release.yml`. It:

- Triggers on any tag matching `agent-v*` (e.g. `agent-v0.2.0`) **and** on a manual "Run workflow" button in the GitHub UI.
- Sets up Go 1.22, runs `cd agent && make all` (this already produces `dist/topha-agent-{linux,darwin,windows}-{amd64,arm64}` + `SHA256SUMS`).
- Uses `softprops/action-gh-release@v2` to create/update a GitHub Release named after the tag and upload every file in `agent/dist/*` as release assets.
- Uses the built-in `GITHUB_TOKEN` — no extra secrets to configure.

Result: the URL `https://github.com/<you>/<repo>/releases/latest/download/topha-agent-linux-amd64` becomes a real, downloadable file, which is exactly what `public/agent/install.sh` already points at (`RELEASE_BASE` default = `https://github.com/topha/agent/releases/latest/download`).

### 2. Make the install scripts point at YOUR repo, not the placeholder

Right now `install.sh` and `install.ps1` default to `https://github.com/topha/agent/releases/latest/download` (a repo that doesn't exist). We'll:

- Replace that default with a placeholder we ask you to confirm: `https://github.com/<your-gh-user>/<your-repo>/releases/latest/download`.
- Keep `TOPHA_RELEASE_BASE` env var as the override for self-hosting.

I need one piece of info from you for this step — see the question I'll ask after the plan.

### 3. In-app "Install the agent" guided wizard

New component `src/components/AgentInstallWizard.tsx`, opened from a button in `DeviceVault.tsx`. Four steps, each with a copy button:

1. **Generate pairing code** — calls the existing `device-pair` function, shows the 6-char code.
2. **Pick your OS** — Linux/macOS/Windows tabs.
3. **Copy & run one command** — pre-filled with the pairing code, e.g.
   `curl -fsSL https://topha.acyn.world/agent/install.sh | sh -s -- ABC123`
4. **Waiting for agent…** — polls `device_agents` table; flips to ✅ "Agent online" the moment the agent pairs + checks in. Then shows a "Continue → Add your first router" button that jumps to the existing add-device flow.

### 4. One-page docs panel inside the app

New `src/components/AgentHelp.tsx` (small markdown-style panel inside the wizard's "Need help?" disclosure):
- How to run as a systemd service (the snippet already in `agent/README.md`).
- How to upgrade (`curl … install.sh | sh` again).
- How to uninstall.
- Link to the GitHub Release page (so you can verify what's published).

### 5. One-time release helper script

Add `agent/release.sh` so you (or anyone) can cut a release with one command:

```bash
cd agent && ./release.sh 0.2.0
```

It runs `git tag agent-v0.2.0 && git push origin agent-v0.2.0`, which triggers the workflow above. No manual binary uploads ever.

## How you actually use this once it's built

1. Approve the plan. I make all the files.
2. The files sync to GitHub automatically (you're already connected).
3. In GitHub, go to **Actions → "Agent Release" → Run workflow** (or run `agent/release.sh 0.2.0` locally). First run takes ~3 minutes.
4. Confirm at `https://github.com/<you>/<repo>/releases/latest` that the 5 binaries + SHA256SUMS are attached.
5. In the Topha app, open **Device Vault → Install agent** and follow the 4-step wizard. Done.

## Technical details

- **Files created**: `.github/workflows/agent-release.yml`, `agent/release.sh`, `src/components/AgentInstallWizard.tsx`, `src/components/AgentHelp.tsx`.
- **Files edited**: `public/agent/install.sh`, `public/agent/install.ps1` (real default `RELEASE_BASE`), `src/components/DeviceVault.tsx` (button to open wizard), `agent/README.md` (point to wizard, mention `release.sh`).
- **No DB migrations**, no new secrets, no edge function changes.
- **Compatibility**: workflow uses only first-party / well-known Actions (`actions/checkout@v4`, `actions/setup-go@v5`, `softprops/action-gh-release@v2`).

## Out of scope (ask if you want them)

- Code-signing the macOS/Windows binaries (Apple notarization, Windows Authenticode) — not needed for self-install, but reduces SmartScreen warnings.
- Auto-update inside the agent itself.
- Homebrew tap / `winget` manifest.

## One thing I need from you before I start

I need your GitHub `owner/repo` (e.g. `johndoe/topha`) so the install scripts point at the right Releases URL. I'll ask this right after you approve the plan.

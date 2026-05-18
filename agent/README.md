# Topha Agent v0.2

A small Go program that runs on a machine on your LAN, dials out to Topha,
and executes config jobs against your MikroTik routers. Works behind
CGNAT/NAT — Topha never needs your router's public IP.

## Install (prebuilt binary)

```bash
# Linux / macOS
curl -fsSL https://topha.acyn.world/agent/install.sh | sh

# Pair in one go
curl -fsSL https://topha.acyn.world/agent/install.sh | sh -s -- <PAIRING_CODE>

# Windows (PowerShell)
iwr -useb https://topha.acyn.world/agent/install.ps1 | iex
```

The installer downloads from GitHub Releases by default. Override with
`TOPHA_RELEASE_BASE=https://your-host/path` if you self-host the binaries.

## Cut a release (maintainer, one command)

```bash
cd agent
./release.sh 0.2.0
```

That script:

1. Auto-detects your `owner/repo` from `git remote get-url origin`.
2. Patches `public/agent/install.{sh,ps1}` so their default `RELEASE_BASE` points at your repo's GitHub Releases (commits + pushes if changed).
3. Creates and pushes the tag `agent-v0.2.0`.
4. The `.github/workflows/agent-release.yml` workflow then cross-compiles
   Linux/macOS/Windows binaries via `make all`, generates `SHA256SUMS`, and
   attaches everything to a GitHub Release. No manual uploads.

You can also trigger the workflow manually: **GitHub → Actions → Agent Release → Run workflow → enter version**.

First-time setup: just make sure GitHub Actions is enabled for the repo
(Settings → Actions → Allow all actions). No extra secrets required — the
workflow uses the built-in `GITHUB_TOKEN`.



## Build from source

```bash
cd agent
go mod tidy
make dev          # build + run
make all          # cross-compile linux/darwin/windows + checksums into dist/
```

## What's new in v0.2

- REST translator now handles multi-segment paths like `/ip hotspot user profile add ...`
- 3-attempt connection retry with exponential backoff (1s/3s/9s)
- Hotspot wizard waits for `/system backup save` to actually write the `.backup` file before any writes
- Preflight step aborts the wizard if the hotspot interface is missing
- Reports device online/offline + RouterOS version/model on every connect
- Graceful shutdown on SIGINT/SIGTERM

## Pair (one time)

In Topha → **Device Vault → Add Router**, click *Generate pairing code*. Then:

```bash
./topha-agent pair ABC123
```

This stores `agent_id` + `agent_secret` in `~/.topha/agent.json` (mode 0600).

## Run

```bash
./topha-agent run
```

Polls `https://<topha>/functions/v1/device-jobs/pending` every 5 seconds.
Run as a systemd service in production:

```ini
# /etc/systemd/system/topha-agent.service
[Unit]
Description=Topha Agent
After=network-online.target

[Service]
ExecStart=/usr/local/bin/topha-agent run
Restart=always
RestartSec=5
User=topha

[Install]
WantedBy=multi-user.target
```

## Supported job kinds

| Kind             | What it does |
|------------------|--------------|
| `fetch_config`   | `/export terse` and uploads the result |
| `apply_script`   | Runs each non-comment line as a CLI command, stops on first error |
| `take_backup`    | `/system backup save name=<provided or auto>` |
| `restore_backup` | `/system backup load name=<provided>` |
| `wizard_hotspot` | Runs structured plan (from Topha's hotspot wizard); auto-rollback on failure |

## Drivers

- **SSH** (default) — works on RouterOS v6 and v7. Uses username/password.
- **REST** — RouterOS v7.1+, uses HTTPS basic auth on port 443. Set the
  device's `connection_method` to `rest` in Topha.

## Security notes (v0.1)

- Credentials are stored in Topha's DB unencrypted in this preview build —
  add `DEVICE_CRED_KEY` + pgcrypto in a follow-up before wider rollout.
- SSH host key verification is currently disabled (`InsecureIgnoreHostKey`).
  Pin the router's host key before going to production.
- Agent secret is a plain bearer in headers — rotate per-agent if compromised.

## Override the bridge URL (dev / self-host)

```bash
export TOPHA_BASE_URL=https://my-self-hosted.example.com/functions/v1
./topha-agent pair ABC123
```

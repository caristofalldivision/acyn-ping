# Topha Agent v0.1

A small Go program that runs on a machine on your LAN, dials out to Topha,
and executes config jobs against your MikroTik routers. Works behind
CGNAT/NAT — Topha never needs your router's public IP.

## Build

```bash
cd agent
go mod tidy
go build -o topha-agent .
```

Cross-compile for a small Linux box (e.g. RB on the same LAN):
```bash
GOOS=linux GOARCH=amd64 go build -o topha-agent-linux-amd64 .
GOOS=linux GOARCH=arm64 go build -o topha-agent-linux-arm64 .
```

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

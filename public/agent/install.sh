#!/usr/bin/env sh
# Ping Agent installer (Linux / macOS)
#
# Usage:
#   curl -fsSL https://ping.echoisp.click/agent/install.sh | sh
#   curl -fsSL https://ping.echoisp.click/agent/install.sh | sh -s -- <PAIRING_CODE>
#
# Env overrides:
#   PING_RELEASE_BASE  override download base (default: GitHub latest release)
#   PING_REPO          owner/repo on GitHub  (default: caristofalldivision/ping)
#   PING_INSTALL_DIR   install dir           (default: /usr/local/bin)
set -e

REPO="${PING_REPO:-caristofalldivision/ping}"
RELEASE_BASE="${PING_RELEASE_BASE:-https://github.com/${REPO}/releases/latest/download}"
INSTALL_DIR="${PING_INSTALL_DIR:-/usr/local/bin}"
BIN="ping-agent"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac
case "$OS" in
  linux|darwin) ;;
  *) echo "unsupported OS: $OS (use install.ps1 on Windows)" >&2; exit 1 ;;
esac

ASSET="${BIN}-${OS}-${ARCH}"
URL="${RELEASE_BASE}/${ASSET}"

# Preflight: HEAD check so we can give a useful message before downloading.
if [ -z "$PING_RELEASE_BASE" ]; then
  if command -v curl >/dev/null 2>&1; then
    code="$(curl -s -o /dev/null -w '%{http_code}' -L -I "$URL" || echo 000)"
    if [ "$code" = "404" ]; then
      echo "Release asset not found: $ASSET" >&2
      echo "Fix: run the Agent Release workflow at" >&2
      echo "  https://github.com/${REPO}/actions/workflows/agent-release.yml" >&2
      echo "Or set PING_RELEASE_BASE to a URL that hosts $ASSET." >&2
      exit 1
    fi
  fi
fi

echo "-> Downloading $URL"
TMP="$(mktemp)"
if ! curl -fsSL "$URL" -o "$TMP"; then
  echo "Download failed: $URL" >&2
  echo "Set PING_RELEASE_BASE to override the source URL." >&2
  exit 1
fi

size=$(wc -c < "$TMP" | tr -d ' ')
if [ "$size" -lt 200000 ]; then
  echo "Downloaded file is only ${size} bytes - likely a 404, not the agent." >&2
  rm -f "$TMP"
  exit 1
fi
chmod +x "$TMP"

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP" "$INSTALL_DIR/$BIN"
else
  echo "-> Installing to $INSTALL_DIR (sudo required)"
  sudo mv "$TMP" "$INSTALL_DIR/$BIN"
fi
echo "OK  Installed $INSTALL_DIR/$BIN"

if [ -n "$1" ]; then
  echo "-> Pairing with code $1"
  "$INSTALL_DIR/$BIN" pair "$1"
  echo ""
  echo "-> Verifying with doctor"
  "$INSTALL_DIR/$BIN" doctor || true
  echo ""
  echo "Next: $BIN run    (or set up a systemd service - see agent/README.md)"
else
  echo ""
  echo "Next:"
  echo "  $BIN pair <PAIRING_CODE>   # from Ping -> Device Vault"
  echo "  $BIN doctor                # verify backend access"
  echo "  $BIN run                   # start polling for jobs"
fi

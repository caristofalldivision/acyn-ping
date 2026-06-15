#!/usr/bin/env sh
# Ping Agent installer (Linux / macOS)
#
# Usage:
#   curl -fsSL https://ping.echoisp.click/agent/install.sh | sh
#   curl -fsSL https://ping.echoisp.click/agent/install.sh | sh -s -- <PAIRING_CODE>
#
# Env overrides:
#   PING_RELEASE_BASE  override download base (default: Ping-hosted binaries, then GitHub fallback)
#   PING_REPO          owner/repo on GitHub  (default: caristofalldivision/ping)
#   PING_INSTALL_DIR   install dir           (default: /usr/local/bin)
set -e

REPO="${PING_REPO:-caristofalldivision/ping}"
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
TMP="$(mktemp)"

if [ -n "$PING_RELEASE_BASE" ]; then
  BASES="${PING_RELEASE_BASE%/}"
else
  BASES="https://ping.echoisp.click/agent/bin https://ping.acyninnovation.com/agent/bin https://github.com/${REPO}/releases/latest/download"
fi

downloaded=0
errors=""
for base in $BASES; do
  URL="${base}/${ASSET}"
  echo "-> Downloading $URL"
  if curl -fsSL "$URL" -o "$TMP"; then
    size=$(wc -c < "$TMP" | tr -d ' ')
    if [ "$size" -ge 200000 ]; then
      downloaded=1
      break
    fi
    errors="${errors}\n  - ${URL} -> downloaded file was only ${size} bytes"
  else
    errors="${errors}\n  - ${URL} -> curl failed"
  fi
  rm -f "$TMP"
  TMP="$(mktemp)"
done

if [ "$downloaded" -ne 1 ]; then
  echo "Could not download $ASSET from any source." >&2
  printf "Tried:%b\n" "$errors" >&2
  echo "If your site was just updated, publish/deploy once more and retry." >&2
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

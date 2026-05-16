#!/usr/bin/env sh
# Topha Agent installer (Linux / macOS)
# Usage:
#   curl -fsSL https://topha.acyn.world/agent/install.sh | sh
#   curl -fsSL https://topha.acyn.world/agent/install.sh | sh -s -- <PAIRING_CODE>
set -e

RELEASE_BASE="${TOPHA_RELEASE_BASE:-https://github.com/topha/agent/releases/latest/download}"
INSTALL_DIR="${TOPHA_INSTALL_DIR:-/usr/local/bin}"
BIN="topha-agent"

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

URL="${RELEASE_BASE}/${BIN}-${OS}-${ARCH}"
echo "→ Downloading $URL"
TMP="$(mktemp)"
if ! curl -fsSL "$URL" -o "$TMP"; then
  echo "Download failed. Set TOPHA_RELEASE_BASE to override the source URL." >&2
  exit 1
fi
chmod +x "$TMP"

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP" "$INSTALL_DIR/$BIN"
else
  echo "→ Installing to $INSTALL_DIR (sudo required)"
  sudo mv "$TMP" "$INSTALL_DIR/$BIN"
fi
echo "✓ Installed $INSTALL_DIR/$BIN"

if [ -n "$1" ]; then
  echo "→ Pairing with code $1"
  "$INSTALL_DIR/$BIN" pair "$1"
  echo ""
  echo "Next: run '$BIN run' (or set up the systemd service — see agent/README.md)."
else
  echo ""
  echo "Next:"
  echo "  $BIN pair <PAIRING_CODE>   # get this from Topha → Device Vault"
  echo "  $BIN run"
fi

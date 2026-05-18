#!/usr/bin/env bash
# One-command release helper.
#
# Usage:
#   cd agent && ./release.sh 0.2.0
#
# What it does:
#   1. Detects your GitHub owner/repo from `git remote get-url origin`
#   2. Patches public/agent/install.sh and install.ps1 so the default
#      RELEASE_BASE points to YOUR repo's GitHub Releases
#   3. Commits those changes if anything moved
#   4. Tags `agent-v<version>` and pushes it — triggering the
#      `.github/workflows/agent-release.yml` workflow, which builds
#      and uploads binaries to the release.
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>   (e.g. $0 0.2.0)" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ORIGIN="$(git remote get-url origin)"
# Accept https or git@ forms
SLUG="$(echo "$ORIGIN" | sed -E 's#(git@github.com:|https://github.com/)([^/]+/[^/.]+)(\.git)?#\2#')"
if [ -z "$SLUG" ] || [ "$SLUG" = "$ORIGIN" ]; then
  echo "Could not parse owner/repo from origin: $ORIGIN" >&2
  exit 1
fi
NEW_BASE="https://github.com/${SLUG}/releases/latest/download"
echo "→ Repo:         $SLUG"
echo "→ Release base: $NEW_BASE"

# Patch install.sh
sed -i.bak -E "s#^RELEASE_BASE=\"\\\$\\{TOPHA_RELEASE_BASE:-[^}]*\\}\"#RELEASE_BASE=\"\${TOPHA_RELEASE_BASE:-${NEW_BASE}}\"#" public/agent/install.sh
# Patch install.ps1
sed -i.bak -E "s#https://github.com/[^\"']+/releases/latest/download#${NEW_BASE}#g" public/agent/install.ps1
rm -f public/agent/install.sh.bak public/agent/install.ps1.bak

if ! git diff --quiet public/agent/install.sh public/agent/install.ps1; then
  git add public/agent/install.sh public/agent/install.ps1
  git commit -m "agent: point install scripts at ${SLUG} releases"
  git push
fi

TAG="agent-v${VERSION}"
git tag -a "$TAG" -m "Topha Agent ${VERSION}"
git push origin "$TAG"
echo ""
echo "✓ Pushed $TAG. Watch the build at:"
echo "  https://github.com/${SLUG}/actions"
echo "Release will appear at:"
echo "  https://github.com/${SLUG}/releases/tag/${TAG}"

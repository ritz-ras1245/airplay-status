#!/usr/bin/env bash
# Sync airplay-status to a Raspberry Pi over SSH (optional P49 helper from Mac/dev host).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-}"
REMOTE_DIR="${2:-~/airplay-status}"

usage() {
  cat <<EOF
Usage: p49-install-rpi.sh USER@HOST [REMOTE_DIR]

  Rsync repo to the Pi, excluding node_modules and secrets.

Examples:
  ./bin/p49-install-rpi.sh pi@192.168.1.50
  ./bin/p49-install-rpi.sh pi@rpi4.local ~/airplay-status

After sync, on the Pi:
  cd ~/airplay-status
  cp config/deploy/beta.env.example .env   # edit Tidbyt vars if needed
  sudo ./deploy/rpi/install.sh
EOF
}

if [[ -z "$REMOTE" || "$REMOTE" == "-h" || "$REMOTE" == "--help" ]]; then
  usage
  exit "${1:+0}"
fi

if ! command -v rsync >/dev/null; then
  echo "rsync required" >&2
  exit 1
fi

echo "Syncing $ROOT → ${REMOTE}:${REMOTE_DIR}"
ssh "$REMOTE" "mkdir -p '$REMOTE_DIR'"
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude vendor \
  --exclude 'src/public/artwork/current.*' \
  "$ROOT/" "${REMOTE}:${REMOTE_DIR}/"

echo ""
echo "Synced. On the Pi run:"
echo "  ssh $REMOTE"
echo "  cd $REMOTE_DIR"
echo "  cp config/deploy/beta.env.example .env"
echo "  sudo ./deploy/rpi/install.sh"

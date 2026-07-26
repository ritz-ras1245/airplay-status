#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${SHAIRPORT_CONFIG:-$HOME/.config/shairport-sync/shairport-sync.conf}"
EXAMPLE="$ROOT/config/shairport-sync.conf.example"

if ! command -v shairport-sync >/dev/null; then
  echo "shairport-sync not found. Run: ./bin/setup-sidecar.sh" >&2
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "Config not found: $CONFIG" >&2
  echo "Copy the example config:" >&2
  echo "  mkdir -p ~/.config/shairport-sync" >&2
  echo "  cp $EXAMPLE ~/.config/shairport-sync/shairport-sync.conf" >&2
  exit 1
fi

echo "Starting shairport-sync as AirPlay Status receiver..."
echo "Config: $CONFIG"
exec shairport-sync -c "$CONFIG"

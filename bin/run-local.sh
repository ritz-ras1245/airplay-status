#!/usr/bin/env bash
# Start shairport-sync receiver + dashboard (recommended local dev command)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  [[ -n "${SHAIRPORT_PID:-}" ]] && kill "$SHAIRPORT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if pgrep -f "shairport-sync -c" >/dev/null 2>&1; then
  echo "shairport-sync already running"
else
  echo "Starting AirPlay receiver (AirPlay Status)..."
  "$ROOT/bin/run-shairport.sh" &
  SHAIRPORT_PID=$!
  sleep 2
fi

echo ""
echo "Starting dashboard at http://localhost:3003"
echo "AirPlay to 'AirPlay Status' on your iPhone alongside your speakers."
echo "Press Ctrl+C to stop both."
echo ""

cd "$ROOT"
exec npm start

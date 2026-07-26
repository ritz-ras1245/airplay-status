#!/usr/bin/env bash
# Start shairport-sync + metadata watcher for local development.
# Dashboard (npm start) connects in Phase 4.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  [[ -n "${SHAIRPORT_PID:-}" ]] && kill "$SHAIRPORT_PID" 2>/dev/null || true
  [[ -n "${WATCHER_PID:-}" ]] && kill "$WATCHER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

"$ROOT/bin/run-shairport.sh" &
SHAIRPORT_PID=$!

sleep 2

echo ""
echo "Starting metadata watcher (JSON to stdout)..."
node "$ROOT/src/bin/metadata-watcher.js" &
WATCHER_PID=$!

echo ""
echo "Sidecar running. Press Ctrl+C to stop."
echo "  shairport-sync PID: $SHAIRPORT_PID"
echo "  metadata watcher PID: $WATCHER_PID"
echo ""
echo "AirPlay to 'AirPlay Status' to see JSON updates below:"
echo "---"

wait "$WATCHER_PID"

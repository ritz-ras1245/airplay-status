#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=bin/lib/airplay-mode.sh
source "$ROOT/bin/lib/airplay-mode.sh"

echo "=== AirPlay Status sidecar check ==="
echo ""

BUILD="$(airplay_build_mode)"
RUNTIME="$(airplay_runtime_mode)"
echo "AirPlay build:   $BUILD"
echo "AirPlay runtime: $RUNTIME"
if [[ "$BUILD" == "classic" || "$RUNTIME" == "classic" ]]; then
  echo "⚠  Classic (AP1) — iPhone multi-speaker + AirPlay Status: not supported"
  echo "   See docs/multi-room-airplay.md"
fi
echo ""

if pgrep -f "shairport-sync -c" >/dev/null; then
  echo "✓ shairport-sync running (PID $(pgrep -f 'shairport-sync -c'))"
else
  echo "✗ shairport-sync NOT running"
  echo "  → Run: ./bin/run-shairport.sh   (keep this terminal open)"
fi

if lsof -i :7000 2>/dev/null | grep -q shairport; then
  echo "✓ listening on port 7000 (AirPlay 2)"
elif lsof -i :5000 2>/dev/null | grep -q shairport; then
  echo "✓ listening on port 5000 (AirPlay 1 classic)"
else
  echo "✗ nothing listening on port 5000 or 7000"
fi

if [[ -p /tmp/shairport-sync-metadata ]]; then
  echo "✓ metadata pipe exists"
else
  echo "✗ metadata pipe missing (/tmp/shairport-sync-metadata)"
fi

echo ""
echo "mDNS browse (_raop._tcp + _airplay._tcp) for 3s..."
for svc in _raop._tcp _airplay._tcp; do
  echo "--- $svc ---"
  dns-sd -B "$svc" local. 2>&1 &
  DNS_PID=$!
  sleep 2
  kill "$DNS_PID" 2>/dev/null || true
done

echo ""
echo "Look for: AirPlay Status@... in the lists above"
echo "Dashboard: http://localhost:3003"

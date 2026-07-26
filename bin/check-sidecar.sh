#!/usr/bin/env bash
set -euo pipefail

echo "=== AirPlay Status sidecar check ==="
echo ""

if pgrep -f "shairport-sync -c" >/dev/null; then
  echo "✓ shairport-sync running (PID $(pgrep -f 'shairport-sync -c'))"
else
  echo "✗ shairport-sync NOT running"
  echo "  → Run: ./bin/run-shairport.sh   (keep this terminal open)"
fi

if lsof -i :5000 2>/dev/null | grep -q shairport; then
  echo "✓ listening on port 5000"
else
  echo "✗ nothing listening on port 5000"
fi

if [[ -p /tmp/shairport-sync-metadata ]]; then
  echo "✓ metadata pipe exists"
else
  echo "✗ metadata pipe missing (/tmp/shairport-sync-metadata)"
fi

echo ""
echo "mDNS browse (_raop._tcp) for 3s..."
dns-sd -B _raop._tcp local. 2>&1 &
DNS_PID=$!
sleep 3
kill "$DNS_PID" 2>/dev/null || true

echo ""
echo "Look for: AirPlay Status@... in the list above"
echo "Dashboard: http://localhost:3003"

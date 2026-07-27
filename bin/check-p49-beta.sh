#!/usr/bin/env bash
# P49 beta — bare-metal sanity check (run on the Pi after install.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3003}"
BASE="http://127.0.0.1:${PORT}"
FAIL=0

pass() { echo "✓ $*"; }
fail() { echo "✗ $*"; FAIL=1; }
warn() { echo "⚠ $*"; }

echo "=== P49 beta sanity check ==="
echo "Root: ${ROOT}"
echo ""

# --- systemd ---
for unit in nqptp shairport-sync airplay-status; do
  if systemctl is-active --quiet "$unit" 2>/dev/null; then
    pass "${unit}.service active"
  else
    fail "${unit}.service not active (sudo systemctl status ${unit})"
  fi
done
echo ""

# --- nqptp (AirPlay 2 timing) ---
if command -v ss >/dev/null; then
  if ss -ulnp 2>/dev/null | grep -qE ':319|:320'; then
    pass "nqptp listening (UDP 319/320)"
  else
    fail "nqptp not listening on UDP 319/320"
  fi
elif pgrep -x nqptp >/dev/null; then
  pass "nqptp process running"
else
  fail "nqptp not running"
fi

# --- shairport-sync ---
if command -v shairport-sync >/dev/null; then
  if shairport-sync -V 2>&1 | grep -Eiq 'airplay.?2|airplay_2'; then
    pass "shairport-sync built with AirPlay 2"
  else
    fail "shairport-sync missing AirPlay 2 (shairport-sync -V)"
  fi
  if shairport-sync -V 2>&1 | grep -iq 'pipe'; then
    pass "shairport-sync pipe backend enabled"
  else
    fail "shairport-sync missing pipe backend (re-run install.sh)"
  fi
else
  fail "shairport-sync not in PATH"
fi

if ss -tlnp 2>/dev/null | grep -qE ':7000'; then
  pass "listening on TCP 7000 (AirPlay 2)"
elif ss -tlnp 2>/dev/null | grep -qE ':5000'; then
  warn "listening on TCP 5000 (AirPlay 1 only — AP2 multi-room will fail)"
  FAIL=1
else
  fail "nothing listening on TCP 7000 or 5000"
fi

PIPE="${METADATA_PIPE:-/tmp/shairport-sync-metadata}"
if [[ -p "$PIPE" ]]; then
  pass "metadata pipe exists (${PIPE})"
else
  fail "metadata pipe missing (${PIPE})"
fi
echo ""

# --- Avahi / mDNS (optional) ---
if command -v avahi-browse >/dev/null; then
  echo "mDNS browse (_airplay._tcp, 3s)..."
  if timeout 4 avahi-browse -t _airplay._tcp 2>/dev/null | grep -qi 'AirPlay Status'; then
    pass "AirPlay Status visible via Avahi"
  else
    warn "AirPlay Status not seen in avahi-browse (may still work — try iPhone picker)"
  fi
  echo ""
fi

# --- HTTP API ---
if ! command -v curl >/dev/null; then
  fail "curl not installed"
else
  if VERSION_JSON="$(curl -sf "${BASE}/api/version" 2>/dev/null)"; then
    pass "GET /api/version responds"
    echo "  ${VERSION_JSON}"
    echo "$VERSION_JSON" | grep -q '"deployPhase"[[:space:]]*:[[:space:]]*"p49"' && pass 'deployPhase=p49' || fail 'deployPhase not p49'
    echo "$VERSION_JSON" | grep -q '"deployStage"[[:space:]]*:[[:space:]]*"beta"' && pass 'deployStage=beta' || fail 'deployStage not beta'
  else
    fail "GET /api/version failed (${BASE}/api/version)"
  fi

  if curl -sf "${BASE}/api/status" >/dev/null 2>&1; then
    pass "GET /api/status responds"
  else
    fail "GET /api/status failed"
  fi
fi
echo ""

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "Dashboard: http://${IP:-localhost}:${PORT}"
echo "From Mac:  ./bin/check-version.sh http://airplay-beta.local:${PORT}"
echo ""

if [[ "$FAIL" -eq 0 ]]; then
  echo "=== PASS — stack looks healthy; test iPhone AirPlay picker next ==="
  exit 0
fi

echo "=== FAIL — fix items above, then: sudo systemctl restart nqptp shairport-sync airplay-status ==="
exit 1

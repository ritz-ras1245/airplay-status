#!/usr/bin/env bash
# Verify Mac Loki/Grafana stack and optional Pi log shipping (P50).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/config/observability/observability.env"
LOKI_URL="${LOKI_URL:-http://localhost:3100}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3030}"
PI_HOST="${PI_HOST:-airplay-beta.local}"
CHECK_PI="${CHECK_PI:-1}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  LOKI_PORT="${LOKI_PORT:-3100}"
  GRAFANA_PORT="${GRAFANA_PORT:-3030}"
  LOKI_URL="${LOKI_URL:-http://localhost:${LOKI_PORT}}"
  GRAFANA_URL="${GRAFANA_URL:-http://localhost:${GRAFANA_PORT}}"
fi

pass() { echo "check-observability: OK  $*"; }
fail() { echo "check-observability: FAIL $*" >&2; exit 1; }

curl -sf "${LOKI_URL}/ready" >/dev/null || fail "Loki not ready at ${LOKI_URL}"
pass "Loki ready"

curl -sf "${GRAFANA_URL}/api/health" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get('database')=='ok' else 1)" \
  || fail "Grafana unhealthy at ${GRAFANA_URL}"
pass "Grafana healthy"

END_NS=$(python3 -c 'import time; print(int(time.time()*1e9))')
START_NS=$(python3 -c 'import time; print(int((time.time()-900)*1e9))')
QUERY='{host="airplay-beta"}'
ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${QUERY}'''))")
RESP=$(curl -sfG "${LOKI_URL}/loki/api/v1/query_range" \
  --data-urlencode "query=${QUERY}" \
  --data-urlencode "start=${START_NS}" \
  --data-urlencode "end=${END_NS}" \
  --data-urlencode "limit=1") || fail "Loki query failed"

STREAMS=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('data',{}).get('result',[])))" <<<"$RESP")
[[ "$STREAMS" -ge 1 ]] || fail "No Pi logs in Loki (host=airplay-beta, last 15m)"
pass "Pi logs in Loki (${STREAMS} stream(s), last 15m)"

if [[ "$CHECK_PI" == "1" ]] && command -v ssh >/dev/null 2>&1; then
  ssh -o BatchMode=yes -o ConnectTimeout=8 "airplay@${PI_HOST}" \
    'systemctl is-active promtail >/dev/null' 2>/dev/null || fail "Promtail not active on Pi (${PI_HOST})"
  pass "Pi Promtail active"
fi

echo "check-observability: all checks passed"

#!/usr/bin/env bash
# Query Loki on Mac by timestamp — for Slack "@cursor error at …" handoffs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/config/observability/observability.env"
LOKI_URL="${LOKI_URL:-http://localhost:3100}"
HOST="${LOKI_HOST:-airplay-beta}"
UNIT='.*'
WINDOW="5m"
AROUND=""
SEARCH=""
LIMIT=500

usage() {
  cat <<EOF
Usage: query-loki.sh --around ISO8601 [--window 5m] [--host airplay-beta] [--unit airplay-status.service] [--search error]

Examples:
  ./bin/query-loki.sh --around '2026-07-27T03:15:00Z' --window 10m
  ./bin/query-loki.sh --around '2026-07-27T03:15:00-07:00' --search 'Tidbyt'

Env: LOKI_URL (default http://localhost:3100), LOKI_HOST (default airplay-beta)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --around) AROUND="$2"; shift 2 ;;
    --window) WINDOW="$2"; shift 2 ;;
    --host) HOST="$2"; shift 2 ;;
    --unit) UNIT="$2"; shift 2 ;;
    --search) SEARCH="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown: $1" >&2; usage >&2; exit 1 ;;
  esac
done

[[ -n "$AROUND" ]] || { usage >&2; exit 1; }

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  LOKI_PORT="${LOKI_PORT:-3100}"
  LOKI_URL="${LOKI_URL:-http://localhost:${LOKI_PORT}}"
fi

# Parse center time → nanosecond epoch (macOS date)
if ! CENTER_NS=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "${AROUND}" "+%s000000000" 2>/dev/null); then
  if ! CENTER_NS=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "${AROUND}" "+%s000000000" 2>/dev/null); then
    CENTER_NS=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${AROUND}" "+%s000000000")
  fi
fi

# Window → seconds (simple: Nm or Ns suffix)
WIN_SEC=300
if [[ "$WINDOW" =~ ^([0-9]+)m$ ]]; then
  WIN_SEC=$(( "${BASH_REMATCH[1]}" * 60 ))
elif [[ "$WINDOW" =~ ^([0-9]+)s$ ]]; then
  WIN_SEC="${BASH_REMATCH[1]}"
fi

CENTER_SEC=$(( CENTER_NS / 1000000000 ))
START_NS=$(( (CENTER_SEC - WIN_SEC / 2) * 1000000000 ))
END_NS=$(( (CENTER_SEC + WIN_SEC / 2) * 1000000000 ))

QUERY="{host=\"${HOST}\", unit=~\"${UNIT}\"}"
if [[ -n "$SEARCH" ]]; then
  QUERY="${QUERY} |= \"${SEARCH}\""
fi

ENC_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${QUERY}'''))")

URL="${LOKI_URL}/loki/api/v1/query_range?query=${ENC_QUERY}&start=${START_NS}&end=${END_NS}&limit=${LIMIT}&direction=FORWARD"

echo "# Loki query: ${QUERY}" >&2
echo "# Range: ${AROUND} ± ${WINDOW}" >&2

curl -sf "$URL" | python3 -c "
import json, sys, datetime
data = json.load(sys.stdin)
for stream in data.get('data', {}).get('result', []):
    labels = stream.get('stream', {})
    unit = labels.get('unit', '?')
    for ts, line in stream.get('values', []):
        t = datetime.datetime.fromtimestamp(int(ts) / 1e9, tz=datetime.timezone.utc)
        print(f\"{t.isoformat()} [{unit}] {line}\")
"

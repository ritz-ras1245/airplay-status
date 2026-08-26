#!/usr/bin/env bash
# Query GET /api/health on a running instance (dev Mac, RPi4 beta, prod).
# Exits non-zero if unreachable or status != "ok" — usable in monitoring/cron.
set -euo pipefail

BASE="${1:-http://localhost:3003}"

if ! command -v curl >/dev/null; then
  echo "curl required" >&2
  exit 1
fi

URL="${BASE%/}/api/health"
echo "GET ${URL}"

BODY="$(curl -sf --max-time 5 "${URL}")" || {
  echo "✗ unreachable: ${URL}" >&2
  exit 2
}

if command -v python3 >/dev/null; then
  echo "${BODY}" | python3 -m json.tool
else
  echo "${BODY}"
fi

# status: "ok" → healthy; anything else (or missing) → non-zero exit.
if echo "${BODY}" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
  echo "✓ healthy"
else
  echo "✗ unhealthy" >&2
  exit 3
fi

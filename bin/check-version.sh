#!/usr/bin/env bash
# Query /api/version on a running instance (dev Mac, RPi4 beta, prod).
set -euo pipefail

BASE="${1:-http://localhost:3003}"

if ! command -v curl >/dev/null; then
  echo "curl required" >&2
  exit 1
fi

echo "GET ${BASE}/api/version"
curl -sf "${BASE}/api/version" | python3 -m json.tool 2>/dev/null || curl -sf "${BASE}/api/version"
echo ""

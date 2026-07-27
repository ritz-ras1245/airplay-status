#!/usr/bin/env bash
# One-shot render + push to Tidbyt (for testing without the push loop).
#
# Requires: pixlet, curl, TIDBYT_DEVICE_ID, TIDBYT_API_TOKEN
# Dashboard must be running at http://localhost:${PORT:-3003}
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=load-mac-env.sh
source "$ROOT/bin/load-mac-env.sh"

PORT="${PORT:-3003}"
BASE_URL="http://localhost:${PORT}"
INSTALLATION_ID="${TIDBYT_INSTALLATION_ID:-airplaystatus}"
OUTPUT="${TMPDIR:-/tmp}/airplay-status-tidbyt.webp"
STAR="$ROOT/integrations/tidbyt/airplay-status.star"

: "${TIDBYT_DEVICE_ID:?Set TIDBYT_DEVICE_ID (from Tidbyt mobile app)}"
: "${TIDBYT_API_TOKEN:?Set TIDBYT_API_TOKEN (from Tidbyt mobile app)}"

if ! command -v pixlet >/dev/null 2>&1; then
  echo "pixlet not found — install: brew install tidbyt/tidbyt/pixlet" >&2
  exit 1
fi

STATUS="$(curl -sf "${BASE_URL}/api/status")"

if ! node -e "
  const s = JSON.parse(process.argv[1]);
  process.exit(s.title || s.artist ? 0 : 1);
" "$STATUS"; then
  curl -sf -X DELETE \
    -H "Authorization: Bearer ${TIDBYT_API_TOKEN}" \
    "https://api.tidbyt.com/v0/devices/${TIDBYT_DEVICE_ID}/installations/${INSTALLATION_ID}" \
    >/dev/null 2>&1 || true
  echo "Nothing playing — removed installation ${INSTALLATION_ID} from Tidbyt"
  exit 0
fi

pixlet render "$STAR" \
  "status=${STATUS}" \
  "base_url=${BASE_URL}" \
  -o "$OUTPUT"

pixlet push \
  --installation-id "$INSTALLATION_ID" \
  "$TIDBYT_DEVICE_ID" \
  "$OUTPUT"

echo "Pushed to Tidbyt (installation: ${INSTALLATION_ID})"

#!/usr/bin/env bash
# Run dashboard with timestamped console output + tee log file + metadata debug.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${DEBUG_LOG:-/tmp/airplay-status-debug.log}"

cd "$ROOT"
: > "$LOG"

echo "AirPlay Status debug capture"
echo "  Dashboard: http://localhost:3003?debug=1"
echo "  Log file:  $LOG"
echo "  Pipe log:  METADATA_DEBUG=1 (raw ssnc/core events)"
echo ""
echo "Terminal 1 (if needed): ./bin/run-shairport.sh"
echo "Use UI test buttons before each iPhone action."
echo ""

export METADATA_DEBUG=1
npm start 2>&1 | tee "$LOG" | while IFS= read -r line; do
  printf '%s %s\n' "$(date '+%H:%M:%S')" "$line"
done

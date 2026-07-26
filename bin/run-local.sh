#!/usr/bin/env bash
# Start shairport-sync receiver + dashboard
#   ./bin/run-local.sh          normal
#   ./bin/run-local.sh --debug  verbose logs + /debug UI
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DEBUG=false

for arg in "$@"; do
  case "$arg" in
    --debug) DEBUG=true ;;
    -h|--help)
      echo "Usage: $0 [--debug]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

cleanup() {
  [[ -n "${SHAIRPORT_PID:-}" ]] && kill "$SHAIRPORT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if pgrep -f "shairport-sync -c" >/dev/null 2>&1; then
  echo "shairport-sync already running"
else
  echo "Starting AirPlay receiver (AirPlay Status)..."
  "$ROOT/bin/run-shairport.sh" &
  SHAIRPORT_PID=$!
  sleep 2
fi

echo ""
echo "Dashboard: http://localhost:3003"
if [[ "$DEBUG" == true ]]; then
  echo "Debug UI:  http://localhost:3003/debug"
fi
echo "Press Ctrl+C to stop."
echo ""

cd "$ROOT"

if [[ "$DEBUG" == true ]]; then
  LOG="${DEBUG_LOG:-/tmp/airplay-status-debug.log}"
  : > "$LOG"
  echo "Debug log: $LOG"
  echo ""
  export METADATA_DEBUG=1
  exec npm start 2>&1 | tee "$LOG" | while IFS= read -r line; do
    printf '%s %s\n' "$(date '+%H:%M:%S')" "$line"
  done
fi

exec npm start

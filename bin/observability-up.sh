#!/usr/bin/env bash
# Start Loki + Grafana on Mac (Docker). Pi Promtail pushes to LOKI_PORT on LAN.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OBS="$ROOT/config/observability"
ENV_FILE="$OBS/observability.env"

if ! command -v docker >/dev/null 2>&1; then
  echo "observability-up: docker not found — install Docker Desktop or: brew install --cask docker" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$OBS/observability.env.example" "$ENV_FILE"
  echo "observability-up: created $ENV_FILE — set GF_SECURITY_ADMIN_PASSWORD before exposing LAN" >&2
fi

# shellcheck disable=SC1090
set -a && source "$ENV_FILE" && set +a

MAC_LOG_DIR="${MAC_LOG_DIR:-$HOME/Library/Logs/airplay-status}"
mkdir -p "$MAC_LOG_DIR"
export MAC_LOG_DIR

cd "$OBS"

PROFILES=()
if [[ "${ENABLE_MAC_PROMTAIL:-1}" == "1" ]]; then
  PROFILES+=(--profile mac-logs)
fi

docker compose --env-file "$ENV_FILE" "${PROFILES[@]}" up -d

LOKI_PORT="${LOKI_PORT:-3100}"
GRAFANA_PORT="${GRAFANA_PORT:-3030}"

echo ""
echo "Loki:    http://localhost:${LOKI_PORT}  (Pi Promtail → http://<mac-hostname>.local:${LOKI_PORT}/loki/api/v1/push)"
echo "Grafana: http://localhost:${GRAFANA_PORT}  (login from observability.env)"
echo ""
echo "Pi install: LOKI_PUSH_URL=http://<mac-hostname>.local:${LOKI_PORT}/loki/api/v1/push sudo ./deploy/rpi/promtail/install-promtail.sh"
echo "Query logs: ./bin/query-loki.sh --around '2026-07-26T22:15:00Z' --window 5m"

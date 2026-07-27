#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OBS="$ROOT/config/observability"
ENV_FILE="$OBS/observability.env"

[[ -f "$ENV_FILE" ]] || ENV_FILE="$OBS/observability.env.example"

cd "$OBS"
docker compose --env-file "$ENV_FILE" --profile mac-logs down

echo "observability stack stopped"

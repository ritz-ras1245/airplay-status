#!/usr/bin/env bash
# P49 — stop pre-prod stack (Docker or systemd).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-docker}"

usage() {
  cat <<EOF
Usage: p49-down.sh [docker|rpi]

  docker  Stop Docker Compose stack (default)
  rpi     Stop systemd services (bare-metal)
EOF
}

if [[ "$MODE" == "-h" || "$MODE" == "--help" ]]; then
  usage
  exit 0
fi

down_docker() {
  echo "Stopping P49 Docker stack..."
  docker compose -f "$ROOT/deploy/docker/docker-compose.yml" down
}

down_rpi() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "RPi mode requires root: sudo $0 rpi" >&2
    exit 1
  fi
  systemctl stop airplay-status shairport-sync
  echo "nqptp left running (shared system service)"
}

case "$MODE" in
  docker) down_docker ;;
  rpi) down_rpi ;;
  *)
    echo "Unknown mode: $MODE" >&2
    usage >&2
    exit 1
    ;;
esac

#!/usr/bin/env bash
# P49 — start Docker stack (or systemd on Pi).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-docker}"

usage() {
  cat <<EOF
Usage: p49-up.sh [docker|rpi]

  docker  Docker Compose (default) — see deploy/docker/README-WARN.md
  rpi     systemd on Pi (fallback; see deploy/rpi/README.md)

Prerequisites: deploy/docker/README-WARN.md
EOF
}

if [[ "$MODE" == "-h" || "$MODE" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export GIT_COMMIT="${GIT_COMMIT:-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || true)}"

ensure_nqptp() {
  if command -v systemctl >/dev/null && systemctl list-unit-files nqptp.service >/dev/null 2>&1; then
    if ! systemctl is-active --quiet nqptp 2>/dev/null; then
      echo "Starting host nqptp (required for AirPlay 2)..."
      sudo systemctl start nqptp || {
        echo "nqptp not installed. Install via deploy/rpi/install.sh or deploy/docker/README-WARN.md" >&2
        exit 1
      }
    fi
  elif ! pgrep -x nqptp >/dev/null 2>&1; then
    echo "WARNING: nqptp does not appear to be running. AirPlay 2 will not work." >&2
    echo "See deploy/docker/README-WARN.md or deploy/rpi/README.md" >&2
  fi
}

ensure_metadata_dir() {
  local pipe="${METADATA_PIPE:-/tmp/shairport-sync-metadata}"
  local dir
  dir="$(dirname "$pipe")"
  mkdir -p "$dir"
}

up_docker() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "NOTE: see deploy/docker/README-WARN.md (Mac limitations)." >&2
    echo "" >&2
  fi
  ensure_nqptp
  ensure_metadata_dir

  if [[ -f "$ROOT/config/deploy/beta.env.example" && ! -f "$ROOT/.env" ]]; then
    echo "Tip: cp config/deploy/beta.env.example .env" >&2
  fi

  if [[ -f "$ROOT/bin/render-shairport-config.sh" ]]; then
    echo "Rendering deploy/docker/shairport/shairport-sync.conf from beta stage..."
    (cd "$ROOT" && ./bin/render-shairport-config.sh --stage beta \
      --output "$ROOT/deploy/docker/shairport/shairport-sync.conf")
  fi

  echo "Starting P49 Docker stack..."
  docker compose -f "$ROOT/deploy/docker/docker-compose.yml" up -d --build

  local port="${PORT:-3003}"
  echo ""
  echo "Dashboard: http://localhost:${port}"
  echo "Version:   ./bin/check-version.sh http://localhost:${port}"
  echo "Logs:      docker compose -f deploy/docker/docker-compose.yml logs -f --tail=100"
  echo "            (from repo root; add service name: ... logs -f --tail=100 airplay-status)"
}

up_rpi() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "RPi mode requires root: sudo $0 rpi" >&2
    exit 1
  fi
  systemctl start nqptp shairport-sync airplay-status
  systemctl --no-pager status nqptp shairport-sync airplay-status
}

case "$MODE" in
  docker) up_docker ;;
  rpi) up_rpi ;;
  *)
    echo "Unknown mode: $MODE" >&2
    usage >&2
    exit 1
    ;;
esac

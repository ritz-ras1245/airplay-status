#!/usr/bin/env bash
# Render shairport-sync config from template using deploy stage env (.env or DEPLOY_STAGE).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE=""
OUT=""
MODE="ap2"

usage() {
  cat <<EOF
Usage: render-shairport-config.sh [--stage dev|beta|prod] [--classic] [--output PATH]

Sets AirPlay picker name from deploy stage (beta → "AirPlay Status (Beta)").
Source .env or config/deploy/<stage>.env.example on the host.

Defaults: AP2 template → ~/.config/shairport-sync/shairport-sync.conf
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage) STAGE="$2"; shift 2 ;;
    --classic) MODE="classic"; shift ;;
    --output) OUT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

if [[ -n "$STAGE" ]]; then
  export DEPLOY_STAGE="$STAGE"
  STAGE_ENV="$ROOT/config/deploy/${STAGE}.env.example"
  if [[ -f "$STAGE_ENV" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$STAGE_ENV"
    set +a
  fi
fi

if [[ "$MODE" == "classic" ]]; then
  TEMPLATE="$ROOT/config/shairport-sync.conf.template"
else
  TEMPLATE="$ROOT/config/shairport-sync-airplay2.conf.template"
fi

OUT="${OUT:-$HOME/.config/shairport-sync/shairport-sync.conf}"

[[ -f "$TEMPLATE" ]] || { echo "Template missing: $TEMPLATE" >&2; exit 1; }
mkdir -p "$(dirname "$OUT")"

node --input-type=module -e "
  import fs from 'node:fs';
  import { getDeployStage } from './src/lib/deployStage.js';
  const stage = getDeployStage();
  const template = fs.readFileSync('${TEMPLATE}', 'utf8');
  const out = template
    .replaceAll('__AIRPLAY_RECEIVER_NAME__', stage.airplayReceiverName)
    .replaceAll('__SHAIRPORT_LOG_VERBOSITY__', String(stage.shairportLogVerbosity));
  fs.writeFileSync('${OUT}', out);
  console.log('  AirPlay name: ' + stage.airplayReceiverName);
  console.log('  log_verbosity: ' + stage.shairportLogVerbosity);
"

echo "Rendered shairport-sync config → $OUT"

#!/usr/bin/env bash
# Remote deploy to P49 beta Pi over SSH (git checkout + systemd restart + health).
# SCAFFOLD: cloud agent implements on feat/ritz-ras1245/p49-rpi-beta.
set -euo pipefail

usage() {
  cat <<EOF
Usage: p49-deploy.sh --host HOST [--ref SHA|branch] [--stage beta|prod] [--user USER]

  SSH to Pi, fetch/checkout ref, npm ci, render config, restart systemd, health check.

SCAFFOLD only — see docs/p49-beta-remote-deploy.md
EOF
}

HOST=""
REF="HEAD"
STAGE="beta"
USER="${P49_SSH_USER:-pi}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --stage) STAGE="$2"; shift 2 ;;
    --user) USER="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$HOST" ]]; then
  usage >&2
  exit 1
fi

echo "[p49-deploy.sh] SCAFFOLD — would deploy ref=${REF} stage=${STAGE} to ${USER}@${HOST}" >&2
echo "Plan: docs/p49-beta-remote-deploy.md" >&2
echo "GitHub workflow: .github/workflows/p49-deploy-beta.yml" >&2
exit 2

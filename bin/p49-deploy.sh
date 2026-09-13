#!/usr/bin/env bash
# Retired git+npm remote deploy. Artifact push is the P49 path.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cat <<EOF >&2
p49-deploy.sh (git fetch + npm ci on the Pi) is retired.

How we update:
  ./bin/p49-build-release.sh
  ./bin/p49-push-release.sh rasohoni@pi.home.arpa

See DECISIONS.md and deploy/rpi/README.md.
EOF

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  exit 0
fi

if [[ "${1:-}" == "--host" || "${1:-}" == rasohoni@* || "${1:-}" == *@* ]]; then
  echo "" >&2
  echo "Forwarding to p49-push-release.sh..." >&2
  host=""
  user="${P49_SSH_USER:-rasohoni}"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --host) host="$2"; shift 2 ;;
      --user) user="$2"; shift 2 ;;
      --ref|--stage) shift 2 ;;
      -h|--help) shift ;;
      *@*) host="$1"; shift ;;
      *) shift ;;
    esac
  done
  if [[ -n "$host" && "$host" != *@* ]]; then
    host="${user}@${host}"
  fi
  if [[ -n "$host" ]]; then
    exec "$ROOT/bin/p49-push-release.sh" "$host"
  fi
fi

exit 2

#!/usr/bin/env bash
# Retired rsync-source + on-Pi compile helper. Use the release tarball.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  cat <<EOF
p49-install-rpi.sh (rsync tree + on-Pi install.sh compile) is retired.

How we update:
  ./bin/p49-build-release.sh
  ./bin/p49-push-release.sh rasohoni@pi.home.arpa

r-bot cannot sudo. Use rasohoni@pi.home.arpa or rasohoni@pi.local.

See DECISIONS.md and deploy/rpi/README.md.
EOF
}

if [[ -z "${1:-}" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

echo "Forwarding to p49-push-release.sh (artifact path)..." >&2
exec "$ROOT/bin/p49-push-release.sh" "$@"

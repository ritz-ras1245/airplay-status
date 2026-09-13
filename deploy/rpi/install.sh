#!/usr/bin/env bash
# P49 Pi installer entrypoint.
#
# Default path is a Mac-built linux/arm64 tarball (no compile / npm / git on the Pi):
#   ./bin/p49-build-release.sh
#   ./bin/p49-push-release.sh rasohoni@pi.home.arpa
#
# The old on-Pi compile (git clone + make + npm ci) is break-glass only.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

usage() {
  cat <<EOF
Default P49 deploy is a Mac-built linux/arm64 release artifact.

  On Mac:  ./bin/p49-build-release.sh
           ./bin/p49-push-release.sh rasohoni@pi.home.arpa

  Host:    pi / pi.home.arpa
  SSH:     rasohoni (sudo). r-bot cannot sudo.
  Docker:  Synology only — not on the Pi.

This script no longer compiles on the Pi. To force the old path
(15–25 min, needs git + toolchain + npm):

  sudo $0 --break-glass-compile
  AIRPLAY_STATUS_BREAK_GLASS=1 sudo $0

See deploy/rpi/README.md and DECISIONS.md.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--break-glass-compile" || "${AIRPLAY_STATUS_BREAK_GLASS:-}" == "1" ]]; then
  if [[ "${1:-}" == "--break-glass-compile" ]]; then
    shift
  fi
  exec "$HERE/break-glass/install-compile-on-pi.sh" "$@"
fi

usage >&2
exit 1

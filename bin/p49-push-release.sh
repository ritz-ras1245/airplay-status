#!/usr/bin/env bash
# Copy a linux/aarch64 release tarball to the Pi and run the in-tarball installer.
# v1 = SSH + scp. NAS persist/pi/<project> auto-update is later — do not block on it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${P49_RELEASE_OUT:-$ROOT/artifacts/releases}"
REMOTE=""
TARBALL=""
DRY_RUN=0
REMOTE_TMP="${P49_REMOTE_TMP:-/tmp/airplay-status-release}"

usage() {
  cat <<EOF
Usage: p49-push-release.sh USER@HOST [TARBALL] [--dry-run]

  scp the release tarball to the Pi and sudo-run the in-tarball installer
  (apt runtime debs + unpack /opt/airplay-status + systemd restart).
  No make / cmake / npm / git clone on the Pi.

Hosts (locked):
  rasohoni@pi.home.arpa     SSH admin — has sudo (this script)
  rasohoni@pi.local         same host via mDNS
  r-bot@pi.home.arpa        agent account — cannot sudo; do not use here

Synology owns Docker. The Pi is bare metal only.

Examples:
  ./bin/p49-push-release.sh rasohoni@pi.home.arpa
  ./bin/p49-push-release.sh rasohoni@pi.local artifacts/releases/airplay-status-v0.1.0-linux-aarch64.tar.gz

If TARBALL is omitted, uses the newest artifacts/releases/airplay-status-*-linux-aarch64.tar.gz
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      if [[ -z "$REMOTE" ]]; then
        REMOTE="$1"
      elif [[ -z "$TARBALL" ]]; then
        TARBALL="$1"
      else
        echo "Unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$REMOTE" ]]; then
  usage >&2
  exit 1
fi

log() { echo "==> $*"; }
run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

case "$REMOTE" in
  r-bot@*|r-bot)
    echo "r-bot cannot sudo on the Pi. Use rasohoni@pi.home.arpa (or rasohoni@pi.local)." >&2
    exit 1
    ;;
esac

if [[ -z "$TARBALL" ]]; then
  TARBALL="$(ls -1t "$OUT_DIR"/airplay-status-*-linux-aarch64.tar.gz 2>/dev/null | head -1 || true)"
fi
if [[ -z "$TARBALL" || ! -f "$TARBALL" ]]; then
  echo "No tarball found. Build first: ./bin/p49-build-release.sh" >&2
  exit 1
fi

SUM="${TARBALL}.sha256"
if [[ ! -f "$SUM" ]]; then
  echo "Missing checksum: $SUM" >&2
  exit 1
fi

log "remote=${REMOTE}"
log "tarball=${TARBALL}"
log "Note: ${REMOTE%%@*} must have passwordless or interactive sudo."
log "      r-bot cannot sudo — this will fail if you pushed as r-bot."

HELPER="$ROOT/deploy/rpi/release/remote-unpack.sh"
[[ -f "$HELPER" ]] || { echo "Missing $HELPER" >&2; exit 1; }

run ssh "$REMOTE" "mkdir -p '$REMOTE_TMP'"
run scp "$TARBALL" "$SUM" "$HELPER" "${REMOTE}:${REMOTE_TMP}/"
run ssh -t "$REMOTE" "sudo bash '${REMOTE_TMP}/remote-unpack.sh' '${REMOTE_TMP}'"

echo ""
echo "On the Pi:"
echo "  ssh ${REMOTE} 'sudo ${INSTALL_ROOT:-/opt/airplay-status}/bin/check-p49-beta.sh'"
echo "From Mac:"
echo "  ./bin/check-version.sh http://pi.home.arpa"
echo "  ./bin/check-version.sh http://pi.local"
echo ""
echo "iPhone: AirPlay picker should show AirPlay Status (Beta) on the same LAN."

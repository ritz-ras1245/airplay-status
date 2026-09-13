#!/usr/bin/env bash
# Run on the Pi as root after scp of the tarball + sha256 into DIR.
# Used by bin/p49-push-release.sh. No compile / npm / git.
set -euo pipefail

DIR="${1:-.}"
cd "$DIR"

tarball="$(ls -1 airplay-status-*-linux-aarch64.tar.gz 2>/dev/null | head -1 || true)"
[[ -n "$tarball" ]] || { echo "No airplay-status-*-linux-aarch64.tar.gz in $DIR" >&2; exit 1; }
[[ -f "${tarball}.sha256" ]] || { echo "Missing ${tarball}.sha256" >&2; exit 1; }

echo "==> verifying ${tarball}"
sha256sum -c "${tarball}.sha256"

rm -rf unpack
mkdir -p unpack
tar -xzf "$tarball" -C unpack

tree="$(find unpack -mindepth 1 -maxdepth 1 -type d -name 'airplay-status-*-linux-aarch64' | head -1)"
[[ -n "$tree" ]] || { echo "tarball layout missing airplay-status-*-linux-aarch64/" >&2; exit 1; }

echo "==> installing from ${tree}"
(cd "$tree" && ./install.sh)

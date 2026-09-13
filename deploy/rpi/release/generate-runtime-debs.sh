#!/usr/bin/env bash
# Print Debian package names needed at runtime for the given binaries.
# Run inside the linux/arm64 build image (same Debian as the compile stage).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATIC="${SCRIPT_DIR}/RUNTIME_DEBS.txt"

if [[ -f "$STATIC" ]]; then
  grep -Ev '^\s*(#|$)' "$STATIC" || true
fi

for bin in "$@"; do
  if [[ ! -e "$bin" ]]; then
    echo "generate-runtime-debs: missing binary: $bin" >&2
    exit 1
  fi
  while read -r lib; do
    [[ -z "$lib" || ! -e "$lib" ]] && continue
    dpkg -S "$lib" 2>/dev/null | head -1 | cut -d: -f1 || true
  done < <(ldd "$bin" | awk '/=> \// { print $3 }')
done | sed '/^$/d' | sort -u

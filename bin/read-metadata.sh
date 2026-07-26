#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/shairport-sync-metadata-reader"
READER="$VENDOR/shairport-sync-metadata-reader"
PIPE="${METADATA_PIPE:-/tmp/shairport-sync-metadata}"

if [[ ! -x "$READER" ]]; then
  echo "Metadata reader not found at $READER" >&2
  echo "Run: ./bin/setup-sidecar.sh" >&2
  exit 1
fi

if [[ ! -p "$PIPE" && ! -e "$PIPE" ]]; then
  echo "Metadata pipe not found: $PIPE" >&2
  echo "Start shairport-sync first: ./bin/run-shairport.sh" >&2
  exit 1
fi

echo "Reading metadata from $PIPE (Ctrl+C to stop)"
echo "---"
exec "$READER" < "$PIPE"

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/shairport-sync-metadata-reader"
CONFIG_DIR="$HOME/.config/shairport-sync"
CONFIG="$CONFIG_DIR/shairport-sync.conf"

echo "==> Installing shairport-sync (Homebrew)..."
if ! command -v shairport-sync >/dev/null; then
  brew install shairport-sync
else
  echo "    shairport-sync already installed"
fi

echo ""
echo "==> Verifying metadata support..."
if ! shairport-sync -V 2>&1 | grep -qi metadata; then
  echo "WARNING: shairport-sync may lack metadata support. Check: shairport-sync -V" >&2
else
  shairport-sync -V | head -1
fi

echo ""
echo "==> Building shairport-sync-metadata-reader..."
mkdir -p "$ROOT/vendor"
if [[ ! -d "$VENDOR/.git" ]]; then
  git clone --depth 1 https://github.com/mikebrady/shairport-sync-metadata-reader.git "$VENDOR"
fi

make -C "$VENDOR"

echo ""
echo "==> Installing shairport-sync config..."
mkdir -p "$CONFIG_DIR"
if [[ ! -f "$CONFIG" ]]; then
  cp "$ROOT/config/shairport-sync.conf.example" "$CONFIG"
  echo "    Created $CONFIG"
else
  echo "    Config already exists: $CONFIG"
fi

echo ""
echo "Setup complete."
echo ""
echo "Next steps:"
echo "  1. Terminal 1: ./bin/run-shairport.sh"
echo "  2. Terminal 2: ./bin/read-metadata.sh"
echo "  3. AirPlay to 'AirPlay Status' alongside your speakers"
echo "  4. Optional JSON stream: npm run watch:metadata"

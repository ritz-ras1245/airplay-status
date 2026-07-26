#!/usr/bin/env bash
# Quick demo without AirPlay — runs parser simulation + opens wireframe UI
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "1/2 Metadata parser demo"
echo "======================="
node "$ROOT/src/bin/demo-metadata.js"

echo ""
echo "2/2 Dashboard wireframe"
echo "======================="
echo "Starting UI at http://localhost:3003"
echo "Toggle 'Nothing Playing' in the browser to see both states."
echo ""
exec npm --prefix "$ROOT" start

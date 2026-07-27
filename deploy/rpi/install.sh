#!/usr/bin/env bash
# Host bootstrap for Docker (nqptp + deps on Pi).
# SCAFFOLD: replaced by cloud agent on feat/ritz-ras1245/p49-rpi-beta.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "[deploy/rpi/install.sh] SCAFFOLD — not a full install yet." >&2
echo "Plan: docs/p49-beta-remote-deploy.md" >&2
echo "First boot: deploy/rpi/README.md (Phase 0 manual steps until cloud PR merges)" >&2
echo "Cloud agent branch: feat/ritz-ras1245/p49-rpi-beta" >&2
exit 2

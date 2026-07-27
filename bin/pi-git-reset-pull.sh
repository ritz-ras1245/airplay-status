#!/usr/bin/env bash
# On the Pi: verify local deploy edits are in upstream, then hard-reset and pull.
# Run: cd ~/airplay-status && ./bin/pi-git-reset-pull.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${PI_GIT_BRANCH:-feat/cursor/p49-rpi-deployment-0a02}"
REMOTE="${PI_GIT_REMOTE:-origin}"

echo "=== Pi git reset-pull ==="
echo "Repo: ${ROOT}"
echo "Branch: ${BRANCH}"
echo ""

if [[ ! -d .git ]]; then
  echo "Not a git repo: ${ROOT}" >&2
  exit 1
fi

echo "Current: $(git rev-parse --short HEAD) ($(git branch --show-current))"
echo ""

if git status --porcelain | grep -q .; then
  echo "Local changes (will be discarded after audit):"
  git status -sb
  echo ""
fi

echo "=== Audit: local diff vs ${REMOTE}/${BRANCH} ==="
git fetch "${REMOTE}" "${BRANCH}" 2>/dev/null || git fetch "${REMOTE}"

LOCAL_DIFF="$(git diff -- deploy/rpi/install.sh deploy/rpi/systemd/nqptp.service deploy/rpi/systemd/shairport-sync.service || true)"
if [[ -z "$LOCAL_DIFF" ]]; then
  echo "No local edits under deploy/rpi/ — safe to pull."
else
  echo "Local deploy/rpi edits:"
  echo "$LOCAL_DIFF" | head -80
  if [[ "$(echo "$LOCAL_DIFF" | wc -l)" -gt 80 ]]; then
    echo "... ($(echo "$LOCAL_DIFF" | wc -l | tr -d ' ') lines total)"
  fi
  echo ""
  echo "These bring-up fixes should already be in ${REMOTE}/${BRANCH} (commit 738d294+)."
  echo "Upstream install.sh includes: nqptp autoreconf, shairport --with-pipe, pixlet, chown before npm ci."
fi

echo ""
if [[ "${1:-}" == "--yes" || "${PI_GIT_RESET_YES:-}" == "1" ]]; then
  ans=y
else
  read -r -p "Discard local changes and pull ${REMOTE}/${BRANCH}? [y/N] " ans
fi
if [[ "${ans,,}" != "y" ]]; then
  echo "Aborted."
  exit 1
fi

git checkout -- deploy/rpi/install.sh deploy/rpi/systemd/nqptp.service deploy/rpi/systemd/shairport-sync.service 2>/dev/null || true
git reset --hard "HEAD"
git checkout "${BRANCH}" 2>/dev/null || git checkout -b "${BRANCH}" "${REMOTE}/${BRANCH}"
git pull "${REMOTE}" "${BRANCH}"

echo ""
echo "Now at: $(git rev-parse --short HEAD)"
echo ""
echo "Next:"
echo "  sudo ./deploy/rpi/install.sh"
echo "  ./bin/check-p49-beta.sh"

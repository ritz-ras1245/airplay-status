#!/usr/bin/env bash
# Cloud agent bootstrap: symlink global Cursor rules from the standards dependency repo.
# The second repo is selected in Cursor dashboard (multi-repo environment), not named here.
set -euo pipefail

log() { echo "cloud-bootstrap: $*"; }

find_standards_home() {
  local d parent sibling

  if [[ -n "${STANDARDS_HOME:-}" && -x "${STANDARDS_HOME}/bin/install-local.sh" ]]; then
    echo "${STANDARDS_HOME}"
    return 0
  fi

  # Cursor multi-repo: dependency is usually a sibling directory of this repo.
  parent="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  for sibling in "$(dirname "$parent")"/*/; do
    [[ "$(cd "${sibling}" && pwd)" == "${parent}" ]] && continue
    if [[ -x "${sibling}bin/install-local.sh" ]]; then
      echo "${sibling%/}"
      return 0
    fi
  done

  return 1
}

STANDARDS="$(find_standards_home)" || {
  log "error: standards dependency not found (set STANDARDS_HOME or configure multi-repo in Cursor dashboard)"
  exit 1
}

log "found standards dependency checkout"
export RIT_STANDARDS_HOME="${STANDARDS}"
exec "${STANDARDS}/bin/install-local.sh"

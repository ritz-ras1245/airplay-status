#!/usr/bin/env bash
# Scan tracked files for secrets and local machine paths.
# Master copy: engineering-standards/bin/check-tracked-privacy.sh
# Template copy: templates/repo/bin/check-tracked-privacy.sh (keep in sync)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "check-tracked-privacy: not a git repository" >&2
  exit 1
fi
cd "${ROOT}"

TRACKED="$(git ls-files)"
if [[ -z "${TRACKED}" ]]; then
  echo "check-tracked-privacy: no tracked files"
  exit 0
fi

FAIL=0
ALLOW_FILE="${ROOT}/.privacy-check-allow"
MUST_IGNORE_FILE="${ROOT}/.privacy-check-must-ignore"
MODE_FILE="${ROOT}/.privacy-check-mode"
MODE="strict"
if [[ -f "${MODE_FILE}" ]]; then
  MODE="$(tr -d '[:space:]' < "${MODE_FILE}")"
fi

file_allowed() {
  local f="$1"
  local base
  base="$(basename "$f")"
  case "${base}" in
    PRIVACY.md|check-tracked-privacy.sh|privacy-check.md) return 0 ;;
  esac
  case "${f}" in
    docs/privacy-check.md|bin/check-tracked-privacy.sh|scripts/check-tracked-privacy.sh) return 0 ;;
  esac
  if [[ -f "${ALLOW_FILE}" ]] && grep -qxF "${f}" "${ALLOW_FILE}" 2>/dev/null; then
    return 0
  fi
  if [[ -f "${ALLOW_FILE}" ]] && grep -qxF "${base}" "${ALLOW_FILE}" 2>/dev/null; then
    return 0
  fi
  return 1
}

scan() {
  local label="$1"
  local pattern="$2"
  [[ "${MODE}" == "secrets-only" && "${label}" != "api key / token" && "${label}" != "private key block" ]] && return 0
  local hits=""
  local f
  while IFS= read -r f; do
    [[ -n "${f}" ]] || continue
    file_allowed "${f}" && continue
    grep -qE "${pattern}" "${f}" 2>/dev/null && hits="${hits}${f}"$'\n'
  done <<< "${TRACKED}"
  hits="${hits%"${hits%?}"}"
  if [[ -n "${hits}" ]]; then
    echo "FAIL [${label}]:"
    echo "${hits}" | sed 's/^/  /'
    FAIL=1
  fi
}

scan "absolute home path" '/Users/|/home/[a-zA-Z0-9._-]+/'
scan "tilde local path" '~/(workspace|Documents)/'
scan "api key / token" 'pplx-[a-zA-Z0-9]{8,}|gho_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]+|sk-[a-zA-Z0-9]{10,}'
scan "private key block" 'BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY'

must_not_track() {
  local path="$1"
  if git ls-files --error-unmatch "${path}" >/dev/null 2>&1; then
    echo "FAIL [must not track]: ${path}"
    FAIL=1
  fi
}

must_not_track "config/paths.json"
must_not_track ".env"
must_not_track ".env.local"

if [[ -f "${MUST_IGNORE_FILE}" ]]; then
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ -z "${line}" || "${line}" =~ ^# ]] && continue
    must_not_track "${line}"
  done < "${MUST_IGNORE_FILE}"
fi

if [[ "${FAIL}" -eq 0 ]]; then
  count="$(echo "${TRACKED}" | wc -l | tr -d ' ')"
  echo "check-tracked-privacy: passed (${count} files, mode=${MODE})"
  exit 0
fi

echo "check-tracked-privacy: failed — remove secrets/paths or allow via .privacy-check-allow" >&2
echo "See engineering-standards/docs/privacy-check.md" >&2
exit 1

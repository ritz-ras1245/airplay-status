#!/usr/bin/env bash
# Source repo .env then .local/tidbyt.env (Mac dev — Tidbyt creds survive beta .env refresh).
# Usage: ROOT=...; # shellcheck source=bin/load-mac-env.sh
#        source "$ROOT/bin/load-mac-env.sh"

: "${ROOT:?ROOT must be set before sourcing load-mac-env.sh}"

_load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}

_load_env_file "$ROOT/.env"
_load_env_file "$ROOT/.local/tidbyt.env"

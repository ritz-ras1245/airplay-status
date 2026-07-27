#!/usr/bin/env bash
# Merge tidbyt.env (or secrets file) into .env on the Pi. Never commit the secrets file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
SECRETS_FILE="${1:-}"

ALLOWED_RE='^(TIDBYT_DEVICE_ID|TIDBYT_API_TOKEN|TIDBYT_INSTALLATION_ID|TIDBYT_ENABLED)='

usage() {
  cat <<EOF
Usage: apply-secrets-file.sh PATH

  Merge allowed TIDBYT_* keys from PATH into ${ENV_FILE}.
  Example (from Mac via iCloud file):

    scp ~/Library/Mobile\\ Documents/com~apple~CloudDocs/tidbyt.env airplay@airplay-beta.local:
    ssh airplay@airplay-beta.local 'sudo /opt/airplay-status/bin/apply-secrets-file.sh ~/tidbyt.env'
    ssh airplay@airplay-beta.local 'sudo systemctl restart airplay-status'

  See docs/p49-tidbyt-credentials.md
EOF
}

if [[ -z "$SECRETS_FILE" || "$SECRETS_FILE" == "-h" || "$SECRETS_FILE" == "--help" ]]; then
  usage
  exit "${1:+0}"
fi

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "File not found: $SECRETS_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/config/deploy/beta.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# shellcheck disable=SC2016
python3 <<'PY' "$ENV_FILE" "$SECRETS_FILE" "$tmp"
import re, sys
env_path, secrets_path, out_path = sys.argv[1:4]
allowed = {"TIDBYT_DEVICE_ID", "TIDBYT_API_TOKEN", "TIDBYT_INSTALLATION_ID", "TIDBYT_ENABLED"}

def parse(path):
    entries = {}
    for line in open(path, encoding="utf-8"):
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if "=" not in s:
            continue
        k, v = s.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k in allowed:
            entries[k] = f"{k}={v}"
    return entries

new = parse(secrets_path)
if not new.get("TIDBYT_DEVICE_ID") or not new.get("TIDBYT_API_TOKEN"):
    print("TIDBYT_DEVICE_ID and TIDBYT_API_TOKEN required in secrets file", file=sys.stderr)
    sys.exit(1)

existing = open(env_path, encoding="utf-8").read().splitlines() if __import__("os").path.exists(env_path) else []
out = []
seen = set()
for line in existing:
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        out.append(line)
        continue
    k = s.split("=", 1)[0].strip()
    if k in new:
        out.append(new[k])
        seen.add(k)
    else:
        out.append(line)
for k, v in new.items():
    if k not in seen:
        out.append(v)
open(out_path, "w", encoding="utf-8").write("\n".join(out).rstrip() + "\n")
print("Applied:", ", ".join(sorted(new)))
PY

install -m 600 "$tmp" "$ENV_FILE"
rm -f "$ROOT/.setup-token"
echo "Restart: sudo systemctl restart airplay-status"

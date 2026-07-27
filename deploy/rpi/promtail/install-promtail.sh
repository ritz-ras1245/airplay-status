#!/usr/bin/env bash
# Install Promtail on Pi — streams systemd journal (airplay stack) to Mac Loki.
# Run on Pi after Mac observability stack is up: ./bin/observability-up.sh
#
#   LOKI_PUSH_URL=http://<mac-hostname>.local:3100/loki/api/v1/push sudo ./deploy/rpi/promtail/install-promtail.sh
set -euo pipefail

PROMTAIL_VERSION="${PROMTAIL_VERSION:-3.0.0}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/airplay-status}"
CONFIG_SRC="$INSTALL_ROOT/config/observability/promtail-pi.example.yml"

log() { echo "promtail-install: $*"; }

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root (sudo)" >&2; exit 1; }

if [[ -z "${LOKI_PUSH_URL:-}" ]]; then
  echo "Set LOKI_PUSH_URL, e.g.:" >&2
  echo "  LOKI_PUSH_URL=http://mac-studio.local:3100/loki/api/v1/push sudo $0" >&2
  exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64) BIN_ARCH=arm64 ;;
  armv7l|armv6l) BIN_ARCH=arm ;;
  x86_64|amd64) BIN_ARCH=amd64 ;;
  *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
esac

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

URL="https://github.com/grafana/loki/releases/download/v${PROMTAIL_VERSION}/promtail-linux-${BIN_ARCH}.zip"
log "Downloading promtail ${PROMTAIL_VERSION} (${BIN_ARCH})..."
curl -sfL "$URL" -o "$TMP/promtail.zip"
unzip -q "$TMP/promtail.zip" -d "$TMP"
install -m 755 "$TMP/promtail-linux-${BIN_ARCH}" /usr/local/bin/promtail

mkdir -p /etc/promtail /var/lib/promtail
[[ -f "$CONFIG_SRC" ]] || CONFIG_SRC="$(dirname "$0")/../../config/observability/promtail-pi.example.yml"
cp "$CONFIG_SRC" /etc/promtail/promtail.yml

cat >/etc/default/promtail <<EOF
LOKI_PUSH_URL=${LOKI_PUSH_URL}
EOF

cat >/etc/systemd/system/promtail.service <<'UNIT'
[Unit]
Description=Promtail log shipper (airplay-status → Mac Loki)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/default/promtail
ExecStart=/usr/local/bin/promtail -config.file=/etc/promtail/promtail.yml -config.expand-env=true
Restart=on-failure
RestartSec=10
User=root
Group=systemd-journal
SupplementaryGroups=systemd-journal
ReadWritePaths=/var/lib/promtail

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now promtail

log "Promtail running — pushing to ${LOKI_PUSH_URL}"
log "Check: systemctl status promtail && journalctl -u promtail -n 20"

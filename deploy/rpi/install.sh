#!/usr/bin/env bash
# P49 Path B — idempotent bare-metal install on Raspberry Pi OS 64-bit (AirPlay 2).
# Run on the Pi: curl -fsSL … | bash   OR   sudo ./deploy/rpi/install.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/airplay-status}"
NQPTP_VERSION="${NQPTP_VERSION:-1.2.4}"
SHAIRPORT_VERSION="${SHAIRPORT_VERSION:-4.3.6}"
BUILD_DIR="${BUILD_DIR:-/tmp/airplay-status-build}"
SERVICE_USER="${SERVICE_USER:-airplay-status}"

log() { echo "==> $*"; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "Run as root: sudo $0" >&2
    exit 1
  fi
}

install_apt_deps() {
  log "Installing apt packages..."
  apt-get update
  apt-get install -y --no-install-recommends \
    avahi-daemon \
    build-essential \
    autoconf \
    automake \
    libtool \
    pkg-config \
    git \
    curl \
    libssl-dev \
    libavahi-client-dev \
    libsoxr-dev \
    libplist-dev \
    libsodium-dev \
    libgcrypt-dev \
    libconfig-dev \
    libpopt-dev \
    libasound2-dev \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswresample-dev \
    libavfilter-dev \
    libtag1-dev \
    uuid-dev \
    libpulse-dev \
    libmbedtls-dev \
    libfftw3-dev \
    libuuid1 \
    rsync \
    xxd
  systemctl enable --now avahi-daemon
}

install_node() {
  if command -v node >/dev/null && node -v | grep -qE 'v(20|22|24)\.'; then
    log "Node already installed: $(node -v)"
    return 0
  fi
  log "Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

build_nqptp() {
  if command -v nqptp >/dev/null; then
    log "nqptp already installed: $(command -v nqptp)"
    return 0
  fi
  log "Building nqptp ${NQPTP_VERSION}..."
  mkdir -p "$BUILD_DIR"
  local src="$BUILD_DIR/nqptp"
  if [[ ! -d "$src/.git" ]]; then
    git clone --depth 1 --branch "$NQPTP_VERSION" https://github.com/mikebrady/nqptp.git "$src"
  fi
  (
    cd "$src"
    if [[ ! -f Makefile ]]; then
      autoreconf -fi
      ./configure --with-systemd-startup
    fi
    make -j"$(nproc)"
    make install
  )
}

build_shairport_sync() {
  if command -v shairport-sync >/dev/null; then
    local ver
    ver="$(shairport-sync -V 2>&1 || true)"
    if echo "$ver" | grep -Eiq 'airplay.?2|airplay_2|airplay2' && echo "$ver" | grep -iq 'pipe'; then
      log "shairport-sync with AirPlay 2 + pipe backend already installed"
      return 0
    fi
    if echo "$ver" | grep -Eiq 'airplay.?2|airplay_2|airplay2'; then
      log "Existing shairport-sync lacks pipe backend — rebuilding..."
    fi
  fi
  log "Building shairport-sync ${SHAIRPORT_VERSION} with AirPlay 2..."
  mkdir -p "$BUILD_DIR"
  local src="$BUILD_DIR/shairport-sync"
  rm -rf "$src"
  git clone --depth 1 --branch "$SHAIRPORT_VERSION" https://github.com/mikebrady/shairport-sync.git "$src"
  (
    cd "$src"
    autoreconf -fi
    ./configure \
      --with-airplay-2 \
      --with-pipe \
      --with-metadata \
      --with-avahi \
      --with-ssl=mbedtls \
      --sysconfdir=/etc
    make -j"$(nproc)"
    make install
  )
  ldconfig
}

install_app() {
  log "Installing app to ${INSTALL_ROOT}..."
  id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$INSTALL_ROOT" --shell /usr/sbin/nologin "$SERVICE_USER"
  mkdir -p "$INSTALL_ROOT"
  rsync -a --delete \
    --exclude node_modules \
    --exclude .git \
    --exclude .env \
    --exclude vendor \
    "$ROOT/" "$INSTALL_ROOT/"
  chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_ROOT"
  cd "$INSTALL_ROOT"
  sudo -u "$SERVICE_USER" npm ci --omit=dev
}

install_config() {
  log "Rendering shairport-sync config (beta stage)..."
  if [[ -f "$INSTALL_ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$INSTALL_ROOT/.env"
    set +a
  elif [[ -f "$INSTALL_ROOT/config/deploy/beta.env.example" ]]; then
    cp "$INSTALL_ROOT/config/deploy/beta.env.example" "$INSTALL_ROOT/.env"
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_ROOT/.env"
    chmod 600 "$INSTALL_ROOT/.env"
    set -a
    # shellcheck disable=SC1091
    source "$INSTALL_ROOT/.env"
    set +a
  fi
  mkdir -p /etc/shairport-sync
  (cd "$INSTALL_ROOT" && ./bin/render-shairport-config.sh --stage beta --output /etc/shairport-sync.conf)
}

install_systemd() {
  log "Installing systemd units..."
  cp "$ROOT/deploy/rpi/systemd/nqptp.service" /etc/systemd/system/
  cp "$ROOT/deploy/rpi/systemd/shairport-sync.service" /etc/systemd/system/
  cp "$ROOT/deploy/rpi/systemd/airplay-status.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable nqptp.service shairport-sync.service airplay-status.service
}

start_services() {
  log "Starting services..."
  systemctl restart nqptp.service
  sleep 1
  systemctl restart shairport-sync.service
  sleep 2
  systemctl restart airplay-status.service
}

print_summary() {
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  cat <<EOF

P49 bare-metal install complete (Path B).

  Dashboard:  http://${ip:-<pi-ip>}:3003
  Version:    curl -s http://localhost:3003/api/version | python3 -m json.tool

Services:
  sudo systemctl status nqptp shairport-sync airplay-status

Sanity:     ./bin/check-p49-beta.sh

Beta checklist: docs/p49-docker-spike.md
Lessons:    docs/p49-rpi-bare-metal-lessons.md
Next: copy Tidbyt secrets to ${INSTALL_ROOT}/.env if using P2 integrations.

EOF
}

main() {
  require_root
  install_apt_deps
  install_node
  build_nqptp
  build_shairport_sync
  install_app
  install_config
  install_systemd
  start_services
  print_summary
}

main "$@"

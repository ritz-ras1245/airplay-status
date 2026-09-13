#!/usr/bin/env bash
# Install a prebuilt linux/aarch64 airplay-status release onto a Raspberry Pi.
#
# This helper is shipped *inside* the release tarball. It must never compile,
# clone, or run npm. Thin apt runtime packages only.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/airplay-status}"
SERVICE_USER="${SERVICE_USER:-airplay-status}"
STAGE="${DEPLOY_STAGE:-beta}"
DRY_RUN=0

log() { echo "==> $*"; }
die() { echo "$*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: install.sh [--dry-run] [--stage beta|prod]

Unpack this release onto a Raspberry Pi (bare metal). Requires root/sudo.

  --dry-run   Print actions; do not apt-get, write, or restart
  --stage     Deploy stage for first-boot .env / shairport name (default: beta)

Does not: make, cmake, npm, git clone, autoreconf, or ./configure.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --stage) STAGE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

require_root() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Run as root: sudo $0"
  fi
}

assert_no_compile_tools_required() {
  local script="$HERE/install.sh"
  [[ -f "$script" ]] || script="$0"
  if grep -E '^\s*(make|cmake|npm[[:space:]]+(ci|install)|git[[:space:]]+clone|autoreconf|\./configure)\b' "$script" \
    | grep -vqE '^\s*#'; then
    die "Refusing to run: this installer must not compile or npm-install"
  fi
}

assert_layout() {
  [[ -f "$HERE/RUNTIME_DEBS.txt" ]] || die "RUNTIME_DEBS.txt missing (not a release tree?)"
  [[ -x "$HERE/usr/local/bin/nqptp" ]] || die "prebuilt nqptp missing"
  [[ -x "$HERE/usr/local/bin/shairport-sync" ]] || die "prebuilt shairport-sync missing"
  [[ -x "$HERE/usr/local/bin/pixlet" ]] || die "prebuilt pixlet missing"
  [[ -d "$HERE/opt/airplay-status/src" ]] || die "app tree missing"
  [[ -d "$HERE/opt/airplay-status/node_modules" ]] || die "linux-arm64 node_modules missing"
  [[ -f "$HERE/etc/systemd/system/airplay-status.service" ]] || die "systemd units missing"
}

assert_arch() {
  local arch
  arch="$(uname -m)"
  case "$arch" in
    aarch64|arm64) ;;
    *)
      if [[ "$DRY_RUN" -eq 1 ]]; then
        log "Host arch is ${arch} — real install requires aarch64 (Raspberry Pi OS 64-bit)"
        return 0
      fi
      die "This artifact is linux/aarch64. Host is ${arch}."
      ;;
  esac
}

install_runtime_debs() {
  local -a debs=()
  local line
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    debs+=("$line")
  done < "$HERE/RUNTIME_DEBS.txt"
  [[ ${#debs[@]} -gt 0 ]] || die "RUNTIME_DEBS.txt has no packages"
  log "Installing ${#debs[@]} runtime apt packages (no -dev, no toolchain)..."
  run apt-get update
  run apt-get install -y --no-install-recommends "${debs[@]}"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    systemctl enable --now avahi-daemon 2>/dev/null || true
  else
    log "Would enable avahi-daemon"
  fi
}

ensure_node() {
  local ver=""
  if command -v node >/dev/null 2>&1; then
    ver="$(node -v 2>/dev/null || true)"
  fi
  if [[ "$ver" =~ ^v(20|22|24)\. ]]; then
    log "Node already installed: $ver"
    return 0
  fi
  log "Installing Node.js ${NODE_MAJOR:-20}.x via apt/NodeSource (runtime package, not a compile)..."
  run apt-get install -y --no-install-recommends nodejs || true
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi
  if command -v node >/dev/null 2>&1 && node -v | grep -qE 'v(20|22|24)\.'; then
    log "Node: $(node -v)"
    return 0
  fi
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  command -v node >/dev/null || die "nodejs install failed"
  log "Node: $(node -v)"
}

install_binaries() {
  log "Installing prebuilt binaries to /usr/local/bin..."
  run install -m 755 "$HERE/usr/local/bin/nqptp" /usr/local/bin/nqptp
  run install -m 755 "$HERE/usr/local/bin/shairport-sync" /usr/local/bin/shairport-sync
  run install -m 755 "$HERE/usr/local/bin/pixlet" /usr/local/bin/pixlet
  if [[ "$DRY_RUN" -eq 0 ]]; then
    ldconfig || true
  fi
}

install_app() {
  log "Installing app to ${INSTALL_ROOT} (preserving .env)..."
  if [[ "$DRY_RUN" -eq 0 ]]; then
    id -u "$SERVICE_USER" >/dev/null 2>&1 \
      || useradd --system --home "$INSTALL_ROOT" --shell /usr/sbin/nologin "$SERVICE_USER"
  else
    log "Would ensure system user ${SERVICE_USER}"
  fi
  run mkdir -p "$INSTALL_ROOT"
  run rsync -a --delete \
    --exclude .env \
    --exclude .setup-token \
    --exclude 'src/public/artwork/current.*' \
    "$HERE/opt/airplay-status/" "$INSTALL_ROOT/"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_ROOT"
  fi
}

install_config() {
  log "Ensuring .env + shairport-sync config..."
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Would render /etc/shairport-sync.conf from stage=${STAGE} if needed"
    return 0
  fi
  if [[ ! -f "$INSTALL_ROOT/.env" ]]; then
    if [[ -f "$INSTALL_ROOT/config/deploy/${STAGE}.env.example" ]]; then
      cp "$INSTALL_ROOT/config/deploy/${STAGE}.env.example" "$INSTALL_ROOT/.env"
    elif [[ -f "$INSTALL_ROOT/config/deploy/beta.env.example" ]]; then
      cp "$INSTALL_ROOT/config/deploy/beta.env.example" "$INSTALL_ROOT/.env"
    fi
    if [[ -f "$INSTALL_ROOT/.env" ]]; then
      chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_ROOT/.env"
      chmod 600 "$INSTALL_ROOT/.env"
    fi
  fi
  if [[ -f "$INSTALL_ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$INSTALL_ROOT/.env"
    set +a
  fi
  mkdir -p /etc/shairport-sync
  if [[ ! -f /etc/shairport-sync.conf ]]; then
    (cd "$INSTALL_ROOT" && ./bin/render-shairport-config.sh --stage "$STAGE" --output /etc/shairport-sync.conf)
  else
    log "Keeping existing /etc/shairport-sync.conf"
  fi
}

ensure_setup_token() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi
  if [[ -f "$INSTALL_ROOT/.env" ]] \
    && grep -qE '^TIDBYT_DEVICE_ID=.+' "$INSTALL_ROOT/.env" \
    && grep -qE '^TIDBYT_API_TOKEN=.+' "$INSTALL_ROOT/.env"; then
    log "Tidbyt credentials present — skipping setup token"
    rm -f "$INSTALL_ROOT/.setup-token"
    return 0
  fi
  log "Generating one-time secrets setup token (Tidbyt)..."
  local token
  token="$(openssl rand -hex 16)"
  echo "$token" > "$INSTALL_ROOT/.setup-token"
  chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_ROOT/.setup-token"
  chmod 600 "$INSTALL_ROOT/.setup-token"
}

install_systemd() {
  log "Installing systemd units..."
  run cp "$HERE/etc/systemd/system/nqptp.service" /etc/systemd/system/
  run cp "$HERE/etc/systemd/system/shairport-sync.service" /etc/systemd/system/
  run cp "$HERE/etc/systemd/system/airplay-status.service" /etc/systemd/system/
  run systemctl daemon-reload
  run systemctl enable nqptp.service shairport-sync.service airplay-status.service
}

start_services() {
  log "Restarting services (nqptp → shairport-sync → airplay-status)..."
  run systemctl restart nqptp.service
  if [[ "$DRY_RUN" -eq 0 ]]; then
    sleep 1
  fi
  run systemctl restart shairport-sync.service
  if [[ "$DRY_RUN" -eq 0 ]]; then
    sleep 2
  fi
  run systemctl restart airplay-status.service
}

print_summary() {
  local ip port token
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  port=80
  if [[ -f "$INSTALL_ROOT/.env" ]] && grep -qE '^PORT=' "$INSTALL_ROOT/.env"; then
    port="$(grep -E '^PORT=' "$INSTALL_ROOT/.env" | tail -1 | cut -d= -f2- | tr -d '"')"
  fi
  cat <<EOF

P49 artifact install complete (no compile / no npm on this host).

  Dashboard:  http://${ip:-<pi-ip>}:${port}
  Version:    curl -s http://localhost:${port}/api/version | python3 -m json.tool
  Sanity:     ${INSTALL_ROOT}/bin/check-p49-beta.sh

Services:
  sudo systemctl status nqptp shairport-sync airplay-status

EOF
  if [[ -f "$INSTALL_ROOT/.setup-token" ]]; then
    token="$(cat "$INSTALL_ROOT/.setup-token")"
    cat <<EOF
  Setup URL:  http://${ip:-<pi-ip>}:${port}/setup?token=${token}

EOF
  fi
}

main() {
  require_root
  assert_no_compile_tools_required
  assert_layout
  assert_arch
  if [[ -f "$HERE/RELEASE.txt" ]]; then
    log "Release:"
    sed 's/^/    /' "$HERE/RELEASE.txt"
  fi
  install_runtime_debs
  ensure_node
  install_binaries
  install_app
  install_config
  ensure_setup_token
  install_systemd
  start_services
  if [[ "$DRY_RUN" -eq 0 ]]; then
    print_summary
  else
    log "Dry-run finished (no changes)."
  fi
}

main "$@"

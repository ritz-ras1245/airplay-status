#!/usr/bin/env bash
# Assemble airplay-status-<tag>-linux-aarch64/ and tar it.
# Invoked from the Dockerfile pack stage (linux/arm64).
set -euo pipefail

RELEASE_TAG="${RELEASE_TAG:?RELEASE_TAG required}"
GIT_COMMIT="${GIT_COMMIT:-unknown}"
NQPTP_VERSION="${NQPTP_VERSION:-}"
SHAIRPORT_VERSION="${SHAIRPORT_VERSION:-}"
PIXLET_VERSION="${PIXLET_VERSION:-}"
BUILT_AT="${BUILT_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

SAFE_TAG="${RELEASE_TAG//\//-}"
NAME="airplay-status-${SAFE_TAG}-linux-aarch64"

SIDECARS="${SIDECARS:-/sidecars}"
APP="${APP:-/app}"
RELEASE_SRC="${RELEASE_SRC:-/release-src}"
STAGE="${STAGE_DIR:-/stage}"
OUT="${OUT_DIR:-/out}"

ROOT="${STAGE}/${NAME}"
rm -rf "$STAGE"
mkdir -p "$ROOT/usr/local/bin" "$ROOT/opt/airplay-status" "$ROOT/etc/systemd/system" "$OUT"

for bin in nqptp shairport-sync pixlet; do
  src="${SIDECARS}/${bin}"
  [[ -f "$src" ]] || { echo "pack-release: missing $src" >&2; exit 1; }
  install -m 755 "$src" "$ROOT/usr/local/bin/${bin}"
done

if command -v readelf >/dev/null; then
  for bin in nqptp shairport-sync pixlet; do
    if ! readelf -h "$ROOT/usr/local/bin/${bin}" | grep -Eq 'AArch64|ARM aarch64'; then
      echo "pack-release: $bin is not AArch64" >&2
      readelf -h "$ROOT/usr/local/bin/${bin}" >&2 || true
      exit 1
    fi
  done
fi

rsync -a \
  --exclude node_modules \
  "${APP}/" "$ROOT/opt/airplay-status/"
if [[ -d "${APP}/node_modules" ]]; then
  rsync -a "${APP}/node_modules/" "$ROOT/opt/airplay-status/node_modules/"
fi

mkdir -p "$ROOT/opt/airplay-status/deploy/rpi/systemd"
if [[ -d "${APP}/deploy/rpi/systemd" ]]; then
  rsync -a "${APP}/deploy/rpi/systemd/" "$ROOT/opt/airplay-status/deploy/rpi/systemd/"
  rsync -a "${APP}/deploy/rpi/systemd/" "$ROOT/etc/systemd/system/"
fi

install -m 755 "${RELEASE_SRC}/install-release.sh" "$ROOT/install.sh"
cp "${RELEASE_SRC}/shairport-configure-flags.txt" "$ROOT/SHAIRPORT_CONFIGURE_FLAGS.txt"
cp "${RELEASE_SRC}/nqptp-configure-flags.txt" "$ROOT/NQPTP_CONFIGURE_FLAGS.txt"
cp "${RELEASE_SRC}/versions.env" "$ROOT/versions.env"

{
  if [[ -f "${RELEASE_SRC}/RUNTIME_DEBS.txt" ]]; then
    cat "${RELEASE_SRC}/RUNTIME_DEBS.txt"
    echo ""
  fi
  if [[ -f "${SIDECARS}/RUNTIME_DEBS.ldd.txt" ]]; then
    echo "# Shared libraries from ldd of nqptp + shairport-sync (build image)"
    cat "${SIDECARS}/RUNTIME_DEBS.ldd.txt"
  fi
} | awk '
  /^[[:space:]]*#/ || /^[[:space:]]*$/ { print; next }
  !seen[$0]++ { print }
' > "$ROOT/RUNTIME_DEBS.txt"

cat > "$ROOT/opt/airplay-status/release.env" <<EOF
GIT_COMMIT=${GIT_COMMIT}
BUILD_SHA=${GIT_COMMIT}
RELEASE_TAG=${RELEASE_TAG}
EOF

cat > "$ROOT/RELEASE.txt" <<EOF
name=airplay-status
tag=${RELEASE_TAG}
gitCommit=${GIT_COMMIT}
platform=linux/aarch64
nqptp=${NQPTP_VERSION}
shairport-sync=${SHAIRPORT_VERSION}
pixlet=${PIXLET_VERSION}
nodeModules=linux-arm64 (npm ci --omit=dev)
builtAt=${BUILT_AT}
installRoot=/opt/airplay-status
binaries=/usr/local/bin/{nqptp,shairport-sync,pixlet}
EOF

cp "$ROOT/RELEASE.txt" "$ROOT/opt/airplay-status/RELEASE.txt"

(
  cd "$STAGE"
  tar -czf "${OUT}/${NAME}.tar.gz" "$NAME"
)
(cd "$OUT" && sha256sum "${NAME}.tar.gz" > "${NAME}.tar.gz.sha256")

echo "pack-release: wrote ${OUT}/${NAME}.tar.gz"
ls -lh "${OUT}/${NAME}.tar.gz" "${OUT}/${NAME}.tar.gz.sha256"

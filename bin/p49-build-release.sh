#!/usr/bin/env bash
# Build a linux/arm64 release tarball on Mac (Docker buildx) or CI.
# Does not touch the Raspberry Pi.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/deploy/rpi/release/versions.env"

OUT_DIR="${P49_RELEASE_OUT:-$ROOT/artifacts/releases}"
DOCKERFILE="$ROOT/deploy/rpi/release/Dockerfile"
BUILDER_NAME="${P49_BUILDX_BUILDER:-airplay-status-arm64}"
PLATFORM="linux/arm64"
DRY_RUN=0
CHECK_ONLY=0
RELEASE_TAG="${RELEASE_TAG:-}"
GIT_COMMIT="${GIT_COMMIT:-}"

usage() {
  cat <<EOF
Usage: p49-build-release.sh [--dry-run] [--check] [--tag TAG]

Produce:
  artifacts/releases/airplay-status-<tag>-linux-aarch64.tar.gz
  artifacts/releases/airplay-status-<tag>-linux-aarch64.tar.gz.sha256

Requires Docker buildx on a Mac (Apple Silicon is native linux/arm64) or
CI with QEMU. The Pi never compiles — it only unpacks this tarball.

  --tag TAG   Override release tag (default: annotated tag, else v<semver>-<sha>)
  --dry-run   Print the buildx command; do not build
  --check     Verify docker/buildx/linux-arm64 support; do not build

Env:
  RELEASE_TAG, GIT_COMMIT, P49_RELEASE_OUT, P49_BUILDX_BUILDER
  NQPTP_VERSION SHAIRPORT_VERSION PIXLET_VERSION (from deploy/rpi/release/versions.env)

Push to Pi:  ./bin/p49-push-release.sh rasohoni@pi.home.arpa
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --check) CHECK_ONLY=1; shift ;;
    --tag) RELEASE_TAG="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

log() { echo "==> $*"; }

resolve_docker() {
  if docker info >/dev/null 2>&1; then
    echo docker
    return 0
  fi
  if command -v sudo >/dev/null && sudo -n docker info >/dev/null 2>&1; then
    echo "sudo docker"
    return 0
  fi
  return 1
}

pkg_version() {
  node -e "console.log(require('$ROOT/package.json').version)" 2>/dev/null \
    || python3 -c "import json; print(json.load(open('$ROOT/package.json'))['version'])"
}

resolve_tag() {
  if [[ -n "$RELEASE_TAG" ]]; then
    echo "$RELEASE_TAG"
    return 0
  fi
  local exact
  exact="$(git -C "$ROOT" describe --tags --exact-match 2>/dev/null || true)"
  if [[ -n "$exact" ]]; then
    echo "$exact"
    return 0
  fi
  local sha ver
  sha="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  ver="$(pkg_version)"
  echo "v${ver}-${sha}"
}

resolve_commit() {
  if [[ -n "$GIT_COMMIT" ]]; then
    echo "$GIT_COMMIT"
    return 0
  fi
  git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown
}

ensure_builder() {
  local docker_cmd="$1"
  if $docker_cmd buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
    $docker_cmd buildx use "$BUILDER_NAME"
  else
    log "Creating buildx builder ${BUILDER_NAME} (docker-container, ${PLATFORM})"
    $docker_cmd buildx create --name "$BUILDER_NAME" --driver docker-container --platform "$PLATFORM" --use
  fi
  $docker_cmd buildx inspect --bootstrap >/dev/null
}

sha256_file() {
  local path="$1"
  if command -v sha256sum >/dev/null; then
    (cd "$(dirname "$path")" && sha256sum "$(basename "$path")")
  else
    (cd "$(dirname "$path")" && shasum -a 256 "$(basename "$path")")
  fi
}

main() {
  local tag commit docker_cmd dest name tarball
  tag="$(resolve_tag)"
  commit="$(resolve_commit)"
  dest="$OUT_DIR"
  name="airplay-status-${tag//\//-}-linux-aarch64"
  tarball="${dest}/${name}.tar.gz"

  log "tag=${tag}  gitCommit=${commit}"
  log "nqptp=${NQPTP_VERSION}  shairport-sync=${SHAIRPORT_VERSION}  pixlet=${PIXLET_VERSION}"
  log "output=${tarball}"

  if ! docker_cmd="$(resolve_docker)"; then
    echo "Docker is required (Mac Docker Desktop or CI)." >&2
    echo "  Install Docker, then: ./bin/p49-build-release.sh" >&2
    echo "  Apple Silicon: linux/arm64 is native. Intel/CI: buildx + QEMU." >&2
    if [[ "$DRY_RUN" -eq 1 ]]; then
      log "dry-run: Docker missing — command would fail on a real build"
      exit 0
    fi
    exit 1
  fi
  log "docker: ${docker_cmd}"

  if [[ "$CHECK_ONLY" -eq 1 ]]; then
    $docker_cmd version
    $docker_cmd buildx version
    ensure_builder "$docker_cmd"
    $docker_cmd buildx inspect "$BUILDER_NAME"
    log "buildx ready for ${PLATFORM}"
    exit 0
  fi

  local -a cmd=(
    $docker_cmd buildx build
    --builder "$BUILDER_NAME"
    --platform "$PLATFORM"
    --file "$DOCKERFILE"
    --target export
    --build-arg "RELEASE_TAG=${tag}"
    --build-arg "GIT_COMMIT=${commit}"
    --build-arg "NQPTP_VERSION=${NQPTP_VERSION}"
    --build-arg "SHAIRPORT_VERSION=${SHAIRPORT_VERSION}"
    --build-arg "PIXLET_VERSION=${PIXLET_VERSION}"
    --output "type=local,dest=${dest}/.staging"
    --provenance=false
    "$ROOT"
  )

  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run]'
    printf ' %q' "${cmd[@]}"
    printf '\n'
    exit 0
  fi

  [[ -f "$DOCKERFILE" ]] || { echo "Missing $DOCKERFILE" >&2; exit 1; }
  mkdir -p "$dest/.staging"
  ensure_builder "$docker_cmd"

  log "Building ${PLATFORM} (shairport-sync compile + npm ci + pixlet download)..."
  "${cmd[@]}"

  local staged
  staged="$(ls -1 "$dest/.staging"/airplay-status-*-linux-aarch64.tar.gz 2>/dev/null | head -1 || true)"
  [[ -n "$staged" ]] || { echo "buildx produced no tarball in ${dest}/.staging" >&2; ls -la "$dest/.staging" >&2; exit 1; }

  mv -f "$staged" "$tarball"
  if [[ -f "${staged}.sha256" ]]; then
    mv -f "${staged}.sha256" "${tarball}.sha256"
  else
    sha256_file "$tarball" > "${tarball}.sha256"
  fi
  rm -rf "$dest/.staging"

  log "Wrote:"
  ls -lh "$tarball" "${tarball}.sha256"
  echo ""
  cat "${tarball}.sha256"
  echo ""
  echo "Push:  ./bin/p49-push-release.sh rasohoni@pi.home.arpa $tarball"
}

main "$@"

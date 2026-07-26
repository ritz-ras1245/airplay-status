# shellcheck shell=bash
# Shared helpers: AirPlay 1 (classic) vs AirPlay 2 detection for sidecar scripts.

# Build-time capability from `shairport-sync -V` (not necessarily how the daemon runs).
airplay_build_mode() {
  if ! command -v shairport-sync >/dev/null 2>&1; then
    echo "missing"
    return
  fi
  local version_line
  version_line="$(shairport-sync -V 2>&1 | head -1)"
  if echo "$version_line" | grep -Eiq 'airplay-2|airplay_2|airplay2'; then
    echo "airplay2"
  else
    echo "classic"
  fi
}

# Runtime: which port shairport-sync is listening on (5000 = AP1, 7000 = AP2).
airplay_runtime_mode() {
  if lsof -i :7000 2>/dev/null | grep -q shairport-sync; then
    echo "airplay2"
  elif lsof -i :5000 2>/dev/null | grep -q shairport-sync; then
    echo "classic"
  else
    echo "none"
  fi
}

airplay_is_macos() {
  [[ "$(uname -s)" == "Darwin" ]]
}

# iPhone multi-select in the AirPlay picker only groups AirPlay 2 endpoints.
airplay_print_multiroom_notice() {
  local build runtime
  build="$(airplay_build_mode)"
  runtime="$(airplay_runtime_mode)"

  if [[ "$build" == "airplay2" && "$runtime" == "airplay2" ]]; then
    return 0
  fi

  echo ""
  echo "──────────────────────────────────────────────────────────────"
  echo "  ℹ  Multi-speaker AirPlay (iPhone)"
  echo "──────────────────────────────────────────────────────────────"
  echo "  This receiver is AirPlay 1 (classic) — build: ${build}, running: ${runtime}."
  echo "  iOS will NOT let you select AirPlay Status together with HomePods /"
  echo "  other AirPlay 2 speakers in one multi-room group."
  echo ""
  if airplay_is_macos; then
    echo "  macOS: Homebrew shairport-sync is classic-only; AP2 mode is not"
    echo "  supported on Mac (nqptp needs ports 319/320, used by the OS)."
    echo ""
    echo "  Workarounds:"
    echo "    • Play to real speakers only; use Tidbyt/dashboard via LAN APIs"
    echo "    • Run the receiver on a Pi/Linux with AirPlay 2 + nqptp (see docs)"
    echo "    • For metadata testing: select only AirPlay Status on iPhone"
  else
    echo "  Fix: build shairport-sync with --with-airplay-2, run nqptp, and use"
    echo "       config/shairport-sync-airplay2.conf.example"
  fi
  echo ""
  echo "  Details: docs/multi-room-airplay.md"
  echo "──────────────────────────────────────────────────────────────"
  echo ""
}

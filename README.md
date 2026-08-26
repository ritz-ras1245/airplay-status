# AirPlay Status

A local dashboard that shows what's playing on your AirPlay speakers — from any app.

Add **AirPlay Status** as an extra AirPlay output alongside your real speakers. A background receiver captures track metadata (title, artist, album, artwork) while discarding the audio. A Node.js server renders it in your browser.

## How It Works

```
Your device (Music, Spotify, etc.)
    ├──► Your speakers        (you hear this)
    └──► AirPlay Status       (metadata only → this dashboard)
```

## Prerequisites

- macOS (primary) or Linux
- Node.js v20+
- [Homebrew](https://brew.sh) (macOS)
- shairport-sync with metadata support (installed by `./bin/setup-sidecar.sh`)

## Quick Start

```bash
git clone https://github.com/ritz-ras1245/airplay-status.git
cd airplay-status
npm install
chmod +x bin/*.sh
./bin/setup-sidecar.sh   # one-time: shairport-sync + metadata reader
./bin/run-local.sh       # receiver + dashboard → http://localhost:3003
```

On your iPhone or Mac, start playback and select **AirPlay Status** as an output. For **multi-speaker** from iPhone (HomePods + metadata), see [docs/multi-room-airplay.md](docs/multi-room-airplay.md) — requires AirPlay 2 on Linux/Pi, not macOS Homebrew.

Details: **[docs/shairport-setup.md](docs/shairport-setup.md)**. Debug playback issues: `./bin/run-local.sh --debug` — see [docs/debug-capture.md](docs/debug-capture.md).

## Phases

Phase numbering: [specs/README.md](specs/README.md). Pre-P100: **0.y.z**; **P100** → **1.0.0**. Global RVS: Cursor rules (`~/.cursor/rules/`) — not in this repo.

| Phase | Status | Description |
|-------|--------|-------------|
| **P0** — Live dashboard | Done | Sidecar, metadata pipe, SSE dashboard ([p0 spec](specs/p0-airplay-status.md)) |
| **P1** — Remote control | Spec | [p1-remote-control.md](specs/p1-remote-control.md) |
| **P2** — Tidbyt | MVP done | [p2-tidbyt.md](specs/p2-tidbyt.md) — [integrations/tidbyt/](integrations/tidbyt/) |
| **P3** — eInk display | Spec | [p3-eink-display.md](specs/p3-eink-display.md) |
| **P4** — eInk controls | Spec | [p4-eink-controls.md](specs/p4-eink-controls.md) |
| **P5** — Deployment | Spec | [p5-deployment.md](specs/p5-deployment.md) |
| **P49** — Pre-prod beta | **Next** | [p49-preprod-deployment.md](specs/p49-preprod-deployment.md) — RPi4, AirPlay 2 |
| **P99** — Prod readiness | Spec | [p99-prod-readiness.md](specs/p99-prod-readiness.md) — logs, Grafana, SOPs, launchd |

See [specs/p0-airplay-status.md](specs/p0-airplay-status.md) for the full P0 technical specification.

## Project Docs

- [.github/BRANCH_POLICY.md](.github/BRANCH_POLICY.md) — branch naming, main protection, PR rules
- [docs/kiosk-display.md](docs/kiosk-display.md) — always-on `/display` kiosk view
- [docs/versioning.md](docs/versioning.md) — semver, `/api/version`, deploy env
- [specs/p0-airplay-status.md](specs/p0-airplay-status.md) — architecture, data model, API, P0 status
- [specs/](specs/) — phase specs · [AGENTS.md](AGENTS.md) — context for AI assistants

## License

MIT

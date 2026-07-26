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

On your iPhone or Mac, start playback and select **both** your real speakers and **AirPlay Status** as outputs.

Details: **[docs/shairport-setup.md](docs/shairport-setup.md)**. Debug playback issues: `./bin/run-local.sh --debug` — see [docs/debug-capture.md](docs/debug-capture.md).

## Phases

Phase numbering: **P1–P98** features · **P99** prod readiness · **P100–P999** iteration 2 ([specs/README.md](specs/README.md)).

| Phase | Status | Description |
|-------|--------|-------------|
| **P0** — Live dashboard | Done | Sidecar, metadata pipe, SSE dashboard ([p0 spec](specs/p0-airplay-status.md)) |
| **P1** — Remote control | Spec | [p1-remote-control.md](specs/p1-remote-control.md) |
| **P2** — Tidbyt | MVP done | [p2-tidbyt.md](specs/p2-tidbyt.md) — [integrations/tidbyt/](integrations/tidbyt/) |
| **P3** — eInk display | Spec | [p3-eink-display.md](specs/p3-eink-display.md) |
| **P4** — eInk controls | Spec | [p4-eink-controls.md](specs/p4-eink-controls.md) |
| **P5** — Deployment | Spec | [p5-deployment.md](specs/p5-deployment.md) |
| **P99** — Prod readiness | Spec | [p99-prod-readiness.md](specs/p99-prod-readiness.md) — logs, Grafana, SOPs, launchd |

See [specs/p0-airplay-status.md](specs/p0-airplay-status.md) for the full P0 technical specification.

## Project Docs

- [specs/p0-airplay-status.md](specs/p0-airplay-status.md) — architecture, data model, API, P0 status
- [specs/](specs/) — phase specs (see [specs/README.md](specs/README.md))
- [AGENTS.md](AGENTS.md) — context for AI assistants continuing this work

## License

MIT

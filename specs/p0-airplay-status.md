# P0 — AirPlay Status Dashboard

## Overview

A local Node.js dashboard that displays **now playing** metadata from any AirPlay source (Apple Music, Spotify, podcasts, etc.) by running a virtual AirPlay receiver alongside your real speakers.

The user selects **two AirPlay outputs** when playing: their real speakers (audio) and **AirPlay Status** (metadata only). A `shairport-sync` sidecar receives the stream, exposes metadata via a Unix pipe, and a Node/Express app renders it in the browser.

This project follows **spec-driven development** with incremental, commit-sized phases.

## Problem Statement

AirPlay speakers do not expose a public "now playing" API. You cannot passively read what is playing on another speaker. The proven workaround is to **be** an AirPlay receiver, add yourself as an additional output, and discard the audio while capturing metadata from the stream.

## Architecture

```
┌─────────────────┐
│  iPhone / Mac   │  (Spotify, Music, YouTube, etc.)
│  AirPlay sender │
└────────┬────────┘
         │  multi-room output
         ├──────────────────────────► Real AirPlay speakers (audio)
         │
         └──────────────────────────► shairport-sync ("AirPlay Status")
                                              │
                                              │ metadata pipe (FIFO)
                                              ▼
                                    shairport-sync-metadata-reader
                                              │
                                              ▼
                                    Node.js metadata reader service
                                              │
                                              ▼
                                    Express + EJS dashboard (browser)
```

### Components

| Component | Role |
|---|---|
| **shairport-sync** | AirPlay 2 receiver; advertises on mDNS as a speaker; writes metadata to a named pipe |
| **shairport-sync-metadata-reader** | Decodes binary pipe output into title, artist, album, artwork, progress |
| **Node metadata service** | Reads decoded metadata, maintains in-memory playback state |
| **Express UI** | Server-rendered dashboard showing current track or empty state |

### Design Decisions

- **Sidecar over pure Node receiver** — `shairport-sync` has mature AirPlay 2 support and metadata handling. A Node-only RAOP receiver (`node-libraop`) is AirPlay 1 only and less reliable in multi-room setups.
- **Audio discarded** — The receiver must not play PCM output (no echo). Configure `shairport-sync` with a null/dummy output or mute.
- **No cloud deployment** — This is a local-network, home-use tool. No AWS/Azure secrets path.
- **No `.env` for credentials** — AirPlay receiver may optionally use a password stored in macOS Keychain if needed later.

## Tech Stack

- **Runtime:** Node.js v20+ (ES Modules)
- **Framework:** Express
- **Templating:** EJS
- **AirPlay receiver:** shairport-sync (system install via Homebrew)
- **Metadata decoder:** shairport-sync-metadata-reader (build from source or bundle)
- **Platform:** macOS (primary), Linux possible (Raspberry Pi pattern)

## Data Model (Playback State)

The UI and internal API consume a normalized object:

```json
{
  "isPlaying": true,
  "title": "Señorita",
  "artist": "Shawn Mendes, Camila Cabello",
  "album": "Señorita",
  "albumArt": "/artwork/current.jpg",
  "progressMs": 95000,
  "durationMs": 191000,
  "source": "AirPlay",
  "updatedAt": "2026-07-26T09:00:00.000Z"
}
```

Empty state when nothing is streaming to the receiver:

```json
{
  "isPlaying": false,
  "title": null,
  "artist": null,
  "album": null,
  "albumArt": null,
  "progressMs": 0,
  "durationMs": 0,
  "source": null,
  "updatedAt": null
}
```

## shairport-sync Configuration

Key settings in `shairport-sync.conf`:

```conf
general = {
  name = "AirPlay Status";
  output_backend = "dummy";  # discard audio, metadata only
};

metadata = {
  enabled = "yes";
  include_cover_art = "yes";
  pipe_name = "/tmp/shairport-sync-metadata";
};
```

Metadata pipe format is binary/XML-style, decoded by `shairport-sync-metadata-reader`. See [shairport-sync-metadata-reader](https://github.com/mikebrady/shairport-sync-metadata-reader).

## Node Service API

| Method | Path | Description |
|---|---|---|
| GET | `/` | Dashboard UI |
| GET | `/api/status` | JSON playback state |
| GET | `/api/events` | SSE playback updates |
| GET | `/artwork/current.jpg` | Current album art (if available) |

## UI Requirements

- Dark mode, modern layout (Inter font)
- Now Playing: album art, title, artist, album, progress bar, source badge
- Nothing Playing: empty state with clear instructions to add "AirPlay Status" as an output
- Dev toggle for mock data (Phase 2 only; removed in Phase 4)

## Known Limitations

1. User must **select "AirPlay Status" as an AirPlay output** each session (or save an AirPlay group). **iPhone multi-room** with HomePods/AP2 speakers requires an **AirPlay 2** receiver (Linux/Pi) — not macOS Homebrew; see [docs/multi-room-airplay.md](../docs/multi-room-airplay.md).
2. Metadata quality depends on the **source app** — Apple Music is rich; some apps send title only or no artwork.
3. **Not passive** — cannot read status from speakers you do not also stream to.
4. **Local network only** — sender and receiver must be on the same LAN.
5. **macOS 15.4+** system Now Playing APIs are restricted; this approach bypasses that by being a receiver.

## P0 Implementation Status

| Step | Goal | Status |
|---|---|---|
| Scaffolding | Spec, AGENTS.md, README, git init | Done |
| Wireframe UI | Mock data + nothing-playing toggle | Done |
| Sidecar | shairport-sync install docs, metadata pipe reader | Done |
| Live metadata | Pipe reader → dashboard (SSE) | Done |

**P0 is complete.** Production polish (launchd, structured logs, Grafana, agent/human debugging SOPs) lives in **[P99 — prod readiness](./p99-prod-readiness.md)**, implemented last in iteration 1.

## Roadmap (P1–P6, P99)

Future work extends the same playback state from `/api/status`. Specs live in this directory:

| Phase | Goal | Status | Spec |
|---|---|---|---|
| **P1** | Web play/pause/prev/next via DACP | Spec | [p1-remote-control.md](./p1-remote-control.md) |
| **P2** | Tidbyt now-playing push | Spec | [p2-tidbyt.md](./p2-tidbyt.md) |
| **P3** | Kindle/eInk read-only display | Spec | [p3-eink-display.md](./p3-eink-display.md) (incl. [P3.1 device profiles](./p3-eink-display.md#p31-side-quest--device-profiles)) |
| **P4** | eInk transport controls | Spec | [p4-eink-controls.md](./p4-eink-controls.md) |
| **P5** | Cross-platform deployment (Pi bare metal, Docker, Synology) | Reference | [p5-deployment.md](./p5-deployment.md) |
| **P49** | Pre-prod / local beta (RPi4, AirPlay 2) | Spec | [p49-preprod-deployment.md](./p49-preprod-deployment.md) |
| **P99** | Production readiness | Spec | [p99-prod-readiness.md](./p99-prod-readiness.md) |

### Feasibility summary (P1–P5)

| Phase | Feasible? | Confidence | Main risk |
|-------|-----------|------------|-----------|
| **P1** Web controls | **Conditional** | Medium | Apple deprecated DACP on iOS 17.4+; iPhone may ignore play/pause/skip even when commands send |
| **P2** Tidbyt | **Yes** | High | Custom apps don't auto-refresh — server pushes WebP on a schedule |
| **P3** Kindle display | **Yes** | High | Browser path is simplest; jailbreak fetch path for always-on wall display |
| **P4** Kindle controls | **Conditional** | Medium | Same DACP limits as P1; browser UI can expose buttons but iPhone may not respond |
| **P5** Non-Mac deploy | **Yes** | High on RPi; Medium on Docker; Low on Synology | mDNS discovery requires host networking / Avahi |

**Suggested implementation order:** P1 spike → P3 browser `/eink` → P2 Tidbyt → P4 → **P49 beta (RPi4)** → P99 prod. P5 remains platform reference doc.

## File Structure (Target)

```
airplay-status/
├── specs/
│   ├── p0-airplay-status.md
│   ├── p1-remote-control.md
│   ├── p2-tidbyt.md
│   ├── p3-eink-display.md
│   ├── p4-eink-controls.md
│   ├── p5-deployment.md
│   ├── p6-echo-show.md
│   ├── p99-prod-readiness.md
│   └── README.md
├── docs/
│   ├── debug-capture.md
│   └── shairport-setup.md
├── config/
│   ├── shairport-sync.conf.example
│   └── eink-devices.example.json   # P3.1
├── bin/
│   ├── run-local.sh
│   └── read-metadata.sh
├── src/
│   ├── index.js
│   ├── services/
│   │   ├── mockPlaybackService.js
│   │   └── airplayMetadataService.js
│   ├── views/
│   │   └── index.ejs
│   └── public/
│       └── css/
│           └── style.css
├── AGENTS.md
├── README.md
├── package.json
└── .gitignore
```

## References

- [shairport-sync](https://github.com/mikebrady/shairport-sync)
- [shairport-sync-metadata-reader](https://github.com/mikebrady/shairport-sync-metadata-reader)
- [shairport-metadata-display](https://github.com/AlainGourves/shairport-metadata-display) — prior art for metadata → web UI
- [App Code Labs: AirPlay metadata on Raspberry Pi](https://appcodelabs.com/show-artist-song-metadata-using-airplay-on-raspberry-pi)

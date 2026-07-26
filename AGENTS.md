# AGENTS.md — Context for AI Assistants

This file captures project intent, decisions, and constraints so any agent can continue work without re-deriving context from chat history.

## Project Name

**airplay-status** — a local dashboard showing what is currently playing via AirPlay.

- **Repo:** https://github.com/ritz-ras1245/airplay-status

## Origin

This project spun off from an earlier repo (`spotify-now-playing` in `~/workspace/vscodium/test`) that planned to use the Spotify Web API. After evaluation, we pivoted to AirPlay because:

1. The user wanted status for **whatever is playing to AirPlay speakers**, not just Spotify.
2. AirPlay speakers have no public metadata API — you cannot passively monitor them.
3. The proven pattern is to run a **virtual AirPlay receiver**, add yourself as an additional output, and capture metadata while discarding audio.

We evaluated [Nowify](https://github.com/jonashcroft/Nowify) (Vue SPA + Spotify API) — same visual goal, different architecture. We are not forking it.

## Chosen Architecture: Option B (shairport-sync Sidecar)

| Option | Description | Decision |
|---|---|---|
| A — Pure Node | `@lox-audioserver/node-libraop` as RAOP receiver in Node | Rejected — AirPlay 1 only, flaky multi-room |
| **B — Sidecar** | **shairport-sync + metadata pipe + Node reader** | **Selected** — mature AirPlay 2, proven metadata path |

Flow:

```
Sender → [Real speakers + shairport-sync "AirPlay Status"] → metadata pipe → Node → Express UI
```

Audio from shairport-sync is **discarded** (dummy/pipe-to-/dev/null output).

## User Workflow

1. `./bin/run-local.sh` (or `--debug` for troubleshooting)
2. On iPhone/Mac: play music, select **real speakers + AirPlay Status** as outputs
3. Browser: http://localhost:3003 shows live metadata: image, progress bar, name, artist.

## Tech Conventions

- Node.js v20+, ES Modules, Express + EJS
- No `.env` for secrets (Keychain later if needed)
- Spec-driven — `specs/p0-airplay-status.md` + roadmap `specs/p1-*.md` … `specs/p6-*.md`
- Cloud-PR-ready specs follow `specs/cloud-cursor-pr-standard.md`
- Cloud agents: read `AGENT_START_HERE.md` on the feature branch before implementing
- Minimal scope; match existing code style
- Do not commit unless user asks

## Phase Plan

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **P0** — Live dashboard | ✅ Done | `specs/p0-airplay-status.md` — SSE, debug capture, sidecar |
| **P0** — Hardening | 🔲 Pending | launchd, install script |
| **P1** — Remote control | 📄 Spec | `specs/p1-remote-control.md` — DACP via Node |
| **P2** — Tidbyt | ✅ MVP | `specs/p2-tidbyt.md`, `integrations/tidbyt/` |
| **P3** — eInk display | 📄 Spec | `specs/p3-eink-display.md` (+ P3.1 profiles, on-demand PNG) |
| **P4** — eInk controls | 📄 Spec | `specs/p4-eink-controls.md` |
| **P5** — Deployment | 📄 Spec | `specs/p5-deployment.md` — Pi, Docker |
| **P6** — Echo Show | 📄 Spec | `specs/p6-echo-show.md` — Tier B push; monorepo `integrations/echo/` |

**Implementation order (from spec):** P1 spike → P3 `/eink` → P2 Tidbyt → P4 → P5 → P6.

**Cloud agent pickup:** checkout `feat/p6-echo-show`, read [AGENT_START_HERE.md](AGENT_START_HERE.md) — see [cloud-cursor-pr-standard.md](specs/cloud-cursor-pr-standard.md).

## Data Model

See `specs/p0-airplay-status.md`. Key fields: `isPlaying`, `title`, `artist`, `album`, `albumArt`, `progressMs`, `durationMs`, `source`, `updatedAt`.

P1 adds: `controlAvailable`, `controlReason`.

## What NOT To Do

- Do not store secrets in `.env`
- Do not play audio from the receiver
- Do not infer pause/disconnect from a single metadata field — use debug capture

## Debug Capture

```bash
./bin/run-local.sh --debug
# → http://localhost:3003/debug
```

See `docs/debug-capture.md`. Normal mode redirects `/debug` to `/`.

## Key Files

| Path | Purpose |
|------|---------|
| `src/services/airplayMetadataService.js` | Pipe watcher, session-end logic |
| `src/lib/metadataParser.js` | Playback state normalization |
| `src/lib/metadataPipeReader.js` | Binary pipe parser |
| `src/index.js` | Express app, `/api/status`, `/api/events` |
| `bin/run-local.sh` | Start shairport + dashboard |
| `config/eink-devices.example.json` | P3.1 eInk profile templates |

## Platform

- **Primary:** macOS, Homebrew shairport-sync (`mdns_backend = "dns-sd"`)
- **Production target (P5 spec):** Raspberry Pi 4/5 + Avahi

## References

- shairport-sync metadata: https://github.com/mikebrady/shairport-sync-metadata-reader
- iOS DACP limits: https://github.com/mikebrady/shairport-sync/issues/1858

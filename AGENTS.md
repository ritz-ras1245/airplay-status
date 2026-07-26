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
- Spec-driven — phase numbering in [specs/README.md](specs/README.md); `specs/p0-*.md` … `specs/p99-*.md` (iter 1), `p100+` (iter 2)
- Minimal scope; match existing code style
- Do not commit unless user asks

## Phase numbering

| Range | Meaning |
|-------|---------|
| **P0** | Foundation (dashboard) |
| **P1–P98** | Iteration 1 features |
| **P99** | Iteration 1 **production readiness** — implement **last** |
| **P100–P998** | Iteration 2 features |
| **P999** | Iteration 2 production readiness |

Full rules: [specs/README.md](specs/README.md).

## Production readiness (P99) — permanent definition

Do **not** use “P0 hardening” in new docs or specs. The canonical name is **P99 — production readiness** (or **P999** in iteration 2).

Whenever a spec, issue, or conversation says **hardening**, **prod readiness**, **P99**, or **P999**, it means **all** of the following (see [specs/p99-prod-readiness.md](specs/p99-prod-readiness.md)):

| Area | Includes |
|------|----------|
| **Persistence** | `bin/install.sh`, launchd/systemd, start on boot |
| **Logs** | Structured always-on logging (`[component]` prefixes, ISO timestamps, `LOG_LEVEL`); prod log dir (`~/Library/Logs/airplay-status/` on macOS) |
| **Observability** | Optional self-hosted **Grafana + Loki** stack (`config/observability/`); not SaaS |
| **Debugging SOPs** | `docs/sop/debugging-humans.md` + `docs/sop/debugging-agents.md` — same repro flow; agents use test markers + grep, no guessing |
| **Health** | `GET /api/health`, `bin/check-sidecar.sh` |
| **Runbooks** | `docs/prod-troubleshooting.md`, `docs/prod-macos.md` |

**Deep metadata debug** stays separate: `./bin/run-local.sh --debug` + [docs/debug-capture.md](docs/debug-capture.md) (not 24/7 prod).

P99 runs **after** feature phases for the release, not in parallel with P1–P98.

## Phase Plan

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **P0** — Live dashboard | ✅ Done | `specs/p0-airplay-status.md` — SSE, debug capture, sidecar |
| **P1** — Remote control | 📄 Spec | `specs/p1-remote-control.md` — DACP via Node |
| **P2** — Tidbyt | ✅ MVP | `specs/p2-tidbyt.md`, `integrations/tidbyt/` |
| **P3** — eInk display | 📄 Spec | `specs/p3-eink-display.md` (+ P3.1 profiles, on-demand PNG) |
| **P4** — eInk controls | 📄 Spec | `specs/p4-eink-controls.md` |
| **P5** — Deployment | 📄 Spec | `specs/p5-deployment.md` — Pi, Docker |
| **P99** — Prod readiness | 📄 Spec | `specs/p99-prod-readiness.md` — see permanent definition above |

**Implementation order (features):** P1 spike → P3 `/eink` → P2 Tidbyt ✅ → P4 → P5 → **P99 last**.

Feature work on other branches (e.g. P6 Echo Show on `feat/p6-echo-show`) merges independently; P99 applies to whatever is on `main` at ship time.

## Data Model

See `specs/p0-airplay-status.md`. Key fields: `isPlaying`, `title`, `artist`, `album`, `albumArt`, `progressMs`, `durationMs`, `source`, `updatedAt`.

P1 adds: `controlAvailable`, `controlReason`.

## What NOT To Do

- Do not store secrets in `.env`
- Do not play audio from the receiver
- Do not infer pause/disconnect from a single metadata field — use debug capture
- Do not label launchd/install-only work as “P0 hardening” — that is **P99**

## Debug Capture

```bash
./bin/run-local.sh --debug
# → http://localhost:3003/debug
```

See `docs/debug-capture.md`. Normal mode redirects `/debug` to `/`. For prod issues after P99, follow `docs/sop/` (once implemented).

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

## Cursor Cloud specific instructions

The Cloud VM is headless Linux with no AirPlay hardware, no `shairport-sync`, and no Bonjour/mDNS. The real receiver path (`./bin/run-local.sh`, `bin/setup-sidecar.sh`, `bin/run-shairport.sh`) cannot work here — do not try to install/run shairport-sync for feature testing.

- **Run the dashboard in mock mode** for all local development/testing: `USE_MOCK=true npm run dev` (dev = `node --watch`, hot reload). Serves on http://localhost:3003. `npm start` is the non-watch variant.
- In mock mode, `/api/status` and `/` return the built-in mock track; `/api/events` (SSE) is disabled (returns 404 — expected). Use `/?mock=true&state=nothing` to preview the idle "nothing playing" state.
- **Live mode without hardware:** running without `USE_MOCK` still boots (Express listens); it just logs a warning that shairport-sync isn't running and reports empty playback. Set `SKIP_SHAIRPORT_CHECK=1` to silence that warning.
- **No lint or automated tests** are configured (no `test`/`lint` scripts, no test framework). Only runtime scripts exist in `package.json`: `start`, `dev`, `watch:metadata`, `demo`.
- **Tidbyt push** (`src/services/tidbytPushService.js`) stays disabled unless `TIDBYT_DEVICE_ID` + `TIDBYT_API_TOKEN` are in `.env` and the `pixlet` CLI is installed (not present in the VM); startup prints a warning and the dashboard runs regardless.

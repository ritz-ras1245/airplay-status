# AGENTS.md — Context for AI Assistants

This file captures project intent, decisions, and constraints so any agent can continue work without re-deriving context from chat history.

## Project Name

**airplay-status** — a local dashboard showing what is currently playing via AirPlay.

- **Repo:** https://github.com/ritz-ras1245/airplay-status

## Origin

This project spun off from an earlier Spotify-now-playing experiment. After evaluation, we pivoted to AirPlay because:

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

### Dev (Mac — AirPlay 1)

1. `./bin/run-local.sh` (or `--debug` for troubleshooting)
2. On iPhone: play music, select **AirPlay Status only** (audio discarded; no multi-speaker with HomePods on Mac)
3. Browser: http://localhost:3003 shows live metadata

### Beta (P49 — RPi4, AirPlay 2)

1. Deploy per [specs/p49-preprod-deployment.md](specs/p49-preprod-deployment.md)
2. On iPhone: select **real speakers + AirPlay Status** together
3. Sign off beta checklist before P99

## Tech Conventions

- Node.js v20+, ES Modules, Express + EJS
- No `.env` for secrets (Keychain later if needed)
- Spec-driven — phase numbering in [specs/README.md](specs/README.md)
- **Global RVS** (semver, P100/P200, GitHub/Jira/ClickUp): Cursor rule `~/.cursor/rules/release-and-versioning.mdc` — **not in this repo**
- **This repo:** [docs/versioning.md](docs/versioning.md), [docs/releases/](docs/releases/)
- **Branches:** never commit on `main` — use `{action}/{user}/{description}` ([.github/BRANCH_POLICY.md](.github/BRANCH_POLICY.md)). Owner merges without PR; bots/agents/others **must open a PR**.
- Minimal scope; match existing code style
- Do not commit unless user asks

## Phase numbering

| Range | Meaning |
|-------|---------|
| **P0–P48** | Line 1 features |
| **P49** | Line 1 beta (RPi4) |
| **P99** | Line 1 **prod readiness** → release at **P100** = **1.0.0** |
| **P101–P148** | Line 2 features (after P100) |
| **P149** | Line 2 beta |
| **P199** | Line 2 **prod readiness** → release at **P200** = **2.0.0** |
| **P201–P248** | Line 3 features |
| **P249 / P299 / P300** | Line 3 beta / prod readiness / **3.0.0** release |

**Patches:** `1.0.x` on `release/1.x` while `main` is `2.0.0-dev`. Global rules: `~/.cursor/rules/release-and-versioning.mdc`.

## Dev → beta → prod pipeline

| Tier | Host | This project |
|------|------|--------------|
| **Dev** | Mac Studio | AirPlay **1**; `./bin/run-local.sh`; all features **except** iPhone multi-speaker + HomePods |
| **Pre-prod (P49)** | RPi4 | AirPlay **2** + nqptp; **beta sign-off** |
| **Prod readiness (P99)** | RPi4 | launchd, logs, Grafana, SOPs |
| **Release (P100)** | Prod | Tag **v1.0.0**; **`release/1.x`** for **1.0.x** patches |

**Dev caveat (permanent):** On iPhone from Mac receiver, select **only AirPlay Status**. Multi-room validated on **P49** only. [docs/multi-room-airplay.md](docs/multi-room-airplay.md)

**Versioning:** Pre-P100 = **0.y.z** (now **0.1.0**). [docs/versioning.md](docs/versioning.md) · global RVS: Cursor rule `~/.cursor/rules/release-and-versioning.mdc`

**Guideline:** [specs/guidelines/mac-dev-linux-beta.md](specs/guidelines/mac-dev-linux-beta.md)

## Global vs repo standards

| Scope | Location |
|-------|----------|
| **Global** — RVS, privacy rules | `~/.cursor/rules/` (local symlinks; not in this repo) |
| **This repo** — phases, API, ship records | [specs/README.md](specs/README.md), [docs/versioning.md](docs/versioning.md), [docs/releases/](docs/releases/) |

## Versioning and deploy identity

- **Source of truth:** `package.json` `version` (semver).
- **Runtime:** `GET /api/version` — optional `GIT_COMMIT`, `DEPLOY_PHASE`, `DEPLOY_HOST`.
- **CLI:** `./bin/check-version.sh http://<host>:3003`

## Production readiness (P99) — permanent definition

Do **not** use “P0 hardening” in new docs or specs. The canonical names are **P99 / P199 / P299** — prod readiness before **P100 / P200 / P300** release.

Whenever a spec says **hardening** or **prod readiness**, it means **all** of the following (see [specs/p99-prod-readiness.md](specs/p99-prod-readiness.md) — template for every line):

| Area | Includes |
|------|----------|
| **Persistence** | `bin/install.sh`, launchd/systemd, start on boot |
| **Logs** | Structured always-on logging (`[component]` prefixes, ISO timestamps, `LOG_LEVEL`); prod log dir (`~/Library/Logs/airplay-status/` on macOS) |
| **Observability** | Optional self-hosted **Grafana + Loki** stack (`config/observability/`); not SaaS |
| **Debugging SOPs** | `docs/sop/debugging-humans.md` + `docs/sop/debugging-agents.md` — same repro flow; agents use test markers + grep, no guessing |
| **Health** | `GET /api/health`, `GET /api/version`, `bin/check-sidecar.sh`, `bin/check-version.sh` |
| **Runbooks** | `docs/prod-troubleshooting.md`, `docs/prod-macos.md` |

**Deep metadata debug** stays separate: `./bin/run-local.sh --debug` + [docs/debug-capture.md](docs/debug-capture.md) (not 24/7 prod).

P99 runs **after P49 beta**, **before P100** release (`1.0.0`). P199 before P200, etc.

## Phase Plan

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **P0** — Live dashboard | ✅ Done | `specs/p0-airplay-status.md` — SSE, debug capture, sidecar |
| **P1** — Remote control | 📄 Spec | `specs/p1-remote-control.md` — DACP via Node |
| **P2** — Tidbyt | ✅ MVP | `specs/p2-tidbyt.md`, `integrations/tidbyt/` |
| **P3** — eInk display | ✅ MVP | `specs/p3-eink-display.md`, `/eink`, `/api/display/*.png` |
| **P4** — eInk controls | 📄 Spec | `specs/p4-eink-controls.md` |
| **P5** — Deployment | 📄 Spec | `specs/p5-deployment.md` — Pi, Docker (reference) |
| **P49** — Pre-prod beta | 📄 Spec — **next** | `specs/p49-preprod-deployment.md` — RPi4, AP2, Docker→bare metal |
| **P99** — Prod readiness | 📄 Spec | `specs/p99-prod-readiness.md` — see permanent definition above |

**Implementation order:** Features on **Mac dev** → **P49** beta → **P99** → **P100** release `1.0.0` → line 2 on `main` as `2.0.0-dev`.

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

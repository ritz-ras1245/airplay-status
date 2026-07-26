# AGENTS.md — Context for AI Assistants

This file captures project intent, decisions, and constraints so any agent can continue work without re-deriving context from chat history.

## Project Name

**airplay-status** — a local dashboard showing what is currently playing via AirPlay.

Repository path: `~/workspace/airplay-status`

## Origin

This project spun off from an earlier repo (`spotify-now-playing` in `~/workspace/vscodium/test`) that planned to use the Spotify Web API. After evaluation, we pivoted to AirPlay because:

1. The user wanted status for **whatever is playing to AirPlay speakers**, not just Spotify.
2. AirPlay speakers have no public metadata API — you cannot passively monitor them.
3. The proven pattern is to run a **virtual AirPlay receiver**, add it as an extra output, and capture metadata while discarding audio.

We evaluated [Nowify](https://github.com/jonashcroft/Nowify) (Vue SPA + Spotify API) — same visual goal, different architecture. We are not forking it.

## Chosen Architecture: Option B (shairport-sync Sidecar)

| Option | Description | Decision |
|---|---|---|
| A — Pure Node | `@lox-audioserver/node-libraop` as RAOP receiver in Node | Rejected — AirPlay 1 only, flaky multi-room |
| **B — Sidecar** | **shairport-sync + metadata pipe + Node reader** | **Selected** — mature AirPlay 2, proven metadata path |

Flow:

```
Sender → [Real speakers + shairport-sync] → metadata pipe → Node → Express UI
```

Audio from shairport-sync is **discarded** (dummy output backend). User hears only real speakers.

## User Workflow

1. Start `shairport-sync` (advertises as "AirPlay Status" on LAN).
2. Start Node dashboard (`npm start`).
3. On iPhone/Mac, begin playback and select AirPlay outputs: **real speakers + AirPlay Status**.
4. Browser shows live metadata. When playback stops or receiver is deselected, UI shows empty state.

## Tech Conventions

- **Node.js v20+**, ES Modules (`"type": "module"`)
- **Express + EJS** — server-rendered, no frontend framework
- **No `.env` files** — if secrets needed later (e.g. AirPlay password), use macOS Keychain
- **Spec-driven** — `docs/spec.md` is source of truth; update it when architecture changes
- **Incremental commits** — one phase per commit; user commits manually unless they say otherwise
- **Minimal scope** — match existing code style; no over-engineering

## UI Conventions (from prior wireframe work)

- Dark mode, Spotify-green accent, Inter font from Google Fonts
- Emoji icons for status (no custom icon packs unless requested)
- Album art only for cover images; use local placeholder in mock phase
- Toggle between "Now Playing" and "Nothing Playing" in Phase 2 (mock only)
- Phase tag badge in UI during development

## Data Model

See `docs/spec.md`. Key fields: `isPlaying`, `title`, `artist`, `album`, `albumArt`, `progressMs`, `durationMs`, `source`, `updatedAt`.

## Phase Plan

| Phase | Status | Deliverable |
|---|---|---|
| 1 — Spec & scaffolding | **Current** | docs/spec.md, AGENTS.md, README.md, .gitignore |
| 2 — Wireframe UI | Pending | EJS template, mock service, dark CSS |
| 3 — shairport-sync sidecar | Pending | config example, metadata reader script, install docs |
| 4 — Live metadata | Pending | Replace mock with pipe reader, artwork endpoint |
| 5 — Hardening | Pending | launchd plist, bin/run-local.sh, troubleshooting |

## What NOT To Do

- Do not use Spotify Web API — out of scope for this repo.
- Do not store secrets in `.env` or commit credentials.
- Do not assume AirPlay metadata is always complete — handle missing artwork/title gracefully.
- Do not play audio from the receiver — metadata only.
- Do not commit unless the user explicitly asks.

## GitHub Setup (Next Step After Phase 1)

User will create the GitHub repo. Agent provides:

```bash
git remote add origin https://github.com/<USER>/airplay-status.git
git branch -M main
git push -u origin main
```

## Prior Art / References

- shairport-sync metadata pipe: https://github.com/mikebrady/shairport-sync-metadata-reader
- Web UI from metadata: https://github.com/AlainGourves/shairport-metadata-display
- Tutorial: https://appcodelabs.com/show-artist-song-metadata-using-airplay-on-raspberry-pi

## Platform Notes

- **Primary target:** macOS (Mac Studio, darwin 25.x)
- shairport-sync via Homebrew: `brew install shairport-sync`
- Must compile shairport-sync with metadata support (`--with-metadata` or equivalent in modern builds)
- Linux/Raspberry Pi is supported by shairport-sync but not the initial focus

# Phase P11 — Media Status (multi-source, one-by-one)

**Status:** Cloud-PR ready (shell + mock Spotify)  
**Depends on:** P0 live metadata (`/api/status`, `/api/events`)  
**Follow-on:** [p12-spotify-source.md](./p12-spotify-source.md) — real Spotify Web API + controls  
**Standard:** [cloud-cursor-pr-standard.md](./cloud-cursor-pr-standard.md)  
**P50 soak:** Do **not** change Pi deploy paths, mDNS receiver name, or live dashboard title.

## Agent pickup prompt

```
Pickup and analyse specs/p11-media-status-sources.md.
Take it from end to end to a PR.

Follow specs/cloud-cursor-pr-standard.md.
Do not commit secrets. Do not force-push.
Do not rename the GitHub repo. Do not change the AirPlay picker name.
```

---

## Goal

Ship **AirPlay status** and **Spotify status + controls** as two honest sources on one board, without renaming this repo to something it is not.

The product on the glass is **Media Status**. Each source still keeps its own name. The board shows **one source at a time** (rotate or pin) — never a fused “now playing” card that mixes AirPlay metadata with Spotify controls.

P11 ships the identity, the source adapter shell, and a **mock Spotify** so the one-by-one board is visible without a Spotify developer app. P12 wires the real Spotify Web API.

---

## Why not rename `airplay-status`

| Option | Verdict |
|--------|---------|
| Rename the GitHub repo to `spotify-status` / `nowify` | Rejected — this project exists because AirPlay speakers have no public metadata API |
| Rename the GitHub repo to `media-status` now | Rejected through **P100** — breaks clone URLs, P49/P50 docs, Grafana dashboard id, P10 service names |
| Fork [Nowify](https://github.com/jonashcroft/Nowify) | Already rejected — Spotify-only, different architecture |
| Merge both protocols into one “best track” card | Rejected — AirPlay (what the speakers are playing) and Spotify (what the account/device is playing) can disagree |
| Two repos / two dashboards | Rejected — kiosk, Tidbyt, eInk, Echo, P7–P9 all want **one** surface that can show both, one by one |

**Locked names**

| Layer | Name | Can change? |
|-------|------|-------------|
| GitHub repo | `airplay-status` | Not before P100; optional later at P200 |
| AirPlay picker / mDNS | **AirPlay Status** (`deployStage.airplayReceiverName`) | No — that is the virtual speaker |
| Product / dashboard (when 2+ sources enabled) | **Media Status** | Yes — display brand only |
| Dashboard (AirPlay-only, live default) | **AirPlay Status** | Unchanged for P50 soak |
| Source adapters | `airplay`, `spotify` | Stable ids |

`source` on a snapshot stays the **sender/app label** (today: client name, “Spotify”, “Music”, “AirPlay”). That is not the adapter. The adapter id is a new additive field: **`sourceId`**.

AirPlaying Spotify to speakers produces `sourceId: "airplay"` with `source` often `"Spotify"`. The P12 Spotify adapter is a different card (`sourceId: "spotify"`) and may show the same track, a different device, or nothing.

---

## Architecture

```
                    Media Status board
                    (one card at a time)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     sourceId=airplay                  sourceId=spotify
     shairport-sync pipe               Spotify Web API (P12)
     + DACP controls (P1)              + player controls (P12)
```

```
Sender ──AirPlay──► speakers + "AirPlay Status" receiver ──pipe──► airplay adapter
Spotify app/Connect ──Web API────────────────────────────────────► spotify adapter
                                                                      │
                                                         sourceDisplayService
                                                         (focus + rotate + pin)
                                                                      │
                                              GET /api/status  = focused snapshot
                                              GET /api/sources = all adapters
                                              POST /api/sources/focus = pin
```

Existing clients (Tidbyt, kiosk, eInk, P7–P9, P10) keep calling **`GET /api/status`**. They see whichever source is focused. They do not get a split-screen or a merged track.

---

## Decisions (locked)

| ID | Decision |
|----|----------|
| D1 | Product name is **Media Status**. Repo and AirPlay picker stay **airplay-status** / **AirPlay Status**. |
| D2 | Sources are adapters with stable `sourceId`: `airplay` \| `spotify`. Do not overload `source`. |
| D3 | Show **one source at a time**. No fused card. No “newest timestamp wins” merge. |
| D4 | **Kiosk `/display`:** auto-rotate among sources that have a track. Skip idle adapters. |
| D5 | **Dashboard `/`:** same rotation, plus **source pills**. Clicking a pill **pins** that source (pause rotation) for `PIN_HOLD_MS`. |
| D6 | Rotate interval default **8000 ms** (`SOURCE_ROTATE_MS`). Pin hold default **30000 ms**. |
| D7 | `GET /api/status` remains the **focused** P0-shaped snapshot, plus additive `sourceId`. |
| D8 | New `GET /api/sources` lists every enabled adapter. New `POST /api/sources/focus` pins. |
| D9 | Mock mode (`USE_MOCK=true`) enables **both** adapters with two different tracks so rotation is obvious. Live default enables **airplay only** (P50-safe). |
| D10 | Live Spotify stays off until P12 (`ENABLE_SPOTIFY_SOURCE=1` is the explicit live flag; unused in P11). |
| D11 | Mock `/api/events` stays **404**. Mock UI polls `/api/status` + `/api/sources`. |
| D12 | Do not ship Spotify brand assets (no official logo). Badge is the word **Spotify** and optional colour. |
| D13 | P1 DACP controls apply only when focused `sourceId` is `airplay`. Spotify controls are P12. |
| D14 | No track dedupe when both adapters show the same title — each card is that adapter’s truth. |

---

## Data model

P0 snapshot, additive field only:

```json
{
  "isPlaying": true,
  "title": "Señorita",
  "artist": "Shawn Mendes, Camila Cabello",
  "album": "Señorita",
  "albumArt": "/images/album-art.png",
  "progressMs": 95000,
  "durationMs": 191000,
  "source": "AirPlay",
  "sourceId": "airplay",
  "updatedAt": "2026-08-26T04:00:00.000Z"
}
```

`GET /api/sources`:

```json
{
  "productName": "Media Status",
  "focusedId": "airplay",
  "rotateMs": 8000,
  "rotating": true,
  "pinned": false,
  "sources": [
    { "id": "airplay", "label": "AirPlay", "hasTrack": true, "playback": { } },
    { "id": "spotify", "label": "Spotify", "hasTrack": true, "playback": { } }
  ]
}
```

`POST /api/sources/focus` body: `{ "sourceId": "spotify" }` → same payload, `pinned: true`.

`GET /api/status?source=spotify` returns that adapter’s snapshot without pinning (test/debug).

---

## Configuration

| Variable | Default | Notes |
|----------|---------|--------|
| `SOURCE_ROTATE_MS` | `8000` | Focus dwell while rotating |
| `SOURCE_PIN_MS` | `30000` | Pin hold after a pill click |
| `ENABLE_SPOTIFY_SOURCE` | unset | Live-only opt-in; P11 mock ignores this and always includes Spotify |

No secrets in P11. No `.env` file in repo.

---

## File structure

| Path | Action |
|------|--------|
| `src/lib/sourceRotate.js` | Pure helpers: `hasTrack`, `visibleSourceIds`, `nextFocusId`, `resolveFocus` |
| `src/services/sourceDisplayService.js` | Focus, rotate timer, pin, board snapshot |
| `src/services/mockPlaybackService.js` | Two mock sources (AirPlay + Spotify) |
| `src/index.js` | `/api/sources`, `/api/sources/focus`, focused `/api/status` |
| `src/views/index.ejs` | Product title when multi-source; source pills |
| `src/views/display.ejs` | Source pills; load display JS in mock |
| `src/public/js/sourceBoard.js` | Pills + mock polling |
| `src/public/js/display.js` | Poll `/api/status` in mock (SSE stays live-only) |
| `src/public/css/style.css` | Pill styles |
| `src/public/css/display.css` | Kiosk source switcher |
| `test/sourceRotate.test.js` | Pure rotation |
| `test/sourceDisplayService.test.js` | Rotate / pin / single-source |
| `docs/media-status.md` | Product identity |
| `AGENTS.md`, `specs/README.md`, `README.md`, `docs/kiosk-display.md` | Index the phase |

---

## Implementation steps

1. Add `sourceRotate.js` + unit tests (no DOM, no timer).
2. Add `sourceDisplayService.js` with injected `now()` + `listSources()`.
3. Extend mock playback with a second Spotify track (different title/artist).
4. Wire `/api/status` to the focused snapshot; add `/api/sources` and `POST /api/sources/focus`.
5. Live path: enabled ids = `['airplay']` unless `ENABLE_SPOTIFY_SOURCE=1`. Mock: both.
6. Dashboard + kiosk: pills only when 2+ adapters enabled; mock polls; live SSE unchanged.
7. Dashboard title = **Media Status** only when 2+ adapters are enabled (mock). Live default title stays **AirPlay Status**.
8. Update docs listed above. Do not edit `deploy/rpi/` or `config/deploy/stages.json` receiver names.

---

## Automated tests

```bash
npm test
```

Cover:

- `(automated)` `nextFocusId` cycles airplay → spotify → airplay
- `(automated)` idle adapters are skipped
- `(automated)` single visible source does not rotate
- `(automated)` pin holds focus until `SOURCE_PIN_MS`
- `(automated)` mock `getMockSources()` returns two different titles

Cloud smoke (mock dashboard already running on :3003, or start it):

```bash
curl -sf http://localhost:3003/api/status
curl -sf http://localhost:3003/api/sources
curl -sf 'http://localhost:3003/api/status?source=spotify'
```

Expect `/api/sources` to list `airplay` and `spotify` with different titles. Expect `?source=spotify` to return the Spotify mock track.

---

## Acceptance criteria

- [ ] `(automated)` Rotation helpers and service tests pass via `npm test`
- [ ] `(automated)` Mock `/api/sources` lists both adapters; `/api/status?source=` selects one
- [ ] `(manual)` Mock dashboard shows **Media Status**, two pills, and the card switches AirPlay ↔ Spotify on the rotate interval
- [ ] `(manual)` Clicking a pill pins that source (card stops switching for the pin hold)
- [ ] `(manual)` Kiosk `/display` in mock rotates the same way (one card at a time)
- [ ] `(automated)` Live default still enables only `airplay` (no fake Spotify on a real receiver)
- [ ] Receiver name / `stages.json` AirPlay picker strings unchanged

---

## Out of scope (P11)

- Real Spotify OAuth, currently-playing, or Connect controls (P12)
- Renaming the GitHub repo or mDNS service
- Changing P1 DACP behaviour
- Fusing AirPlay + Spotify into one track
- Volume / seek
- Deploying this to the P50 soak Pi

---

## PR body template

```markdown
## Summary
- Media Status board: AirPlay + Spotify as separate sources, shown one by one
- Mock Spotify so rotation is visible without a Spotify app
- Repo and AirPlay picker names unchanged

## Automated verification
- [ ] npm test
- [ ] curl /api/sources (mock) lists airplay + spotify
- [ ] curl /api/status?source=spotify returns the Spotify mock track

## Manual setup & test (complete before merge)
- [ ] USE_MOCK=true dashboard: pills + rotation
- [ ] /display mock: one-by-one rotation
- [ ] Pill click pins the source
- [ ] Live mode (no ENABLE_SPOTIFY_SOURCE): still AirPlay-only title/card

## Spec
- specs/p11-media-status-sources.md
- specs/p12-spotify-source.md (follow-on, not implemented here)
```

# Phase P12 — Spotify source + controls

**Status:** Spec (not Cloud-PR ready — needs a Spotify app + token store)  
**Depends on:** [P11 Media Status shell](./p11-media-status-sources.md)  
**Does not replace:** P0 AirPlay metadata, P1 DACP (AirPlay-only)

## Goal

Fill the P11 `spotify` adapter with the **Spotify Web API**: now-playing status and transport controls that actually work on modern phones (unlike DACP on iOS 17.4+).

This is how Spotify status + controls ship **next to** AirPlay, not instead of it. The Media Status board still shows them **one by one**.

---

## Why a second adapter (not “Spotify inside AirPlay”)

| Need | AirPlay adapter | Spotify adapter |
|------|-----------------|-----------------|
| What the **speakers** are playing (Music, YouTube, podcasts, Spotify-over-AirPlay) | Yes | No |
| What the **Spotify account / Connect device** is playing (headphones, phone speaker, Connect speaker) | No | Yes |
| Reliable play/pause/skip on current iPhone | Weak (DACP, P1) | Yes (player API) |
| Works when AirPlay Status is **not** selected | No | Yes |

P1 already lists **Spotify Connect API** as out of scope. That stays true for P1. P12 is the dedicated phase.

---

## Architecture

```
Media Status ──focus──► sourceId=spotify
                            │
                            ▼
                   spotifyPlaybackService
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
     GET /me/player                POST /me/player/{play,pause,next,previous}
     (currently-playing)           (only when focused source is spotify)
```

`POST /api/control/:action` (P1) becomes a **router**:

- focused `sourceId === 'airplay'` → DACP
- focused `sourceId === 'spotify'` → Spotify player API
- else → `controlAvailable: false`

Do not send DACP commands for a Spotify-adapter card, and do not send Spotify player commands for an AirPlay card.

---

## Decisions (locked)

| ID | Decision |
|----|----------|
| D1 | Spotify Web API currently-playing + player endpoints. Not Spotify Connect reverse-engineering. Not DACP. |
| D2 | OAuth **PKCE**. No client secret in the repo. No `.env` for tokens. |
| D3 | Token store: macOS Keychain in dev; `0600` file on Pi (path outside git). Same pattern P2 noted for Tidbyt. |
| D4 | Adapter id remains `spotify`. Snapshot shape matches P0 + `sourceId`. |
| D5 | Enable with `ENABLE_SPOTIFY_SOURCE=1` **and** a valid token. Without a token the adapter is idle (no fake track in live). |
| D6 | Do not deploy onto the P50 soak Pi until soak sign-off. Mac first. |
| D7 | Still no official Spotify logo in the repo. |
| D8 | Scopes: `user-read-currently-playing` `user-read-playback-state` `user-modify-playback-state`. |

## Open decisions (`DECISION REQUIRED` before Cloud-PR ready)

| ID | Question | Notes |
|----|----------|-------|
| OD1 | Spotify Developer app **Client ID** (owner-created) | Agent cannot create this. Document the redirect URI `http://127.0.0.1:3003/api/spotify/callback` (loopback). |
| OD2 | Redirect / auth UX | Suggested: `/setup` already exists for Tidbyt — extend it, or a dedicated `/spotify/login`. |
| OD3 | Which Connect device to control when several are active | Suggested: Spotify’s current device; no device picker in v1. |

---

## Configuration (no secret values)

| Variable | Required | Notes |
|----------|----------|--------|
| `ENABLE_SPOTIFY_SOURCE` | Yes to enable | `1` |
| `SPOTIFY_CLIENT_ID` | Yes | Public PKCE client id — still not committed if treated as sensitive; inject at runtime |
| `SPOTIFY_REDIRECT_URI` | No | Default loopback `/api/spotify/callback` |

Refresh tokens never go in git, Cursor rules, or chat logs.

---

## Out of scope (P12)

- Replacing the AirPlay receiver
- Controlling Apple Music / YouTube
- Queue / lyrics / volume / seek (can follow later)
- Forking Nowify
- Renaming this GitHub repo

---

## Suggested file structure (when OD1–OD3 lock)

| Path | Role |
|------|------|
| `src/services/spotifyPlaybackService.js` | Poll currently-playing, map to P0 snapshot |
| `src/lib/spotifyAuth.js` | PKCE start + callback |
| `src/lib/spotifyPlayerClient.js` | Player API |
| `src/routes/spotifyRoutes.js` | login + callback |
| `test/spotifyPlaybackService.test.js` | Mapping fixtures, no live API |

---

## Success criteria (after ODs lock)

- [ ] Live Spotify adapter populates `GET /api/sources` when a track is playing
- [ ] Media Status board rotates AirPlay ↔ Spotify when both have tracks
- [ ] Focused Spotify card: play/pause/next/prev hit the Spotify player API
- [ ] Focused AirPlay card: still DACP (P1), never Spotify player
- [ ] No tokens in git

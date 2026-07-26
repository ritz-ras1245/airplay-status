# Phase P2 — Tidbyt Integration

**Status:** Implemented (MVP — needs device testing)  
**Depends on:** Phase 4 live metadata (`/api/status`)  
**Optional dependency:** P1 not required (display-only)

## Goal

Show AirPlay now-playing on a [Tidbyt](https://tidbyt.com/) device (64×32 LED matrix), similar to community Spotify status apps: album art thumbnail, title, artist, and playing/paused indicator.

## Feasibility

| Aspect | Assessment |
|--------|------------|
| **Overall** | **Yes** — well-documented push API and Pixlet toolchain |
| **Live updates** | Requires **server-side push loop** for private/custom apps |
| **Auto-refresh on device** | Only via [Tidbyt community app](https://github.com/tidbyt/community) or Tidbyt Plus; not assumed for P2 MVP |

Custom Pixlet apps pushed via `pixlet push` **do not run on the Tidbyt** — the device displays a WebP image until the server pushes again ([Tidbyt docs](https://tidbyt.dev/docs/integrate/pushing-apps)).

## Architecture

```
┌──────────────────┐
│ airplay-status   │
│ /api/status      │
└────────┬─────────┘
         │ poll on playback change
         ▼
┌──────────────────┐     render      ┌─────────────┐
│ tidbytPushService│ ──────────────► │ WebP 64×32  │
└────────┬─────────┘                 └──────┬──────┘
         │ POST /v0/devices/.../push       │
         ▼                                 ▼
┌──────────────────┐                 ┌─────────────┐
│ Tidbyt Cloud API │ ──────────────► │ Tidbyt device│
└──────────────────┘                 └─────────────┘
```

Alternative: Pixlet `.star` fetches `http://<host>:3003/api/status` directly during `pixlet render` (requires Tidbyt servers to reach LAN — **not viable** for home LAN). **Decision:** render on the airplay-status host, push WebP.

## Renderer choice

| Option | Pros | Cons |
|--------|------|------|
| **Pixlet `.star` in repo** (default) | Native Tidbyt ecosystem, good fonts/animations | Requires `pixlet` CLI on host |
| Node `canvas` / `@resvg/resvg-js` | Pure Node, no Pixlet install | More custom layout code |

**Decision:** `integrations/tidbyt/airplay-status.star` — Pixlet reads JSON from stdin or env during render; shell wrapper passes `/api/status` snapshot.

## Display layout (64×32)

```
┌──────────────────────────────────────────────────────────────┐
│ ┌────┐  Title (marquee if long)                              │
│ │ art│  Artist                                               │
│ │16x │  ▶ or ⏸                                               │
│ └────┘                                                       │
└──────────────────────────────────────────────────────────────┘
```

- **Art:** 16×16 or 20×20 dithered thumbnail from `albumArt` URL (fetch in render script)
- **Title:** Marquee scroll if > ~12 chars
- **Artist:** Static or truncated
- **Status:** Small play/pause glyph from `isPlaying`
- **Empty state:** "Nothing playing" + AirPlay icon

## Configuration

Environment variables (no `.env` file in repo; inject at runtime per project conventions):

| Variable | Required | Description |
|----------|----------|-------------|
| `TIDBYT_ENABLED` | No | `1` to start push loop |
| `TIDBYT_DEVICE_ID` | Yes if enabled | Device ID from Tidbyt app |
| `TIDBYT_API_TOKEN` | Yes if enabled | API token from Tidbyt app |
| `TIDBYT_INSTALLATION_ID` | No | Default `airplaystatus` (alphanumeric only) |

Future: macOS Keychain storage for token (same pattern as planned Spotify pivot).

## Push service (`src/services/tidbytPushService.js`)

**Triggers:**

1. **On change** — subscribe to `onPlaybackChange()` when title/artist/art/play state changes (ignores progress-only updates)
2. **No heartbeat** — only push while something is playing; idle/stopped sessions do not push

**Push flow:**

1. Fetch current state from `getPlaybackState()`
2. Shell out or use Pixlet programmatic render:
   ```bash
   curl -s http://localhost:3003/api/status | pixlet render integrations/tidbyt/airplay-status.star -o /tmp/tidbyt.webp
   ```
3. Push via API:
   ```bash
   pixlet push --installation-id airplaystatus "$TIDBYT_DEVICE_ID" /tmp/tidbyt.webp
   ```
   Or REST:
   ```
   POST https://api.tidbyt.com/v0/devices/{deviceID}/push
   Authorization: Bearer {token}
   { "image": "<base64 webp>", "installationID": "airplaystatus" }
   ```

**Error handling:**

- Log push failures; do not crash Node process
- Exponential backoff on repeated API errors (max 5 min)
- Disable after N consecutive failures until `TIDBYT_ENABLED` restart

## CLI helper

`bin/push-tidbyt.sh` — one-shot render + push for testing without enabling loop:

```bash
#!/usr/bin/env bash
# Requires: pixlet, TIDBYT_DEVICE_ID, TIDBYT_API_TOKEN
curl -s http://localhost:3003/api/status \
  | pixlet render integrations/tidbyt/airplay-status.star -o /tmp/tidbyt.webp
pixlet push --installation-id airplaystatus "$TIDBYT_DEVICE_ID" /tmp/tidbyt.webp
```

## Integration with `run-local.sh`

Optional flag (future): `TIDBYT_ENABLED=1 ./bin/run-local.sh`

Or document as separate env when starting:

```bash
TIDBYT_ENABLED=1 TIDBYT_DEVICE_ID=... TIDBYT_API_TOKEN=... ./bin/run-local.sh
```

## File structure (planned)

```
integrations/tidbyt/
├── airplay-status.star    # Pixlet app
├── README.md              # pixlet install, push instructions
bin/
└── push-tidbyt.sh         # manual push helper
src/services/
└── tidbytPushService.js
```

## Acceptance criteria

- [ ] Tidbyt shows current track within 60s of playback start *(needs device test)*
- [ ] Title/artist update on track change *(needs device test)*
- [x] Idle session removes installation from Tidbyt rotation (no lingering frame)
- [x] Installation persists in Tidbyt app rotation (`--installation-id`)
- [x] Manual `bin/push-tidbyt.sh` works for debugging *(requires pixlet + credentials)*

## Future: P2b — Community app

Publishing to [tidbyt/community](https://github.com/tidbyt/community) enables Tidbyt-hosted refresh without home server push loop. Requires:

- Public HTTPS endpoint OR Tidbyt-hosted fetch to user's LAN via proxy (complex)
- App review process

**Defer** until private push loop is stable.

## Out of scope (P2)

- Tidbyt transport controls (see P4 concept for eInk; Tidbyt has no touch)
- Multiple Tidbyt devices (single device ID for MVP)
- Album art animation

## References

- [Tidbyt: Pushing apps](https://tidbyt.dev/docs/integrate/pushing-apps)
- [Pixlet GitHub](https://github.com/tidbyt/pixlet)
- [Custom Tidbyt via cron](https://everythingisgray.com/2023/05/24/custom-tidbyt-apps/) — push loop pattern

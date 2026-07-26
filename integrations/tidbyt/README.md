# Tidbyt Integration

Push AirPlay now-playing metadata to a [Tidbyt](https://tidbyt.com/) device (64×32 LED matrix).

Custom apps pushed via the Tidbyt API do not auto-refresh on the device — this project renders a WebP on your Mac and pushes it when playback metadata changes.

Spotify-style layout: **32×32 album art**, marquee title (green) and artist (white), progress bar. No header, no idle screen.

Pushes only when a track has a title or artist. Progress updates re-push in ~5% steps while playing.

## Prerequisites

1. **Pixlet CLI** (macOS):

   ```bash
   brew install tidbyt/tidbyt/pixlet
   ```

2. **Tidbyt credentials** — in the Tidbyt mobile app: **Settings → Get API Key**. Note your **Device ID** and **API token**.

3. **Local `.env` file** (gitignored):

   ```bash
   cp .env.example .env
   # Edit .env — set TIDBYT_DEVICE_ID and TIDBYT_API_TOKEN
   ```

4. **Dashboard running** — `./bin/run-local.sh` (or mock mode for layout testing).

## Manual push (testing)

With music playing (or mock data):

```bash
cp .env.example .env   # if you haven't already
# Fill in TIDBYT_DEVICE_ID and TIDBYT_API_TOKEN in .env
./bin/push-tidbyt.sh
```

Preview the render locally without pushing:

```bash
STATUS=$(curl -s http://localhost:3003/api/status)
pixlet render integrations/tidbyt/airplay-status.star \
  "status=${STATUS}" \
  base_url=http://localhost:3003 \
  -o /tmp/tidbyt-preview.webp
open /tmp/tidbyt-preview.webp
```

## Automatic push loop

Start the dashboard (`.env` is loaded automatically). Tidbyt push **starts on its own** when both credentials are in `.env` and `pixlet` is installed:

```bash
./bin/run-local.sh
```

At startup you'll see either:

```
✓  Tidbyt push enabled (pixlet: /opt/homebrew/bin/pixlet)
```

or a warning explaining what's missing (e.g. pixlet not installed) — the dashboard still runs.

Set `TIDBYT_ENABLED=0` in `.env` to skip Tidbyt entirely and hide the startup warning.

| Variable | Default | Description |
|----------|---------|-------------|
| `TIDBYT_DEVICE_ID` | — | Required for push |
| `TIDBYT_API_TOKEN` | — | Required for push |
| `TIDBYT_ENABLED` | auto | Set to `0` to disable |
| `TIDBYT_INSTALLATION_ID` | `airplaystatus` | Alphanumeric only; persists in Tidbyt app rotation |

Pushes while a track is playing; **deletes the installation** when the session ends so it leaves Tidbyt rotation entirely.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ┌────────┐  Title (marquee, green)                           │
│ │        │  Artist (marquee, white)                          │
│ │  art   │  Playing / Paused (small)                              │
│ │  32×32 │  ████████░░░░ progress bar                           │
│ └────────┘                                                   │
└──────────────────────────────────────────────────────────────┘
```

On disconnect, calls `DELETE /v0/devices/.../installations/airplaystatus` — the app is removed from rotation until the next track pushes again.

## Files

| File | Purpose |
|------|---------|
| `airplay-status.star` | Pixlet renderer — reads JSON `status` config |
| `../../bin/push-tidbyt.sh` | One-shot render + push |
| `../../src/services/tidbytPushService.js` | Push while playing, delete installation when idle |

See [specs/p2-tidbyt.md](../../specs/p2-tidbyt.md) for full design.

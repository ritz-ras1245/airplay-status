# AirPlay Status — DeskThing / Car Thing app (P8)

An always-on now-playing console for a **Spotify Car Thing** running
[DeskThing](https://deskthing.app/). It shows live airplay-status metadata,
keeps the display awake while playing, sleeps when idle, and shows a
**"tap to resume"** splash when playback returns to a console that was focused
when it dimmed. See the spec: [`../../specs/p8-deskthing-carthing.md`](../../specs/p8-deskthing-carthing.md).

> **Status: authored, device-test pending.** This app is written against the
> documented DeskThing SDK but has **not** been built/run on hardware in CI —
> it needs a DeskThing host + Car Thing. Only the shared state machine has
> automated tests (`node --test`). Pin your DeskThing SDK version (OD5) and
> verify SDK method names before shipping.

## Architecture (OD1 = A)

```
DeskThing host (Mac/PC/NUC)                Car Thing (DeskThing client)
  server/index.ts                            src/App.tsx
   • poll airplay-status /api/status          • render now-playing / idle
   • shared always-on state machine           • report focus (visibilitychange)
   • push { playback, state } → client        • tap-to-resume → dismissNudge
        │
        ▼
  airplay-status  /api/status   ──(down?)──▶  FALLBACK_URL (P10 gateway)
```

Playback truth stays in airplay-status (spec D4); the Car Thing never runs an
AirPlay receiver. Shared behaviour lives in
[`shared/alwaysOnState.js`](shared/alwaysOnState.js) (same rules as P7/P9).

## Settings

| Setting | Default | Notes |
|---------|---------|-------|
| `airplayStatusUrl` | `http://airplay-status.home.arpa:3003` | Base URL of airplay-status |
| `fallbackUrl` | — | P10 gateway URL tried when primary fails |
| `idleGraceSec` | `45` | Seconds idle before the display sleeps |
| `pollSec` | `3` | `/api/status` poll interval |

## Develop

```bash
npm install
npm run dev      # local client dev
npm run build    # → dist/ ; zip and load into DeskThingServer
npm test         # node --test: shared always-on state machine
```

Then load the built app into the DeskThing server and initialize it onto the
Car Thing. For flashing/pairing the Car Thing, see
[`docs/hardware.md`](docs/hardware.md).

## Mapping notes (OD2 / OD3)

- **Screen off (OD2):** the client dims the panel from `state.screen === 'dim'`;
  map this to the DeskThing sleep/backlight API of your pinned version for true
  backlight-off.
- **Resume (OD3):** `state.nudge` renders the full-screen "tap to resume" splash;
  optionally also fire a DeskThing notification/auto-wake on your version.

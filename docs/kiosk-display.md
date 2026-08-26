# Kiosk display view (`/display`)

An immersive, full-viewport "now playing" surface for **always-on displays**
(wall tablet, Car Thing, iPad, spare monitor). It is the shared **web surface**
the P7–P9 always-on clients are meant to point at, per
[specs/guidelines/always-on-display-client.md](../specs/guidelines/always-on-display-client.md).

It consumes the existing P0 metadata pipeline only — `GET /api/status` and the
`GET /api/events` SSE stream. It does **not** add a second metadata source.

## URL

```
http://<host>:3003/display
http://<host>:3003/display?client=android   # optional per-client CSS hook
http://<host>:3003/display?client=deskthing
http://<host>:3003/display?client=ipad
```

`?client=` adds a `kiosk--<name>` body class for future per-client tweaks.
Unknown values are ignored. In **mock mode** the page renders a fixed track and
does not live-update (SSE is disabled in mock mode); in **live mode** it updates
in real time.

## Behaviour (shared always-on contract)

| Mode | When | Screen | Notes |
|------|------|--------|-------|
| **Playing / Paused** | `isPlaying` or a track title present | Kept awake via the [Screen Wake Lock API](https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API) | Live metadata + progress |
| **Idle** | Nothing playing / session cleared | After an ~8s grace the screen is dimmed and the wake lock released | Lightweight; waits for the next track |
| **Resume nudge** | Playback restarts while dimmed | Shows a full-screen **"Tap to resume"** overlay — but **only** if this client was the focused/foreground session when it dimmed (*focus-before-idle*) | Otherwise it un-dims silently, so idle displays around the house are not spammed |

The pure rules (`classifyPlayback`, `shouldHoldWakeLock`, `shouldNudgeResume`)
live in [`src/public/js/displayState.js`](../src/public/js/displayState.js) and
are unit-tested in [`test/displayState.test.js`](../test/displayState.test.js)
(`npm test`). Browser wiring (SSE, wake lock, idle timer, overlay) is in
[`src/public/js/display.js`](../src/public/js/display.js).

## Scope

This is the platform-agnostic web view. The native P7 (Android), P8
(DeskThing/Car Thing), and P9 (iPad) shells and the P10 fallback gateway are
separate and remain idea-stage in `specs/` pending their locked decisions.

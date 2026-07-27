# Guideline — Always-on display clients

Shared behaviour for **P7 Android**, **P8 DeskThing / Car Thing**, and **P9 iPad**. Platform specs own packaging and OS APIs; this doc owns the product rules so the three clients stay consistent.

## Product goal

A thin shell around the airplay-status **webpage** (not a native UI rewrite). While something is playing, the shell keeps the screen awake and shows live now-playing. When idle, the shell releases the display. When playback resumes, it may nudge the user back — but only if they were actively using this client when the screen went dark.

## Modes

| Mode | When | Screen | Network |
|------|------|--------|---------|
| **Console / playing** | `isPlaying` or title/artist present (same semantics as dashboard idle vs playing) | Stay awake; prefer immersive / console presentation | SSE to `/api/events`; poll `/api/status` as fallback |
| **Idle** | Nothing playing / session cleared | Allow or force screen off after short grace | Keep a lightweight background watch (platform-dependent) |
| **Resume nudge** | Playback starts after idle screen-off | Notification / system alert: **tap to resume** | Only if **focus-before-idle** flag is set (below) |

## Focus-before-idle (critical)

Track a boolean session flag:

1. Set **true** when the always-on shell is **in foreground / focused** and enters idle → screen-off path.
2. Clear to **false** when the user leaves the app, switches away, closes the shell, or explicitly dismisses the always-on session.
3. On playback start while screen is off / shell backgrounded:
   - If flag **true** → fire **one** “Tap to resume” notification (or DeskThing equivalent).
   - If flag **false** → **silent**; do not spam.

Rationale: auto-wake only for the intentional kiosk/console session that just dimmed, not for every phone in the house that once opened the page.

## Display URL

Default primary URL (LAN):

```
http://airplay-status.home.arpa/
```

or host:port from config. Prefer the main dashboard (or a dedicated `?client=android|deskthing|ipad` query if a client-tuned layout is added later). Do **not** fork a second metadata pipeline — consume P0 `/api/status` + `/api/events`.

When primary host is unreachable, follow **[P10 local service fallback](../p10-local-service-fallback.md)** if configured.

## Non-goals (all three platforms)

- Replacing AirPlay audio routing
- Native DACP transport chrome (that is P1 / P4)
- Replacing Echo Show Tier B (P6) or Tidbyt push (P2)
- Playing audio from the receiver (project rule)

## Shared acceptance ideas

- Playing → screen stays on; metadata updates live
- Idle → screen allowed off within configured grace
- Focus-before-idle true + play resumes → single tap-to-resume nudge
- Focus-before-idle false + play resumes → no nudge
- Primary down + P10 configured → shell reaches fallback status page without crashing

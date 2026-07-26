# Phase P4 — eInk Display with Transport Controls

**Status:** Spec (pre-implementation)  
**Depends on:** [P3 eInk display](./p3-eink-display.md), [P1 remote control](./p1-remote-control.md)

## Goal

Extend the P3 eInk display with **play, pause, previous, and next** controls optimized for Kindle browser touch input. Controls send commands to the AirPlay **sender** (iPhone, iPod, Mac) via the same DACP path as the main web dashboard.

## Feasibility

| Aspect | Assessment |
|--------|------------|
| **Overall** | **Conditional** — UI is straightforward; control reliability matches P1 DACP limits |
| **Kindle browser + forms** | **Yes** — plain HTML POST works without JavaScript |
| **Kindle browser + fetch** | **Maybe** — test on device; forms are fallback |
| **PNG-only (kindle-dash)** | **No controls** — static image cannot accept input; remain P3 read-only |
| **iOS 17.4+ DACP** | **High risk** — same `ios_blocked` behavior as P1 |

**Decision:** Implement controls on **`/eink` browser path only**. PNG fetch path stays read-only per P3.

## Architecture

```
Kindle browser (/eink)
        │
        ├── GET  /api/status (or server-render) ──► display state
        │
        └── POST /api/control/:action ──► playbackControlService (P1)
                                              │
                                              ▼
                                         dacpClient ──► iPhone / Mac sender
```

No new control protocol — P4 is a **second UI** over P1's `POST /api/control/:action`.

## Display

Same layout as P3 with an added **control row** below track info:

```
┌─────────────────────────────────────┐
│  [art]   Title                      │
│          Artist                     │
│          Album                      │
│          1:35 / 3:11  ⏸ Playing     │
│          [██████░░░] (optional)    │
├─────────────────────────────────────┤
│   ◀◀      ▶ / ⏸      ▶▶            │
│  Prev     Play/Pause    Next        │
└─────────────────────────────────────┘
```

### Touch targets

- Minimum **48×48 px** per button (Kindle touch accuracy)
- High-contrast borders; no hover-only affordances
- Labels under icons for clarity on grayscale eInk

## Control implementation

### Primary: HTML forms (no JS required)

Each button is a separate form posting to P1 API:

```html
<form method="POST" action="/api/control/prev">
  <button type="submit" aria-label="Previous track">◀◀</button>
</form>
<form method="POST" action="/api/control/toggle">
  <button type="submit" aria-label="Play or pause">▶</button>
</form>
<form method="POST" action="/api/control/next">
  <button type="submit" aria-label="Next track">▶▶</button>
</form>
```

After POST, redirect back to `/eink` so the user sees updated state:

```
POST /api/control/:action → 303 See Other → Location: /eink
```

Optional query param `?control=ok` or `?control=failed&reason=...` for inline message on redirect.

### Secondary: JavaScript fetch (optional enhancement)

If Kindle browser supports `fetch`:

```js
await fetch('/api/control/pause', { method: 'POST' });
location.reload();
```

Use only after device testing; forms remain the reliable baseline.

## Disabled / unavailable state

Mirror P1 `controlAvailable` and `controlReason` from playback state (or server-render from same service):

| Condition | UI |
|-----------|-----|
| `controlAvailable === true` | Buttons enabled |
| `controlAvailable === false` | Buttons disabled (`disabled` attribute); reason text below row |
| No active track | Hide control row or show disabled with "Nothing playing" |
| `controlReason === "ios_blocked"` | Explain that iPhone may not respond on this iOS version |

**Do not hide buttons** when unavailable — show them disabled with explanation (same honesty as main dashboard).

### Reason display (user-facing)

| `controlReason` | Message |
|-----------------|---------|
| `no_session` | Select AirPlay Status as an output |
| `dacp_probe_failed` | Remote control unavailable for this session |
| `ios_blocked` | Your iPhone may not accept remote commands (iOS 17.4+) |
| `ap2_unsupported` | AirPlay 2 remote control not supported |

## API usage

Reuses P1 endpoints unchanged:

```
POST /api/control/play
POST /api/control/pause
POST /api/control/toggle
POST /api/control/next
POST /api/control/prev
```

**Response handling on eInk:**

- Success: redirect to `/eink` (303)
- Failure: redirect to `/eink?control=failed&reason=<reason>` and show non-blocking message
- Do not use `alert()` — unreliable on Kindle browser

## Route changes (planned)

`src/index.js`:

- Extend `/eink` template with control row
- Control routes may accept `Accept: text/html` and redirect; JSON clients still get JSON body (same handler as P1)

Example dual response:

```js
// After control action
if (req.accepts('html')) {
  return res.redirect(303, `/eink?control=${ok ? 'ok' : 'failed'}&reason=${reason ?? ''}`);
}
res.json({ ok, action, reason });
```

## PNG path (kindle-dash)

**Not in scope for P4.**

Static PNG cannot receive touch input. Options for users who want controls on a jailbroken wall display:

1. Open Kindle browser to `/eink` instead of PNG cron
2. Keep kindle-dash on PNG for read-only; use phone for control

Document this split in README — do not attempt touch overlays on PNG.

## Configuration

Inherits P1 and P3 config. No new env vars required.

| Variable | Effect on P4 |
|----------|--------------|
| P1 DACP session fields | Required for controls to work |
| `EINK_REFRESH_SEC` | Display refresh when paused/idle |
| P3 segmented bar vars | When enabled, `refreshRateSec` adapts while playing; control POST → redirect recomputes segments |

See [P3 optional segmented progress bar](./p3-eink-display.md#optional-segmented-progress-bar--adaptive-refresh-low-priority).

## File structure (planned)

```
src/views/eink.ejs          # Add control row + flash message
src/public/css/eink.css     # Large touch buttons
src/index.js                # HTML redirect on control POST (optional)
```

P1 modules unchanged: `dacpClient.js`, `playbackControlService.js`.

## Acceptance criteria

- [ ] `/eink` shows prev / play-pause / next buttons when session active
- [ ] Form POST triggers control without JavaScript
- [ ] Redirect returns to `/eink` with visible feedback on failure
- [ ] Buttons disabled when `controlAvailable === false`
- [ ] At least one sender device responds in Classic AirPlay mode (same bar as P1)
- [ ] PNG endpoint unchanged (read-only)

## Acceptance test matrix

Extends P1 matrix on Kindle browser:

| # | Device | Action | Expected |
|---|--------|--------|----------|
| 1 | Kindle browser | Tap Pause while playing | Sender pauses; `/eink` shows paused after redirect |
| 2 | Kindle browser | Tap Next | New title after redirect |
| 3 | Kindle browser | Control with no session | Buttons disabled; message explains |
| 4 | iPhone iOS 17.4+ | Tap Pause | May fail; UI shows `ios_blocked` message, not false success |
| 5 | kindle-dash PNG | N/A | No controls on PNG (document only) |

Run P1 debug flow (`./bin/run-local.sh --debug`) for sender-side verification; eInk tests are manual on device.

## Out of scope (P4)

- Volume control
- Seek / scrub
- Controls on PNG or SVG endpoints
- Tidbyt controls (no touch input on LED matrix)
- Spotify Connect (non-AirPlay protocol)

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Kindle form POST flaky | Test early; keep one button per form (simplest POST) |
| Full page reload after control feels slow | Acceptable on eInk; optional fetch later |
| Same iOS DACP failures as P1 | Shared probe logic; shared `controlReason` in state |
| User expects PNG controls | Document browser-only for P4 |

## Success criteria

- [ ] Touch-friendly control row on `/eink`
- [ ] Works without JavaScript via HTML forms
- [ ] Reuses P1 API and DACP session — no duplicate control logic
- [ ] Honest failure UX when sender ignores commands

## References

- [p1-remote-control.md](./p1-remote-control.md) — DACP client, API, iOS caveats
- [p3-eink-display.md](./p3-eink-display.md) — browser and PNG display paths
- [shairport-sync #1858](https://github.com/mikebrady/shairport-sync/issues/1858) — iOS DACP limitations

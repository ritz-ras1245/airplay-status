# iPad always-on display (web + Guided Access) — P9 MVP

This is the **P9 MVP** path (Open Decision **OD1 = B**): use an iPad as a spare
always-on now-playing console with **no native app** — just Safari, a Home Screen
web app, and Guided Access. It reuses the kiosk display view shipped in P0/P3
work: [`docs/kiosk-display.md`](kiosk-display.md).

> Native Swift/WKWebView (OD1 = A) is only needed if you require a reliable
> "tap to resume" **notification while the screen is fully off**. The web path
> below covers live display, screen-on-while-playing, and the on-screen
> resume overlay — see limitations at the end.

## Display URL

Point the iPad at the kiosk view with the iPad client tuning:

```
http://<airplay-status-host>:3003/display?client=ipad
```

`?client=ipad` enables safe-area insets (notch / home indicator) and larger tap
targets. If you run the [P10 fallback gateway](../specs/p10-local-service-fallback.md),
use its stable hostname instead (e.g. `http://airplay-status.home.arpa/display?client=ipad`)
so the iPad still lands on a status page when the primary host is down.

## One-time setup on the iPad

1. **Add to Home Screen**
   - Open the Display URL in **Safari**.
   - Share → **Add to Home Screen**. Launching from the Home Screen icon runs it
     full-screen (standalone web app), hiding Safari chrome.
2. **Keep the screen on while docked**
   - Settings → Display & Brightness → **Auto-Lock**. For an always-on wall/dock
     display on constant power, set a long Auto-Lock (or **Never**); the page also
     requests the Screen Wake Lock while playback is active. Prefer a real long
     Auto-Lock for reliability, since Safari cannot hold a wake lock indefinitely
     in all iPadOS versions.
3. **Lock it to this one app (Guided Access)**
   - Settings → Accessibility → **Guided Access** → On; set a passcode.
   - Launch the Home Screen web app, triple-click the side/top button, **Start**.
   - This prevents accidental swipes away from the console.
4. **Optional: fallback URL**
   - Bookmark the P10 gateway URL as your primary so a dead Pi shows the status
     page instead of a Safari error.

## Behaviour (shared always-on contract)

Provided by the kiosk view — see [`docs/kiosk-display.md`](kiosk-display.md):

- **Playing:** immersive now-playing, screen kept awake (Wake Lock), live via SSE.
- **Idle:** after an ~8s grace the page dims itself (screen-off intent).
- **Resume (focus-before-idle):** if this iPad was the focused console when it
  dimmed, a full-screen **"Tap to resume"** overlay appears when playback restarts;
  otherwise it un-dims silently.

## Limitations of the web-only path (OD1 = B)

- iPadOS Safari **cannot force the backlight fully off** as precisely as a native
  app; rely on Auto-Lock for true screen-off.
- **No background/system notification** while the screen is off — the resume nudge
  is the on-screen overlay, shown when the app is foregrounded. If you need a
  push-style "tap to resume" while the display is asleep, promote to **OD1 = A**
  (native WKWebView shell) per [`specs/p9-ipad-always-on.md`](../specs/p9-ipad-always-on.md).

## Acceptance (web path)

- [x] iPad shows live now-playing while playing; updates via SSE (kiosk view)
- [x] Idle → page dims / Auto-Lock allows screen off
- [x] Focus-before-idle → play → on-screen tap-to-resume overlay
- [ ] `(device)` Verify on one iPadOS version and record in acceptance notes
- [ ] `(manual)` Optional P10 fallback when primary URL fails

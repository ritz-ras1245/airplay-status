# Phase P7 — Android always-on WebView client

**Status:** Authored — `integrations/android/` (device-test pending; not built in CI — no Android SDK in cloud).  

**Decisions locked:** OD1 = A (`integrations/android/` monorepo) · OD2 = minSdk 26 / targetSdk 34 · OD3 = A (system timeout screen-off, no Device Owner) · OD4 = A (short foreground service + native `/api/status` poll). Shared always-on rules in `integrations/android/app/src/main/java/app/airplaystatus/alwayson/AlwaysOnState.kt` (JVM unit-tested).  
**Depends on:** P0 live metadata (`/api/status`, `/api/events`)  
**Optional dependency:** [P10 local service fallback](./p10-local-service-fallback.md)  
**Shared behaviour:** [guidelines/always-on-display-client.md](./guidelines/always-on-display-client.md)  
**Layout:** Monorepo under `integrations/android/` (preferred) unless Open Decision OD1 chooses a separate repo  
**Standard:** [cloud-cursor-pr-standard.md](./cloud-cursor-pr-standard.md) (apply when promoted to Cloud-PR ready)

## Agent pickup prompt

```
Pickup and analyse specs/p7-android-always-on.md and
specs/guidelines/always-on-display-client.md.
Take it from end to end to a PR once Status is Cloud-PR ready
and Decisions (locked) are complete.

Follow specs/cloud-cursor-pr-standard.md.
```

---

## Goal

Ship a **tiny standalone Android app** that wraps the airplay-status webpage in a console / kiosk-style WebView. While something is playing, the app keeps the screen on. When nothing is playing, it allows (or forces) screen off. If playback starts again **and** the app was in focus when it went idle, show a **“Tap here to resume”** notification — not a silent background reopen, and not a nudge if the user had already left the app.

---

## Architecture

```
┌──────────────────────────────┐
│ Android app (P7)             │
│  WebView → DISPLAY_URL       │
│  Foreground service / wake   │
│  focus-before-idle flag      │
│  Notification on resume      │
└──────────────┬───────────────┘
               │ HTTP + SSE
               ▼
┌──────────────────────────────┐
│ airplay-status (RPi / Mac)   │
│  GET /  + /api/status        │
│  GET /api/events (SSE)       │
└──────────────┬───────────────┘
               │ unreachable?
               ▼
┌──────────────────────────────┐
│ P10 fallback gateway         │
│  status page + port probes   │
└──────────────────────────────┘
```

**Client stays thin:** no second metadata parser on Android. WebView loads the existing dashboard; native code owns wake lock, screen-off, and notification rules.

---

## Decisions (locked from idea)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **WebView shell**, not a native Compose now-playing UI | Matches “webpage viewer / console mode”; reuses P0 UI |
| D2 | **Auto screen off when nothing playing** after configurable grace (default 30–60s) | Battery + intentional kiosk behaviour |
| D3 | **Keep screen on while playing** (`FLAG_KEEP_SCREEN_ON` / wake lock while foreground playing) | Always-on console when content exists |
| D4 | **Resume notification only if focus-before-idle** | Per shared guideline; avoid spam |
| D5 | **Notification copy:** “Tap here to resume” → brings app to foreground / restores WebView | User request |
| D6 | **Consume P0 APIs only** for playback truth | Project architecture |
| D7 | **Configurable DISPLAY_URL** (default LAN host for airplay-status) | Home network varies |

---

## Open decisions

| ID | Question | Options | Notes |
|----|----------|---------|-------|
| **OD1** | Repo layout | A) `integrations/android/` monorepo · B) separate `airplay-status-android` repo | Prefer A for Cloud-PR simplicity |
| **OD2** | Min SDK / target | e.g. API 26+ vs tablet-only API 29+ | Affects wake / notification APIs |
| **OD3** | Idle screen-off | A) system timeout only · B) app-initiated `DEVICE_POLICY` / screen off where permitted | Many consumer devices cannot force screen off without Device Owner |
| **OD4** | Background watch while screen off | A) short-lived FGS + SSE/poll · B) WorkManager poll only | Battery vs latency |
| **OD5** | Sideload vs Play Store | Sideload APK for home use (default) | No public store required for MVP |

Mark **DECISION REQUIRED** on OD1–OD4 before Cloud-PR ready.

---

## Configuration

| Key | Required | Description |
|-----|----------|-------------|
| `DISPLAY_URL` | Yes | Primary dashboard URL (e.g. `http://airplay-status.home.arpa:3003/`) |
| `FALLBACK_URL` | No | P10 status URL when primary fails |
| `IDLE_GRACE_SEC` | No | Default `45` — seconds after idle before allowing screen off |
| `POLL_FALLBACK_SEC` | No | Default `5` if SSE unavailable from native watch |

Store in app SharedPreferences / build config — not in server `.env` secrets.

---

## Repository layout (proposed)

| Path | Purpose |
|------|---------|
| `integrations/android/README.md` | Build, sideload, permissions |
| `integrations/android/app/` | Android Studio project (WebView Activity + service) |
| `docs/android-always-on.md` | Human setup (optional mirror of README) |
| `specs/p7-android-always-on.md` | This spec |

Server changes: none required for MVP unless adding `?client=android` CSS tweaks later.

---

## Implementation steps (when Cloud-PR ready)

1. Scaffold Android app with single Activity + WebView loading `DISPLAY_URL`
2. Implement playing vs idle detection via injected JS bridge **or** native poll of `/api/status` (prefer native poll for wake logic so WebView sleep does not stall detection)
3. Keep screen on while playing; enter idle path after grace
4. Persist focus-before-idle; clear on `onStop` when leaving app intentionally
5. Post one high-priority notification on play resume when flag set; tap → `MAIN` Activity
6. Optional: probe `FALLBACK_URL` when primary health check fails
7. Document sideload + required permissions (notifications, foreground service, battery exemption)

---

## Automated tests

| Test | Notes |
|------|-------|
| Unit: focus-before-idle state machine | Pure JVM tests; no device |
| Unit: idle grace / notification gating | Same |
| Instrumentation (optional) | Manual on device for MVP |

CI without Android SDK: document skip; run JVM unit tests if Gradle available.

---

## Acceptance criteria

- [ ] `(device)` While playing, screen stays on with live WebView updates
- [ ] `(device)` When nothing playing, screen turns off / is allowed off after grace
- [ ] `(device)` App was focused → idle screen-off → play starts → single “Tap here to resume” notification
- [ ] `(device)` User left app before idle → play starts → **no** notification
- [ ] `(device)` Tap notification restores console WebView
- [ ] `(manual)` Primary unreachable + `FALLBACK_URL` set → fallback page loads (P10)

---

## Out of scope (P7)

- Play Store listing / Google Play billing
- Transport controls beyond what the webpage already exposes (P1)
- Echo / Tidbyt / eInk replacements
- Root / Device Owner MDM profiles (may be a later hardening path for forced screen-off)

---

## PR body template (copy into PR)

```markdown
## Summary
- P7 Android always-on WebView client (`integrations/android/`)

## Automated verification
- [ ] JVM unit tests for focus-before-idle / notification gating

## Manual setup & test (complete before merge)
- [ ] Sideload APK on target Android device
- [ ] Set DISPLAY_URL to LAN airplay-status
- [ ] Play → screen stays on; idle → screen off
- [ ] Focused idle → play → tap-to-resume notification
- [ ] Backgrounded before idle → play → no notification
- [ ] Optional: kill RPi / block port → FALLBACK_URL (P10)

## Spec
- specs/p7-android-always-on.md
- specs/guidelines/always-on-display-client.md
```

---

## References

- Shared behaviour: [guidelines/always-on-display-client.md](./guidelines/always-on-display-client.md)
- P0 dashboard + SSE: [p0-airplay-status.md](./p0-airplay-status.md)
- Fallback gateway: [p10-local-service-fallback.md](./p10-local-service-fallback.md)

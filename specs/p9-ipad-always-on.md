# Phase P9 — iPad always-on fallback client

**Status:** MVP delivered (web path) — runbook at [../docs/ipad-guided-access.md](../docs/ipad-guided-access.md); reuses the kiosk view `GET /display?client=ipad`.  

**Decision locked:** OD1 = B (Safari Home-Screen web app + Guided Access) for the MVP. Promote to OD1 = A (native WKWebView) only if a resume notification while the screen is fully off becomes mandatory (see limitations in the runbook).  
**Depends on:** P0 live metadata (`/api/status`, `/api/events`)  
**Optional dependency:** [P10 local service fallback](./p10-local-service-fallback.md)  
**Shared behaviour:** [guidelines/always-on-display-client.md](./guidelines/always-on-display-client.md)  
**Layout:** Prefer thin wrapper; see OD1  
**Standard:** [cloud-cursor-pr-standard.md](./cloud-cursor-pr-standard.md) (apply when promoted to Cloud-PR ready)

## Agent pickup prompt

```
Pickup and analyse specs/p9-ipad-always-on.md and
specs/guidelines/always-on-display-client.md.
Take it from end to end to a PR once Status is Cloud-PR ready
and Decisions (locked) are complete.

Follow specs/cloud-cursor-pr-standard.md.
```

---

## Goal

Provide an **iPad fallback** always-on console for airplay-status: same playing / idle / focus-before-idle resume rules as Android (P7), using the existing webpage as the visual surface. iPad is the spare wall/table display when a dedicated Android tablet or Car Thing is unavailable — not a second product identity.

---

## Architecture

```
┌──────────────────────────────┐
│ iPad shell (P9)              │
│  WKWebView or Safari Guided  │
│  Access / Home Screen web app│
│  idle + notification rules   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ airplay-status               │
│  dashboard + SSE             │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ P10 fallback (optional)      │
└──────────────────────────────┘
```

---

## Decisions (locked from idea)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Same behaviour contract as P7** | User: “similar for iPad” |
| D2 | **Webpage-first visuals** | Reuse P0 UI; avoid SwiftUI now-playing rewrite for MVP |
| D3 | **iPad as fallback client**, not primary architecture | Android / DeskThing may be preferred hardware; iPad fills gaps |
| D4 | **No App Store requirement for MVP** if OD1 chooses web + Guided Access | Home LAN sideload / web clip acceptable |

---

## Open decisions

| ID | Question | Options | Notes |
|----|----------|---------|-------|
| **OD1** | Delivery vehicle | A) Tiny native Swift WKWebView app (TestFlight / sideload) · B) Safari + Home Screen web app + Guided Access · C) Both: B for MVP, A if notifications need native | B is fastest; A needed for reliable idle notifications while “screen off” |
| **OD2** | Screen off | Guided Access + Auto-Lock vs native `idleTimer` control | Safari alone cannot force screen off as precisely as a native app |
| **OD3** | Resume notification | Local notification from native app vs no notification on pure web path | Focus-before-idle nudge likely **requires OD1=A** (or Shortcuts automation — fragile) |
| **OD4** | Repo | `integrations/ipad/` monorepo vs separate Xcode repo | Prefer monorepo if native |

**Recommendation:** MVP path **OD1=B** for display-only; promote to **OD1=A** when resume notifications are mandatory for parity with P7.

Mark **DECISION REQUIRED** on OD1 before Cloud-PR ready.

---

## Configuration

| Key | Required | Description |
|-----|----------|-------------|
| Display URL | Yes | Bookmark / app config → airplay-status dashboard |
| Fallback URL | No | P10 status page |
| Idle grace | No | Native app setting if OD1=A |

---

## Repository layout (proposed)

### If OD1 = native app (A)

| Path | Purpose |
|------|---------|
| `integrations/ipad/README.md` | Xcode build, sideload / TestFlight |
| `integrations/ipad/App/` | Swift WKWebView shell |
| `specs/p9-ipad-always-on.md` | This spec |

### If OD1 = web + Guided Access (B)

| Path | Purpose |
|------|---------|
| `docs/ipad-guided-access.md` | Setup: Home Screen, Guided Access, Auto-Lock, P10 URL |
| Optional `public/` CSS tweaks via `?client=ipad` | Large-tap idle chrome |
| `specs/p9-ipad-always-on.md` | This spec |

---

## Implementation steps (when Cloud-PR ready)

1. Lock OD1; scaffold native app **or** write Guided Access runbook
2. Wire display URL + optional fallback
3. If native: implement idle timer, focus-before-idle, local notification “Tap here to resume”
4. If web-only: document limitations (no reliable background resume nudge) in README
5. Device-test on one iPadOS version; record in acceptance notes

---

## Automated tests

| Path | Tests |
|------|-------|
| Native | Unit tests for focus-before-idle state machine |
| Web-only | Doc + optional Playwright smoke against dashboard `?client=ipad` if added |

---

## Acceptance criteria

- [ ] `(device)` iPad shows live now-playing while playing; updates via SSE/poll
- [ ] `(device)` Idle allows screen off / Auto-Lock per chosen OD1 path
- [ ] `(device)` If native path: focus-before-idle → play → single tap-to-resume notification
- [ ] `(manual)` Documented setup works without Mac developer machine on the iPad itself (web path) **or** with one-time sideload (native path)
- [ ] `(manual)` Optional P10 fallback when RPi `:80` / primary URL fails

---

## Out of scope (P9)

- iPhone-optimized shell (may work; not the target)
- App Store public release
- Replacing P6 Echo Show routines
- MDM / Apple Configurator fleet management (optional later)

---

## PR body template (copy into PR)

```markdown
## Summary
- P9 iPad always-on fallback client

## Automated verification
- [ ] (native) Unit tests for focus-before-idle
- [ ] (web) Docs present; optional CSS/query smoke

## Manual setup & test (complete before merge)
- [ ] Configure Display URL on iPad
- [ ] Play / idle behaviour per OD1
- [ ] Resume nudge if native path
- [ ] Optional P10 fallback

## Spec
- specs/p9-ipad-always-on.md
- specs/guidelines/always-on-display-client.md
```

---

## References

- Shared behaviour: [guidelines/always-on-display-client.md](./guidelines/always-on-display-client.md)
- P7 Android (parity target): [p7-android-always-on.md](./p7-android-always-on.md)
- P10 fallback: [p10-local-service-fallback.md](./p10-local-service-fallback.md)

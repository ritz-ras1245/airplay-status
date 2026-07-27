# Phase P8 — DeskThing / Car Thing always-on client

**Status:** Spec (idea — not Cloud-PR ready)  
**Depends on:** P0 live metadata (`/api/status`, `/api/events`)  
**Optional dependency:** [P10 local service fallback](./p10-local-service-fallback.md)  
**Shared behaviour:** [guidelines/always-on-display-client.md](./guidelines/always-on-display-client.md)  
**Layout:** Monorepo under `integrations/deskthing/` (app + host bridge as needed)  
**Standard:** [cloud-cursor-pr-standard.md](./cloud-cursor-pr-standard.md) (apply when promoted to Cloud-PR ready)

## Agent pickup prompt

```
Pickup and analyse specs/p8-deskthing-carthing.md and
specs/guidelines/always-on-display-client.md.
Take it from end to end to a PR once Status is Cloud-PR ready
and Decisions (locked) are complete.

Follow specs/cloud-cursor-pr-standard.md.
```

---

## Goal

Port the same **always-on when playing / screen-off when idle / tap-to-resume when focus-before-idle** behaviour to a **Spotify Car Thing** running **[DeskThing](https://deskthing.app/)** (community desktop companion stack). The Car Thing becomes a small dedicated now-playing console for airplay-status — not a second metadata backend.

---

## Why DeskThing

Car Thing has no supported official app platform for arbitrary LAN WebViews. DeskThing provides a host app + device runtime used by the community to run custom “apps” on the hardware. P8 targets that stack rather than reverse-engineering Spotify firmware.

---

## Architecture

```
┌────────────────────┐     DeskThing protocol      ┌────────────────────┐
│ DeskThing host     │ ◄─────────────────────────► │ Car Thing device   │
│ (Mac/PC on LAN)    │                             │ DeskThing client   │
└─────────┬──────────┘                             └─────────┬──────────┘
          │                                                  │
          │  fetch / SSE                                     │ render
          ▼                                                  ▼
┌────────────────────┐                             now-playing UI
│ airplay-status     │                             (or WebView surface
│ /api/status|events │                              if host proxies HTML)
└─────────┬──────────┘
          │ down?
          ▼
┌────────────────────┐
│ P10 fallback       │
└────────────────────┘
```

Exact render path depends on OD1 (native DeskThing app vs host-proxied WebView).

---

## Decisions (locked from idea)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Same product rules as P7/P9** (playing awake, idle dim, focus-before-idle resume nudge) | User: “similar thing” |
| D2 | **DeskThing port**, not stock Spotify Car Thing OS | Only practical custom-app path |
| D3 | **Read-only display MVP** — no DACP chrome required | Aligns with P2/P3/P6 display clients |
| D4 | **airplay-status remains source of truth** | No Car Thing-side AirPlay receiver |

---

## Open decisions

| ID | Question | Options | Notes |
|----|----------|---------|-------|
| **OD1** | App shape | A) DeskThing app polls `/api/status` and renders native UI · B) Host opens/proxies existing dashboard HTML to device · C) Hybrid | A matches DeskThing app model best |
| **OD2** | “Screen off” on Car Thing | Map to DeskThing sleep / backlight / blank frame APIs available in target DeskThing version | Hardware cannot use Android wake locks |
| **OD3** | “Notification / tap to resume” | Map to DeskThing notification, app badge, or auto-wake + splash “tap” affordance | No Android notification shade |
| **OD4** | Host OS for DeskThing server | Mac (dev) vs always-on NUC/Pi | Car Thing usually needs nearby host |
| **OD5** | DeskThing version pin | Document tested DeskThing release | Breaking API risk |

Mark **DECISION REQUIRED** on OD1–OD3 before Cloud-PR ready.

---

## Configuration

| Key | Required | Description |
|-----|----------|-------------|
| `AIRPLAY_STATUS_URL` | Yes | Base URL of airplay-status |
| `FALLBACK_URL` | No | P10 gateway status URL |
| `IDLE_GRACE_SEC` | No | Default `45` |
| `POLL_SEC` | No | Default `2–5` if SSE not used on device path |

---

## Repository layout (proposed)

| Path | Purpose |
|------|---------|
| `integrations/deskthing/README.md` | Install DeskThing host, load app, pair Car Thing |
| `integrations/deskthing/app/` | DeskThing app source (per upstream app template) |
| `integrations/deskthing/docs/hardware.md` | Car Thing flash / pair notes (link out; no copyrighted blobs) |
| `specs/p8-deskthing-carthing.md` | This spec |

Do **not** commit Spotify firmware images or proprietary Car Thing binaries.

---

## Implementation steps (when Cloud-PR ready)

1. Spike DeskThing app hello-world on target DeskThing version; document host + device versions
2. Implement status client (`/api/status` poll and/or SSE via host)
3. Map playing → keep display awake; idle → sleep/blank after grace
4. Implement focus-before-idle equivalent (app was active console when idle entered)
5. On play + flag: wake + “tap to resume” UI (or DeskThing notify API)
6. Wire optional `FALLBACK_URL` when primary health fails
7. Update `AGENTS.md` phase row

---

## Automated tests

| Test | Notes |
|------|-------|
| Unit: idle / focus-before-idle state machine | Shared logic with P7 where possible |
| Unit: status JSON → view model | No Car Thing in CI |
| Manual device matrix | Required for acceptance |

---

## Acceptance criteria

- [ ] `(device)` Car Thing shows live now-playing while AirPlay session active
- [ ] `(device)` Idle → display sleeps/blanks after grace
- [ ] `(device)` Active-console idle → play resumes → single resume nudge / wake
- [ ] `(device)` User left DeskThing app before idle → play resumes → no nudge
- [ ] `(manual)` Primary down + fallback configured → status/fallback UX (P10)
- [ ] `(manual)` README covers flash/pair without redistributing proprietary images

---

## Out of scope (P8)

- Restoring official Spotify Car Thing features
- Using Car Thing as an AirPlay speaker
- Shipping DeskThing itself (depend on upstream)
- Android (P7) / iPad (P9) implementations

---

## PR body template (copy into PR)

```markdown
## Summary
- P8 DeskThing / Car Thing always-on client (`integrations/deskthing/`)

## Automated verification
- [ ] Unit tests for status mapping + focus-before-idle gating

## Manual setup & test (complete before merge)
- [ ] DeskThing host + Car Thing on documented versions
- [ ] Load airplay-status DeskThing app
- [ ] Play / idle / resume-nudge matrix (same as shared guideline)
- [ ] Optional P10 fallback when RPi unreachable

## Spec
- specs/p8-deskthing-carthing.md
- specs/guidelines/always-on-display-client.md
```

---

## References

- DeskThing project / docs: https://deskthing.app/ (verify current docs at implementation time)
- Shared behaviour: [guidelines/always-on-display-client.md](./guidelines/always-on-display-client.md)
- P7 Android (sibling behaviour): [p7-android-always-on.md](./p7-android-always-on.md)
- P10 fallback: [p10-local-service-fallback.md](./p10-local-service-fallback.md)

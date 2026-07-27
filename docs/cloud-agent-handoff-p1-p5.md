# Cloud Agent handoff — P1–P5 (while P49 beta soaks)

**Context:** P49 beta is **live on RPi4** (`airplay-beta.local`, HTTP **80**). **Do not modify the Pi** or P49 deploy paths unless fixing a beta blocker. Owner will review each PR **one by one** when back.

**Repo:** https://github.com/ritz-ras1245/airplay-status  
**Base branch:** `main` (includes P49 merge `1f94893`)  
**Mac dev:** `./bin/run-local.sh` · **Branch policy:** `.github/BRANCH_POLICY.md` · **Agent rules:** `AGENTS.md`

---

## Before starting any Cloud Agent

| Setting | Value |
|---------|--------|
| **Repository** | `ritz-ras1245/airplay-status` |
| **Starting ref** | `main` |
| **Branch prefix** (Cursor dashboard) | `feat/cursor` → e.g. `feat/cursor/p1-remote-control` |
| **Merge** | Open PR only — **do not merge to `main`** |

---

## Do not touch (soak period)

- Live Pi (`airplay-beta.local`) — no SSH deploys, no cred resets
- `deploy/rpi/install.sh` unless P49 beta blocker
- `feat/p6-echo-show` or other in-flight branches (merge independently)

---

## Phase queue

| Phase | Spec | Branch slug | Depends on | Can start now? |
|-------|------|-------------|------------|----------------|
| **P1** | [p1-remote-control.md](../specs/p1-remote-control.md) | `p1-remote-control` | P0 ✅ | **Yes** |
| **P3** | [p3-eink-display.md](../specs/p3-eink-display.md) | `p3-eink-display` | P0 ✅ | **Yes** |
| **P4** | [p4-eink-controls.md](../specs/p4-eink-controls.md) | `p4-eink-controls` | P1 + P3 | After P1/P3 merged, or stub APIs with TODO |
| **P5** | [p5-deployment.md](../specs/p5-deployment.md) | `p5-deployment-docs` | P49 ✅ | **Yes** — docs/sync only |
| ~~P2~~ | Tidbyt | — | — | **Done** (MVP) |
| ~~P49~~ | Beta | — | — | **Soaking** — no feature work |

Launch **P1** and **P3** in parallel first; **P5** in parallel (docs); **P4** after P1 or with explicit stubs.

---

## Copy-paste prompts (one Cloud Agent each)

### P1 — Remote control

```
Implement Phase P1 remote control for airplay-status.

Read first: AGENTS.md, specs/p1-remote-control.md, src/services/airplayMetadataService.js

Goal: Web dashboard play/pause/prev/next via Node DACP client using metadata pipe session fields (daid, dapo, clip). Expose POST /api/control/:action and controlAvailable on /api/status.

Constraints:
- Mac dev first (./bin/run-local.sh); do NOT change Pi deploy or SSH to beta Pi
- Branch: feat/cursor/p1-remote-control from main
- Match existing ES module + Express style; minimal scope per spec
- Document iOS DACP limitations in UI when control unavailable
- Open PR when done; do not merge

Test plan in PR: Mac Music → AirPlay Status only → exercise controls + /api/status
```

### P3 — eInk read-only display

```
Implement Phase P3 eInk read-only display for airplay-status.

Read first: AGENTS.md, specs/p3-eink-display.md, config/eink-devices.example.json

Goal: /eink browser page + on-demand PNG endpoint per spec (profiles, refresh interval, segmented progress). Uses /api/status data.

Constraints:
- Mac dev first; no Pi changes during P49 beta soak
- Branch: feat/cursor/p3-eink-display from main
- Minimal scope — read-only, no transport controls (that's P4)
- Open PR; do not merge

Test plan: curl PNG endpoint; optional Kindle/LAN browser if available; mock status OK for CI-less validation
```

### P4 — eInk controls (after P1 or with stubs)

```
Implement Phase P4 eInk transport controls for airplay-status.

Read first: AGENTS.md, specs/p4-eink-controls.md, specs/p1-remote-control.md

Goal: Add play/pause/prev/next to /eink browser UI via POST /api/control/:action (reuse P1 playbackControlService). Plain HTML forms for Kindle; PNG path stays read-only.

Constraints:
- Depends on P1 control API — if P1 not merged, implement against P1 spec interface with clear TODO or wait for P1 branch
- Branch: feat/cursor/p4-eink-controls from main (or merge P1 branch first if coordinated)
- No Pi deploy changes
- Open PR; do not merge

Test plan: /eink form POST on Mac; document iOS DACP limits same as P1
```

### P5 — Deployment docs (align with P49)

```
Update Phase P5 deployment documentation for airplay-status — do not re-build what P49 shipped.

Read first: AGENTS.md, specs/p5-deployment.md, deploy/rpi/README.md, docs/p49-rpi-bare-metal-lessons.md, deploy/docker/README-WARN.md

Goal: Refresh specs/p5-deployment.md and cross-links so they reflect current truth: Pi bare metal (Path B) is default; Docker optional; Mac dev AP1 limits; Pi port 80; P49 beta soak. No new install scripts unless fixing doc/code drift.

Constraints:
- Branch: feat/cursor/p5-deployment-docs from main
- Docs/spec focus — avoid unrelated code changes
- Open PR; do not merge
```

---

## Owner review checklist (when back)

For each PR, one at a time:

1. Read spec vs diff — scope creep?
2. `./bin/run-local.sh` smoke on Mac
3. No secrets, no personal paths (privacy check passes)
4. Pi untouched / no beta regressions
5. Merge → next PR

After soak (24h–1wk): P49 sign-off → **P99** prod readiness → **P100** `1.0.0`.

---

## Optional: P6 Echo Show

Separate branch `feat/p6-echo-show` — do not assign unless owner requests; merge independently of P1–P5.

# Cloud Agent handoff — P1–P6 (while P49 beta soaks)

**Context:** P49 beta is **live on RPi4** (`airplay-beta.local`, HTTP **80**). **Do not modify the Pi** or P49 deploy paths unless fixing a beta blocker. Owner will review each PR **one by one** when back.

**Repo:** https://github.com/ritz-ras1245/airplay-status  
**Base branch:** `main`  
**Cloud Agent environment:** **`airplay-status + standards`**  
**Mac dev:** `./bin/run-local.sh` · **Rules:** `AGENTS.md`, `.github/BRANCH_POLICY.md`, `specs/cloud-cursor-pr-standard.md`

---

## Cloud Agent settings (every thread)

| Setting | Value |
|---------|--------|
| **Repository** | `ritz-ras1245/airplay-status` |
| **Environment** | **`airplay-status + standards`** |
| **Starting ref** | `main` |
| **Branch prefix** | `feat/cursor` → e.g. `feat/cursor/p1-remote-control` |
| **Merge** | Open PR only — **do not merge to `main`** |

**Standards:** No secrets in repo. No personal paths. Privacy pre-push check must pass. Branch name `{action}/cursor/{slug}`.

---

## Do not touch (beta soak)

- Live Pi (`airplay-beta.local`) — no SSH deploys, no cred resets
- `deploy/rpi/install.sh` unless P49 beta blocker

---

## Phase queue — launch all in parallel

| Phase | Spec | Branch slug | Depends on |
|-------|------|-------------|------------|
| **P1** | [p1-remote-control.md](../specs/p1-remote-control.md) | `p1-remote-control` | P0 ✅ |
| **P3** | [p3-eink-display.md](../specs/p3-eink-display.md) | `p3-eink-display` | P0 ✅ |
| **P4** | [p4-eink-controls.md](../specs/p4-eink-controls.md) | `p4-eink-controls` | P1 API (implement per spec; stub if P1 not merged) |
| **P5** | [p5-deployment.md](../specs/p5-deployment.md) | `p5-deployment-docs` | P49 ✅ docs only |
| **P6** | [p6-echo-show.md](../specs/p6-echo-show.md) | `p6-echo-show` | P0 ✅ |
| ~~P2~~ | Tidbyt | — | Done |
| ~~P49~~ | Beta | — | Soaking |

---

## Shared prompt prefix (prepend to every agent)

```
Environment: airplay-status + standards.
Follow AGENTS.md, .github/BRANCH_POLICY.md, and specs/cloud-cursor-pr-standard.md strictly.
P49 beta Pi is SOAKING — do NOT change deploy/rpi/, do NOT SSH to airplay-beta.local.
Branch feat/cursor/<slug> from main. Open PR when done; do NOT merge to main.
Mac dev only for runtime testing (./bin/run-local.sh). Minimal scope — match spec exactly.
```

---

## P1 — Remote control

```
[Paste shared prefix above]

Implement Phase P1 per specs/p1-remote-control.md end-to-end.

Read: src/services/airplayMetadataService.js, specs/p1-remote-control.md

Deliver: Node DACP client; POST /api/control/:action; controlAvailable on /api/status; dashboard controls; iOS limitation UX.

Branch: feat/cursor/p1-remote-control
PR test plan: Mac Music → AirPlay Status only → controls + /api/status
```

---

## P3 — eInk read-only

```
[Paste shared prefix above]

Implement Phase P3 per specs/p3-eink-display.md end-to-end.

Read: config/eink-devices.example.json

Deliver: /eink browser page, on-demand PNG endpoint, profiles, refresh interval. Read-only — no transport controls.

Branch: feat/cursor/p3-eink-display
PR test plan: curl PNG; /eink in browser
```

---

## P4 — eInk controls

```
[Paste shared prefix above]

Implement Phase P4 per specs/p4-eink-controls.md end-to-end.

Depends on P1 POST /api/control/:action — if not on main, implement minimal playbackControlService per P1 spec in this branch (document in PR).

Deliver: /eink controls via HTML forms; PNG path stays read-only.

Branch: feat/cursor/p4-eink-controls
```

---

## P5 — Deployment docs

```
[Paste shared prefix above]

Update specs/p5-deployment.md and cross-links per specs/p5-deployment.md — align with P49 bare metal (deploy/rpi/), port 80, docs/p49-rpi-bare-metal-lessons.md, deploy/docker/README-WARN.md.

Docs/spec only — no unrelated code.

Branch: feat/cursor/p5-deployment-docs
```

---

## P6 — Echo Show (Tier B)

```
[Paste shared prefix above]

Pickup and analyse specs/p6-echo-show.md. Take it end-to-end to a PR per specs/cloud-cursor-pr-standard.md.

Deliver: integrations/echo/, echoPushService, /echo SSE UI, Lambda/API Gateway scaffold as spec defines. Tier B only — not Tier A kiosk.

PR body MUST include manual checklist: Alexa, AWS, DNS, Echo Show hookup and LAN testing.

Branch: feat/cursor/p6-echo-show
Do not commit secrets or ARNs.
```

---

## Owner review (when back)

Review PRs **one at a time**: spec vs diff → Mac smoke → privacy check → merge.

After soak: P49 sign-off → P99 → P100.

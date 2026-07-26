# Agent start here — P49 RPi4 beta

**Branch:** `feat/ritz-ras1245/p49-rpi-beta`  
**Read this file first**, then the spec. Do not work on `feat/p6-echo-show` (sibling agent).

---

## Pickup prompt (embedded — execute from file)

```
Implement P49 pre-prod deployment for airplay-status on Raspberry Pi 4 (AirPlay 2).

Read AGENT_START_HERE.md, then specs/p49-preprod-deployment.md end to end.

Goals:
1. Try Docker host-network on Pi first (deploy/docker/); document spike in docs/p49-docker-spike.md.
2. If spike fails, ship bare-metal Path B (deploy/rpi/install.sh, systemd, nqptp + shairport-sync AP2).
3. Enable iPhone multi-speaker: real HomePods + AirPlay Status together (not possible on Mac AP1).

Follow branch policy: work on this branch only; owner will merge to main without PR.
Do not commit unless user asks. Match existing code style. No secrets in repo.

Verify: GET /api/version with DEPLOY_PHASE=p49; ./bin/check-version.sh http://<pi>:3003

Branch naming: {action}/{user}/{description} — see .github/BRANCH_POLICY.md in this repo.

Cloud agent: open a PR when done; do not merge to main. Owner's global standards are local-only (not in this repo).
```

---

## Context (checkpoint 2026-07-26)

### What P49 is

First **real-environment beta** on **RPi4** with **AirPlay 2** + **nqptp**, so iPhone can select **HomePods + AirPlay Status** in one group. Mac dev (Homebrew shairport) stays **AirPlay 1 only** — that limitation is permanent for Mac; not a bug.

### Pipeline position

```
Mac dev (AP1, features) → P49 beta (RPi4, AP2) → P99 prod readiness → P100 release 1.0.0
```

| Item | Value |
|------|-------|
| Semver on `main` | **0.1.0** (pre-P100) |
| Version API | `GET /api/version` — `src/lib/appVersion.js` |
| Deploy check | `./bin/check-version.sh http://<host>:3003` |
| AP2 config example | `config/shairport-sync-airplay2.conf.example` |
| Multi-room doc | `docs/multi-room-airplay.md` |

### Already on `main` (do not re-derive)

- P0 dashboard, SSE, metadata sidecar ✅
- P2 Tidbyt MVP (`integrations/tidbyt/`) ✅
- Branch policy: `.github/BRANCH_POLICY.md`, hooks, CI
- P49 **spec only** — `specs/p49-preprod-deployment.md` (implementation is this branch)
- P99 spec — `specs/p99-prod-readiness.md` (after P49 sign-off)

### Not on `main` (other branches)

- **P6 Echo Show** — `feat/p6-echo-show` — leave alone

### Branch policy (this repo)

| Rule | Value |
|------|-------|
| Branch naming | `{action}/{user}/{description}` |
| Policy doc | [.github/BRANCH_POLICY.md](.github/BRANCH_POLICY.md) |
| Cloud agents | Open a **PR** — do not merge to `main` |

Owner's global engineering standards live on their local machine only — not in this public repo.

---

## Implementation deliverables (from spec)

### Path A — Docker (try first)

```
deploy/docker/docker-compose.yml    # host network
deploy/docker/Dockerfile
deploy/docker/README.md
bin/p49-up.sh
bin/p49-down.sh
docs/p49-docker-spike.md            # pass/fail; 1-day spike limit
```

**Spike fails if:** iPhone cannot discover receiver or AP2 multi-room fails → Path B.

### Path B — Bare Pi (fallback / likely for nqptp)

```
deploy/rpi/install.sh
deploy/rpi/systemd/                 # nqptp, shairport-sync, airplay-status
deploy/rpi/README.md
bin/p49-install-rpi.sh             # optional rsync from Mac
```

### Beta env on Pi

| Variable | Example |
|----------|---------|
| `DEPLOY_PHASE` | `p49` |
| `GIT_COMMIT` | short sha at deploy |
| `PORT` | `3003` |

Use `config/shairport-sync-airplay2.conf.example`. nqptp needs UDP **319/320** on host.

---

## Beta sign-off checklist (human + device)

From `specs/p49-preprod-deployment.md`:

- [ ] iPhone: **HomePods + AirPlay Status** in one AirPlay group
- [ ] Dashboard live metadata within 5s
- [ ] `GET /api/version` → `deployPhase=p49`, correct semver/commit
- [ ] 24h soak, reboot auto-start
- [ ] Fresh Pi install doc works (`deploy/rpi/README.md` or docker README)

---

## Suggested implementation order

1. Spike Docker on RPi4 → `docs/p49-docker-spike.md`
2. Path B if needed → systemd + AP2
3. `.env` on Pi (not committed) + deploy README
4. Soak + sign-off → then P99

---

## Key references

| Doc | Path |
|-----|------|
| **P49 spec** | [specs/p49-preprod-deployment.md](specs/p49-preprod-deployment.md) |
| Multi-room / AP1 vs AP2 | [docs/multi-room-airplay.md](docs/multi-room-airplay.md) |
| Versioning (repo) | [docs/versioning.md](docs/versioning.md) |
| P5 deployment (reference) | [specs/p5-deployment.md](specs/p5-deployment.md) |
| P99 (after beta) | [specs/p99-prod-readiness.md](specs/p99-prod-readiness.md) |
| Project agent context | [AGENTS.md](AGENTS.md) |
| shairport-sync BUILD | https://github.com/mikebrady/shairport-sync/blob/master/BUILD.md |
| nqptp | https://github.com/mikebrady/nqptp |

---

## Open cloud agent

1. Push branch `feat/ritz-ras1245/p49-rpi-beta` to GitHub.
2. Start Cursor Cloud Agent on this repo + branch.
3. Tell the agent: **Read `AGENT_START_HERE.md` and follow the pickup prompt.**

## Open new local Cursor window

1. Checkout this branch: `git checkout feat/ritz-ras1245/p49-rpi-beta`
2. Open workspace file: [airplay-status-p49.code-workspace](airplay-status-p49.code-workspace)  
   Or: **File → Open Folder** on this repo after checkout.
3. Tell the agent: **Read `AGENT_START_HERE.md` and follow the pickup prompt.**

---

## Revision

| Date | Change |
|------|--------|
| 2026-07-26 | P49 branch handoff — RPi4 beta, AP2, context dump |

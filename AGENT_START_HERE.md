# Agent start here — P49 RPi4 beta

**Branch:** `feat/ritz-ras1245/p49-rpi-beta`  
**Cloud environment:** `airplay-status + standards` (Cursor dashboard)  
**Read this file first**, then the spec. Do not work on `feat/p6-echo-show` (sibling agent).

---

## Pickup prompt (embedded — execute from file)

```
You are implementing P49 pre-prod deployment for airplay-status (Raspberry Pi 4, AirPlay 2).

Environment: Cursor cloud env "airplay-status + standards" (multi-repo; global rules via install-local.sh).
Branch: feat/ritz-ras1245/p49-rpi-beta — work only on this branch. Open a PR when done; do not merge to main.

Step 0 — Smoke tests (run before writing deploy code; stop and report if any fail):

  npm ci
  bash .cursor/cloud-bootstrap.sh
  test -L ~/.cursor/rules/release-and-versioning.mdc && echo "rules symlink ok"
  USE_MOCK=true SKIP_SHAIRPORT_CHECK=1 npm start &
  sleep 2
  curl -sf http://localhost:3003/api/version | head -c 200
  curl -sf 'http://localhost:3003/api/status?mock=true' | head -c 200
  kill %1 2>/dev/null || true
  echo "smoke tests passed"

Step 1 — Read AGENT_START_HERE.md (this file) and specs/p49-preprod-deployment.md end to end.

Step 2 — Implement P49 deliverables:
  1. Docker deploy — deploy/docker/README-WARN.md (includes limitations).
  2. Pi host bootstrap: deploy/rpi/install.sh (nqptp before compose).
  3. iPhone multi-speaker on Pi LAN (not Mac Docker).

Constraints:
- Do not commit unless user asks. Match existing code style. No secrets in repo.
- Cloud VM cannot validate iPhone/AirPlay/Pi hardware — document human sign-off steps clearly.
- Do not touch feat/p6-echo-show.

Step 3 — Before opening PR, re-run smoke tests above on the cloud VM (mock dashboard must still work).

Step 4 — Open PR to main with summary, deploy README paths, and human beta checklist for Pi + iPhone.
```

---

## Cloud agent handoff

| Setting | Value |
|---------|--------|
| **Repository** | `ritz-ras1245/airplay-status` |
| **Branch** | `feat/ritz-ras1245/p49-rpi-beta` |
| **Environment** | `airplay-status + standards` |
| **Entry point** | This file → pickup prompt above |
| **Merge** | **PR required** (cloud agent) |

Tell the agent:

> Read `AGENT_START_HERE.md` and follow the pickup prompt (Step 0 smoke tests first).

---

## Smoke tests (cloud VM)

Run these **before** and **after** P49 deploy artifact work. All must pass on the cloud agent machine.

| # | Command | Expected |
|---|---------|----------|
| 1 | `npm ci` | exits 0 |
| 2 | `bash .cursor/cloud-bootstrap.sh` | `found standards dependency checkout`; `install-local: cursor rule →` |
| 3 | `test -L ~/.cursor/rules/release-and-versioning.mdc` | rules symlink exists |
| 4 | `USE_MOCK=true SKIP_SHAIRPORT_CHECK=1 npm start` (background) | log: `AirPlay Status v0.1.0 (mock)` |
| 5 | `curl -sf http://localhost:3003/api/version` | JSON with `"version":"0.1.0"`, `"deployStage":"dev"` (or `"beta"` if `.env` set) |
| 6 | `curl -sf 'http://localhost:3003/api/status?mock=true'` | JSON playback payload |
| 7 | `./bin/check-version.sh http://localhost:3003` | pretty-printed version JSON |

Stop and report failures before implementing `deploy/`. Mock mode is required on cloud (no shairport-sync).

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
- Cursor cloud env: `.cursor/environment.json`, `.cursor/cloud-bootstrap.sh`
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

Global engineering standards load via cloud bootstrap (`~/.cursor/rules/` symlinks). Not duplicated in this public repo.

---

## Implementation deliverables (from spec)

```
deploy/docker/docker-compose.yml
deploy/docker/Dockerfile
deploy/docker/README-WARN.md          # deploy + limitations
deploy/rpi/install.sh            # host bootstrap (nqptp) before compose
bin/p49-up.sh / bin/p49-down.sh
```

### Beta env on Pi

Copy [config/deploy/beta.env.example](../config/deploy/beta.env.example) to `.env`, then:

```bash
./bin/render-shairport-config.sh --stage beta   # iPhone shows "AirPlay Status (Beta)"
```

| Variable | Example |
|----------|---------|
| `DEPLOY_STAGE` | `beta` |
| `DEPLOY_PHASE` | `p49` |
| `AIRPLAY_RECEIVER_NAME` | `AirPlay Status (Beta)` |
| `PORT` | `3003` |
| `LOG_LEVEL` | `info` |

See [config/deploy/README.md](../config/deploy/README.md).

---

## Beta sign-off checklist (human + device — not cloud)

From `specs/p49-preprod-deployment.md`:

- [ ] iPhone: **HomePods + AirPlay Status** in one AirPlay group
- [ ] Dashboard live metadata within 5s
- [ ] `GET /api/version` → `deployPhase=p49`, correct semver/commit
- [ ] 24h soak, reboot auto-start
- [ ] Fresh Pi install follows [deploy/docker/README-WARN.md](deploy/docker/README-WARN.md)

---

## Suggested implementation order

1. **Smoke tests** (Step 0 above)
2. Pi: `sudo ./deploy/rpi/install.sh` then `./bin/p49-up.sh docker` — [deploy/docker/README-WARN.md](deploy/docker/README-WARN.md)
3. `.env` on Pi + beta sign-off checklist
4. Open PR; then P99

---

## Key references

| Doc | Path |
|-----|------|
| **P49 spec** | [specs/p49-preprod-deployment.md](specs/p49-preprod-deployment.md) |
| **P49 remote deploy plan** | [docs/p49-beta-remote-deploy.md](docs/p49-beta-remote-deploy.md) |
| **P49 deploy** | [deploy/docker/README-WARN.md](deploy/docker/README-WARN.md) |
| Multi-room / AP1 vs AP2 | [docs/multi-room-airplay.md](docs/multi-room-airplay.md) |
| Versioning (repo) | [docs/versioning.md](docs/versioning.md) |
| P5 deployment (reference) | [specs/p5-deployment.md](specs/p5-deployment.md) |
| P99 (after beta) | [specs/p99-prod-readiness.md](specs/p99-prod-readiness.md) |
| Project agent context | [AGENTS.md](AGENTS.md) |
| shairport-sync BUILD | https://github.com/mikebrady/shairport-sync/blob/master/BUILD.md |
| nqptp | https://github.com/mikebrady/nqptp |

---

## Open local Cursor window

1. `git checkout feat/ritz-ras1245/p49-rpi-beta`
2. Open [airplay-status-p49.code-workspace](airplay-status-p49.code-workspace)
3. Tell the agent: **Read `AGENT_START_HERE.md` and follow the pickup prompt.**

---

## Revision

| Date | Change |
|------|--------|
| 2026-07-26 | P49 branch handoff — RPi4 beta, AP2, context dump |
| 2026-07-26 | Cloud env + Step 0 smoke tests; merge main cloud bootstrap |

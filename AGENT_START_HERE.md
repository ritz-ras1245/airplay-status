# Agent start here — P49 PR validation & human beta sign-off

**PR:** https://github.com/ritz-ras1245/airplay-status/pull/4  
**Branch:** `feat/cursor/p49-rpi-deployment-0a02`  
**Goal:** Validate the PR locally, deploy to RPi4, complete **human-only** beta checklist with Cursor assisting step-by-step.  
**Do not touch:** `feat/p6-echo-show`

Cloud agents implemented deploy artifacts and mock-dashboard smoke tests. **iPhone / HomePods / AirPlay 2 cannot be validated in cloud CI** — that is this handoff.

---

## Pickup prompt (paste into Cursor)

```
You are helping validate PR #4 (P49 RPi4 pre-prod deployment) for airplay-status.

Read AGENT_START_HERE.md end to end, then assist me through each phase in order.
Do not skip steps. Stop and diagnose if any command fails.

Phase 1 — Local smoke (Mac or cloud): npm ci, mock dashboard curls.
Phase 2 — Pi deploy: Path A Docker spike first; Path B bare metal if spike fails.
Phase 3 — Human beta checklist: iPhone multi-room, metadata, ops, soak, reboot.
Phase 4 — Record results in PR #4 comment and say whether to merge.

Constraints:
- Branch: feat/cursor/p49-rpi-deployment-0a02
- No secrets in git; use .env on Pi only (from config/deploy/beta.env.example)
- Mac dev is AirPlay 1 only — multi-room tests MUST run on Pi
- Use docs/p49-docker-spike.md for spike pass/fail and full checklist
```

---

## Quick start (human)

### 1. Check out the PR branch

```bash
git fetch origin feat/cursor/p49-rpi-deployment-0a02
git checkout feat/cursor/p49-rpi-deployment-0a02
npm ci
```

Open [airplay-status-p49.code-workspace](airplay-status-p49.code-workspace) in Cursor and paste the **pickup prompt** above.

### 2. Local smoke tests (Mac Studio — no Pi required)

Run on your dev machine before touching the Pi. Confirms the PR did not break the dashboard.

| # | Command | Expected |
|---|---------|----------|
| 1 | `npm ci` | exits 0 |
| 2 | `bash .cursor/cloud-bootstrap.sh` (optional on Mac) | rules install if using standards repo |
| 3 | `USE_MOCK=true SKIP_SHAIRPORT_CHECK=1 npm start` | log: `AirPlay Status v0.1.0 (mock)` |
| 4 | `curl -sf http://localhost:3003/api/version` | JSON `"version":"0.1.0"` |
| 5 | `curl -sf 'http://localhost:3003/api/status?mock=true'` | JSON playback payload |
| 6 | `./bin/check-version.sh http://localhost:3003` | pretty-printed version JSON |

One-liner:

```bash
USE_MOCK=true SKIP_SHAIRPORT_CHECK=1 npm start &
sleep 2
curl -sf http://localhost:3003/api/version | head -c 200 && echo
curl -sf 'http://localhost:3003/api/status?mock=true' | head -c 200 && echo
./bin/check-version.sh http://localhost:3003
kill %1 2>/dev/null || true
echo "local smoke passed"
```

**Mac AirPlay note:** `./bin/run-local.sh` still works for AP1 metadata-only dev, but **cannot** test HomePods + AirPlay Status together. That is expected — see [docs/multi-room-airplay.md](docs/multi-room-airplay.md).

---

## Pi deploy (human + Cursor on LAN)

### Option A — Sync from Mac, install on Pi

```bash
# On Mac (repo checked out on PR branch)
./bin/p49-install-rpi.sh pi@<pi-lan-ip>

# On Pi
ssh pi@<pi-lan-ip>
cd ~/airplay-status
cp config/deploy/beta.env.example .env
# Optional: edit .env for TIDBYT_* (P2)
```

### Option B — Clone directly on Pi

```bash
git clone https://github.com/ritz-ras1245/airplay-status.git
cd airplay-status
git checkout feat/cursor/p49-rpi-deployment-0a02
cp config/deploy/beta.env.example .env
```

### Path A — Docker spike (try first)

Full procedure: [docs/p49-docker-spike.md](docs/p49-docker-spike.md)

```bash
# On Pi — prerequisites
sudo apt update
sudo apt install -y docker.io docker-compose-plugin avahi-daemon git
sudo systemctl enable --now avahi-daemon docker

# Host nqptp (required for AirPlay 2)
git clone --depth 1 --branch 1.2.4 https://github.com/mikebrady/nqptp.git /tmp/nqptp
make -C /tmp/nqptp && sudo make -C /tmp/nqptp install
sudo cp deploy/rpi/systemd/nqptp.service /etc/systemd/system/
sudo systemctl enable --now nqptp

# Start stack
./bin/p49-up.sh docker
./bin/check-version.sh http://localhost:3003
./bin/check-sidecar.sh
```

**Spike fails if:** iPhone never sees receiver, or multi-room with HomePods fails → switch to Path B:

```bash
./bin/p49-down.sh docker
sudo ./deploy/rpi/install.sh
```

### Path B — Bare metal (fallback / recommended if Docker AP2 fails)

```bash
sudo ./deploy/rpi/install.sh
sudo systemctl status nqptp shairport-sync airplay-status
```

Guide: [deploy/rpi/README.md](deploy/rpi/README.md)

### Set deploy identity on Pi

Before sign-off, ensure version API shows beta/p49:

```bash
export GIT_COMMIT="$(git rev-parse --short HEAD)"
# Add to .env on Pi:
#   DEPLOY_STAGE=beta
#   DEPLOY_PHASE=p49
#   GIT_COMMIT=<short-sha>
sudo systemctl restart airplay-status   # Path B
# OR: ./bin/p49-down.sh docker && ./bin/p49-up.sh docker   # Path A
```

Verify:

```bash
curl -sf http://localhost:3003/api/version | python3 -m json.tool
# Expect: deployPhase=p49, deployStage=beta, gitCommit set
```

---

## Human beta sign-off checklist

**Cursor should walk through each item with the human tester.** Check off in a PR comment when done. All items required before merge to `main` and before starting P99.

### A. Docker spike (if using Path A)

- [ ] nqptp active: `systemctl is-active nqptp`
- [ ] Containers up: `docker compose -f deploy/docker/docker-compose.yml ps`
- [ ] Spike log filled in [docs/p49-docker-spike.md](docs/p49-docker-spike.md#spike-log-template) — PASS or FAIL
- [ ] If FAIL → Path B installed and working instead

### B. Device tests (iPhone + speakers — **human only**)

- [ ] iPhone on same LAN as Pi
- [ ] AirPlay picker shows **AirPlay Status (Beta)**
- [ ] iPhone selects **HomePods + AirPlay Status (Beta)** in **one** AirPlay group
- [ ] Dashboard at `http://<pi-ip>:3003` shows live metadata within **5 seconds** of play
- [ ] Album art appears when source sends cover art
- [ ] Pause/resume reflected on dashboard (if wrong: `./bin/run-local.sh --debug` pattern on Pi — see [docs/debug-capture.md](docs/debug-capture.md))
- [ ] Stop AirPlay session → dashboard clears within expected window

### C. Integrations (optional — skip if not configured)

- [ ] Tidbyt push from Pi (`./bin/push-tidbyt.sh` or auto-push) — requires `TIDBYT_*` in `.env`
- [ ] Echo webhook from Pi — **skip** unless P6 merged to `main`

### D. Ops / API

- [ ] `GET /api/version` returns `"version":"0.1.0"`, `"deployPhase":"p49"`, `"deployStage":"beta"`, `"gitCommit":"<sha>"`
- [ ] `./bin/check-sidecar.sh` passes while music plays to AirPlay Status
- [ ] `./bin/check-version.sh http://<pi-ip>:3003` works from another machine on LAN

### E. Soak and reboot

- [ ] **24-hour soak** — no manual restart; metadata still updates next day
- [ ] **Reboot Pi** → services auto-start:
  - Path B: `nqptp`, `shairport-sync`, `airplay-status` all `active`
  - Path A: Docker containers restart; host `nqptp` enabled

### F. Documentation / clean install

- [ ] Fresh SD card or clean Pi can follow [deploy/rpi/README.md](deploy/rpi/README.md) **or** [deploy/docker/README.md](deploy/docker/README.md) without extra steps
- [ ] `.env` copied from `config/deploy/beta.env.example`; secrets **not** committed

---

## Recording results (PR #4)

When checklist is complete, post a comment on PR #4:

```markdown
## P49 human beta sign-off

- **Path:** A (Docker) / B (bare metal)
- **Pi:** RPi4, Raspberry Pi OS 64-bit Lite, `<pi-ip>`
- **Spike:** PASS / FAIL / skipped (Path B only)
- **Multi-room (HomePods + AirPlay Status):** YES / NO
- **24h soak:** PASS / pending
- **Reboot auto-start:** PASS / FAIL

Checklist: all items in AGENT_START_HERE.md completed on `<date>`.
```

**Merge criteria:** Local smoke passed + all checklist sections B–F complete (A if Path A used). Then owner merges PR #4 → proceed to P99 on same Pi.

---

## Key files in this PR

| Path | Purpose |
|------|---------|
| [deploy/docker/](deploy/docker/) | Path A — Docker host-network |
| [deploy/rpi/](deploy/rpi/) | Path B — install.sh + systemd |
| [bin/p49-up.sh](bin/p49-up.sh) | Start stack (`docker` or `rpi`) |
| [bin/p49-down.sh](bin/p49-down.sh) | Stop stack |
| [bin/p49-install-rpi.sh](bin/p49-install-rpi.sh) | Rsync to Pi from Mac |
| [docs/p49-docker-spike.md](docs/p49-docker-spike.md) | Spike + full checklist |
| [config/deploy/beta.env.example](config/deploy/beta.env.example) | Pi `.env` template |
| [specs/p49-preprod-deployment.md](specs/p49-preprod-deployment.md) | P49 spec |

---

## Context

| Item | Value |
|------|-------|
| Semver | **0.1.0** (pre-P100) |
| Pipeline | Mac dev (AP1) → **P49 beta (AP2)** → P99 → P100 `1.0.0` |
| Mac limitation | Homebrew shairport = AP1; multi-room only on Pi |
| P99 next | After beta sign-off — [specs/p99-prod-readiness.md](specs/p99-prod-readiness.md) |

---

## Revision

| Date | Change |
|------|--------|
| 2026-07-26 | P49 branch handoff — implementation context |
| 2026-07-26 | Cloud env + Step 0 smoke tests |
| 2026-07-26 | **PR #4 validation handoff** — local + Pi human checklist, Cursor pickup prompt |

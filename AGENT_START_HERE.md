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

Phase 1 — Local smoke (Mac): npm ci, mock dashboard curls.
Phase 2 — Pi deploy: Docker (README-WARN) with host nqptp; bare-metal install.sh if Docker AP2 fails.
Phase 3 — Human beta checklist: iPhone multi-room, metadata, ops, soak, reboot.
Phase 4 — Record results in PR #4 comment and say whether to merge.

Constraints:
- Branch: feat/cursor/p49-rpi-deployment-0a02
- No secrets in git; use .env on Pi only (from config/deploy/beta.env.example)
- Mac dev is AirPlay 1 only — multi-room tests MUST run on Pi
- Use docs/p49-docker-spike.md for spike pass/fail
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

### 2. Local smoke tests (Mac — no Pi required)

| # | Command | Expected |
|---|---------|----------|
| 1 | `npm ci` | exits 0 |
| 2 | `USE_MOCK=true SKIP_SHAIRPORT_CHECK=1 npm start` | log: `AirPlay Status v0.1.0 (mock)` |
| 3 | `curl -sf http://localhost:3003/api/version` | JSON `"version":"0.1.0"` |
| 4 | `curl -sf 'http://localhost:3003/api/status?mock=true'` | JSON playback payload |
| 5 | `./bin/check-version.sh http://localhost:3003` | pretty-printed version JSON |

**Mac AirPlay note:** `./bin/run-local.sh` is AP1 only. Multi-room with HomePods requires the Pi — [docs/multi-room-airplay.md](docs/multi-room-airplay.md).

---

## Pi deploy (human + Cursor on LAN)

Full deploy guide: [deploy/docker/README-WARN.md](deploy/docker/README-WARN.md)

### Clone on Pi

```bash
git clone https://github.com/ritz-ras1245/airplay-status.git
cd airplay-status
git checkout feat/cursor/p49-rpi-deployment-0a02
cp config/deploy/beta.env.example .env
```

Or sync from Mac: `./bin/p49-install-rpi.sh airplay@airplay-beta.local`

### Docker (default)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin avahi-daemon git build-essential
sudo systemctl enable --now avahi-daemon docker
sudo usermod -aG docker "$USER"   # re-login

# Host nqptp (required for AirPlay 2)
git clone --depth 1 --branch 1.2.4 https://github.com/mikebrady/nqptp.git /tmp/nqptp
make -C /tmp/nqptp && sudo make -C /tmp/nqptp install
sudo cp deploy/rpi/systemd/nqptp.service /etc/systemd/system/
sudo systemctl enable --now nqptp

./bin/p49-up.sh docker
./bin/check-version.sh http://localhost:3003
```

Spike log: [docs/p49-docker-spike.md](docs/p49-docker-spike.md)

### Bare metal (fallback if Docker AP2 fails)

```bash
./bin/p49-down.sh docker
sudo ./deploy/rpi/install.sh
sudo systemctl status nqptp shairport-sync airplay-status
```

### Verify deploy identity

```bash
curl -sf http://localhost:3003/api/version | python3 -m json.tool
# Expect: deployPhase=p49, deployStage=beta, gitCommit set
```

---

## Human beta sign-off checklist

Check off in a PR comment when done.

### Device tests (iPhone + speakers)

- [ ] iPhone on same LAN as Pi
- [ ] AirPlay picker shows **AirPlay Status (Beta)**
- [ ] iPhone selects **HomePods + AirPlay Status (Beta)** in **one** AirPlay group
- [ ] Dashboard metadata within **5 seconds** of play
- [ ] Stop AirPlay session → dashboard clears

### Ops / API

- [ ] `GET /api/version` → `deployPhase=p49`, `deployStage=beta`, semver + gitCommit
- [ ] `./bin/check-sidecar.sh` passes while music plays
- [ ] `./bin/check-version.sh http://<pi-ip>:3003` from another LAN machine

### Soak and reboot

- [ ] 24-hour soak — metadata still updates
- [ ] Reboot Pi → nqptp + stack auto-start (Docker `restart: unless-stopped` or systemd)

### Clean install

- [ ] Fresh SD follows [deploy/docker/README-WARN.md](deploy/docker/README-WARN.md)
- [ ] `.env` from `config/deploy/beta.env.example`; secrets not committed

---

## Recording results (PR #4)

```markdown
## P49 human beta sign-off

- **Deploy:** Docker / bare metal
- **Pi:** RPi4, `<pi-ip>`
- **Spike:** PASS / FAIL
- **Multi-room (HomePods + AirPlay Status):** YES / NO
- **24h soak:** PASS / pending
- **Reboot auto-start:** PASS / FAIL
```

---

## Key files

| Path | Purpose |
|------|---------|
| [deploy/docker/README-WARN.md](deploy/docker/README-WARN.md) | Docker deploy + limitations |
| [deploy/rpi/install.sh](deploy/rpi/install.sh) | Bare-metal install (fallback) |
| [bin/p49-up.sh](bin/p49-up.sh) / [bin/p49-down.sh](bin/p49-down.sh) | Start/stop stack |
| [docs/p49-docker-spike.md](docs/p49-docker-spike.md) | Spike log |
| [docs/p49-rpi-bare-metal-lessons.md](docs/p49-rpi-bare-metal-lessons.md) | Bare-metal bring-up lessons |
| [config/deploy/beta.env.example](config/deploy/beta.env.example) | Pi `.env` template |

---

## Context

| Item | Value |
|------|-------|
| Semver | **0.1.0** (pre-P100) |
| Pipeline | Mac dev (AP1) → P49 beta (AP2) → P99 → P100 `1.0.0` |
| Mac limitation | Multi-room only on Pi |
| P99 next | [specs/p99-prod-readiness.md](specs/p99-prod-readiness.md) |

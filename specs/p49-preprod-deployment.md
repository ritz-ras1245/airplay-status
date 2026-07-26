# Phase P49 — Pre-Prod / Local Beta (RPi4)

**Status:** Implementation on `feat/cursor/p49-rpi-deployment-0a02` — human beta sign-off pending  
**Depends on:** P0 live dashboard ✅; benefits from any merged feature phases (P2 Tidbyt, P6 Echo, …)  
**Precedes:** P99 production readiness  
**Related:** [P5 deployment](./p5-deployment.md) (general platforms), [multi-room-airplay.md](../docs/multi-room-airplay.md) (why Pi is required for iPhone multi-speaker)

## Goal

Package airplay-status for **pre-production / local beta** on a **Raspberry Pi 4** (user-owned hardware), with **AirPlay 2** so iPhone can select **real speakers + AirPlay Status** together. Try **Docker on Linux/Pi first**; if mDNS/AP2/nqptp blockers remain, ship a **bare Raspberry Pi OS** install. Optionally manage **1–4 instances** with a free-tier fleet tool (Balena or plain systemd).

This is the **first real-environment gate** before **P99** prod-readiness and **P100** release (`1.0.0`).

---

## Why P49 exists (pivot)

| Environment | Role | AirPlay | iPhone multi-speaker + metadata |
|-------------|------|---------|----------------------------------|
| **Mac Studio (dev)** | Feature iteration | AirPlay 1 only (Homebrew) | **No** — select AirPlay Status alone |
| **RPi4 (P49 beta)** | Pre-prod / local beta | AirPlay 2 + nqptp | **Yes** |
| **Prod (P99)** | Always-on home | Same as beta host | Yes |

Mac dev remains valid for **all software features** except concurrent multi-room audio from iPhone. Beta on Pi validates the full user story.

---

## Dev iteration rules (Mac — permanent for this project)

While building P1–P48 features on macOS:

1. Run `./bin/run-local.sh` with classic config (`config/shairport-sync.conf.example`).
2. On iPhone: select **only AirPlay Status** (audio discarded to `/dev/null` — no speaker output from Mac receiver).
3. Test dashboard, Tidbyt, Echo push, SSE, debug capture, etc. — **everything except** “CC audio to HomePods + metadata simultaneously.”
4. Do **not** block feature merges on iPhone multi-room — defer to P49 beta checklist.
5. `./bin/check-sidecar.sh` and `docs/multi-room-airplay.md` document the caveat.

When a feature set matches **P0-complete or milestone** (e.g. P2 + P6 merged), promote to **P49 beta** on RPi4 before calling it “home ready.”

---

## Deployment pipeline (iteration 1)

```
Mac dev (AP1)  →  P49 pre-prod (RPi4, AP2)  →  P99 prod readiness  →  P100 release 1.0.0
     ↑                      ↑                         ↑
  all features          beta sign-off            then prod patches 1.0.x on release/1.x
  except multi-room     multi-room + soak        while main → 2.0.0-dev
```

| Phase | When |
|-------|------|
| Mac dev | Continuous during feature work |
| **P49** | Milestone ready for beta; RPi4 on home LAN |
| **P99** | Beta passed; launchd/systemd, logs, Grafana, SOPs |
| Prod | P99 complete; optional fleet scale 1–4 nodes |

---

## Target hardware

- **Primary:** Raspberry Pi 4 (user has unit available)
- **OS:** Raspberry Pi OS 64-bit Lite (default) or DietPi
- **Network:** Same LAN as iPhone; wired Ethernet preferred for mDNS stability
- **Scale:** 1 instance for home beta; architecture must not preclude **1–4 instances** (e.g. second Pi at another site later)

---

## Packaging strategy (decision order)

### Path A — Docker on Pi (try first)

| Component | Container / host | Notes |
|-----------|------------------|-------|
| **nqptp** | Host systemd **or** privileged sidecar | Needs UDP 319/320 exclusive |
| **shairport-sync AP2** | `network_mode: host` | mDNS + RAOP; see P5 |
| **Node airplay-status** | Host network or host process | Metadata pipe bind-mount |
| **Metadata FIFO** | Volume: `/tmp/shairport-sync-metadata` or `/run/airplay-status/` |

Deliverables:

- `deploy/docker/docker-compose.yml` (host network)
- `deploy/docker/Dockerfile` (Node app)
- `deploy/docker/shairport/` — AP2 config mount
- `bin/p49-up.sh` / `bin/p49-down.sh`
- Spike doc: `docs/p49-docker-spike.md` with pass/fail criteria

**Accept spike as failed if:** after 1 day effort, iPhone cannot discover receiver or AP2 multi-room fails with host-network compose → fall through to Path B.

### Path B — Bare Raspberry Pi OS (fallback / likely for nqptp)

| Component | Install |
|-----------|---------|
| nqptp | Build from [nqptp](https://github.com/mikebrady/nqptp) or distro package if available |
| shairport-sync | Build with `--with-airplay-2 --with-ffmpeg --with-metadata` |
| Node app | `git clone` + `npm ci` + systemd unit |
| Config | `config/shairport-sync-airplay2.conf.example` |

Deliverables:

- `deploy/rpi/install.sh` — idempotent apt + build steps
- `deploy/rpi/systemd/` — `nqptp.service`, `shairport-sync.service`, `airplay-status.service`
- `bin/p49-install-rpi.sh` — rsync/scp helper from dev Mac (optional)

---

## Fleet / remote management (1–4 instances)

Pick **one** for MVP; document others as alternatives.

| Option | Cost | Fit | Notes |
|--------|------|-----|-------|
| **Raspberry Pi OS + systemd + SSH** | Free | **Default MVP** | No vendor lock-in; manual updates |
| **Balena Cloud** | Free tier (limited devices) | Optional | OTA, fleet env vars; good for 1–4 Pis |
| **Ansible pull / simple cron git pull** | Free | Optional | Lightweight multi-node |

P49 MVP: **systemd on RPiOS**. Balena documented as P49.1 optional in `deploy/balena/README.md` if user chooses later.

Requirements for any fleet choice:

- Inject `.env` (Tidbyt, Echo webhook) without committing secrets
- Restart services on deploy
- Health check: `GET http://<pi>:3003/api/health` (P99 adds endpoint; stub OK for P49)

---

## Configuration (beta)

| Variable / file | Purpose |
|---------------|---------|
| `config/shairport-sync-airplay2.conf.example` | AP2 receiver on Pi |
| `.env` on Pi | `TIDBYT_*`, `ECHO_*`, `PORT=3003` |
| `DEPLOY_PHASE` | `p49` (see [versioning.md](../docs/versioning.md)) |
| `GIT_COMMIT` / `BUILD_SHA` | Short sha at deploy time |
| `METADATA_PIPE` | Default `/tmp/shairport-sync-metadata`; override for Docker volume |

Display URL for Echo/Tidbyt on beta: `http://<pi-lan-ip>:3003/…`

---

## Beta acceptance criteria (sign-off before P99)

- [ ] `(device)` iPhone selects **HomePods + AirPlay Status** in one AirPlay group
- [ ] `(device)` Dashboard shows live metadata within 5s of play
- [ ] `(device)` Tidbyt push works from Pi (if P2 enabled)
- [ ] `(device)` Echo webhook reachable from Pi (if P6 enabled)
- [ ] `(ops)` **`GET /api/version`** returns expected `version`, `gitCommit`, `deployPhase=p49`
- [ ] `(soak)` 24h uptime without manual restart
- [ ] `(ops)` Reboot Pi → all services auto-start
- [ ] `(doc)` `deploy/rpi/README.md` or `deploy/docker/README.md` — fresh Pi install from scratch

---

## File structure (planned)

```
deploy/
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── README.md
├── rpi/
│   ├── install.sh
│   ├── systemd/
│   └── README.md
└── balena/
    └── README.md          # optional P49.1
bin/
├── p49-up.sh
├── p49-down.sh
└── p49-install-rpi.sh   # optional
docs/
└── p49-docker-spike.md
```

---

## Out of scope (P49)

- P99 logs/Grafana/SOPs (defer to P99)
- Public internet exposure / TLS reverse proxy
- Synology as beta host (P5 — low confidence)
- Docker Desktop on Mac as beta target
- More than 4 fleet nodes

---

## Implementation order (suggested)

1. **Spike:** Docker host-network on RPi4 → document in `p49-docker-spike.md`
2. **Path B if needed:** `deploy/rpi/install.sh` + systemd + AP2 config
3. **Wire:** `.env.example` + deploy README for beta checklist
4. **Soak test** on home LAN → sign off beta criteria
5. **Then:** P99 prod readiness on same Pi

---

## References

- [multi-room-airplay.md](../docs/multi-room-airplay.md)
- [p5-deployment.md](./p5-deployment.md)
- [p99-prod-readiness.md](./p99-prod-readiness.md)
- [shairport-sync BUILD.md](https://github.com/mikebrady/shairport-sync/blob/master/BUILD.md)
- [nqptp](https://github.com/mikebrady/nqptp)

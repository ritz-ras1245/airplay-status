# Phase P49 — Pre-Prod / Local Beta (RPi4)

**Status:** Implementation on `feat/cursor/p49-rpi-deployment-0a02` — human beta sign-off pending  
**Depends on:** P0 live dashboard ✅; benefits from any merged feature phases (P2 Tidbyt, P6 Echo, …)  
**Precedes:** P99 production readiness  
**Related:** [P5 deployment](./p5-deployment.md) (general platforms), [multi-room-airplay.md](../docs/multi-room-airplay.md) (why Pi is required for iPhone multi-speaker)

## Goal

Package airplay-status for **pre-production / local beta** on a **Raspberry Pi 4** (user-owned hardware), with **AirPlay 2** so iPhone can select **real speakers + AirPlay Status** together. **Default path: bare metal** (`deploy/rpi/install.sh`) — validated on Trixie; see [p49-rpi-bare-metal-lessons.md](../docs/p49-rpi-bare-metal-lessons.md). Docker on Pi is optional ([deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md)). Optionally manage **1–4 instances** with a free-tier fleet tool (Balena or plain systemd).

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

## Packaging — bare metal (default)

See [deploy/rpi/README.md](../deploy/rpi/README.md) and [p5-deployment.md](./p5-deployment.md) (platform reference).

| Component | Where |
|-----------|--------|
| nqptp | Host systemd (`deploy/rpi/install.sh`) |
| shairport-sync AP2 | Host systemd, `/etc/shairport-sync.conf` |
| Node app | Host systemd, `/opt/airplay-status`, port **80** |
| Metadata FIFO | `/tmp/shairport-sync-metadata` |

Deliverables: `deploy/rpi/*`, `bin/check-p49-beta.sh`, `config/shairport-sync-airplay2.conf.example`.

## Packaging — Docker (optional)

See [deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md) (includes **limitations**).

| Component | Where |
|-----------|--------|
| nqptp | Host (`deploy/rpi/install.sh` before compose) |
| shairport-sync AP2 | Container, `network_mode: host` |
| Node app | Container, `network_mode: host` |
| Metadata FIFO | `/tmp/shairport-sync-metadata` on host |

Deliverables: `deploy/docker/*`, `bin/p49-up.sh`, `bin/p49-down.sh`.

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
- Health check: `GET http://<pi>/api/health` (port **80** on bare-metal beta; P99 adds endpoint; stub OK for P49)

---

## Configuration (beta)

| Variable / file | Purpose |
|---------------|---------|
| `config/shairport-sync-airplay2.conf.example` | AP2 receiver on Pi |
| `.env` on Pi | `TIDBYT_*`, `ECHO_*`, `PORT=80` (see `config/deploy/beta.env.example`) |
| `DEPLOY_PHASE` | `p49` (see [versioning.md](../docs/versioning.md)) |
| `GIT_COMMIT` / `BUILD_SHA` | Short sha at deploy time |
| `METADATA_PIPE` | Default `/tmp/shairport-sync-metadata`; override for Docker volume |

Display URL for Echo/Tidbyt on beta: `http://<pi-lan-ip>/…` (port **80**)

---

## Beta acceptance criteria (sign-off before P99)

- [ ] `(device)` iPhone selects **HomePods + AirPlay Status** in one AirPlay group
- [ ] `(device)` Dashboard shows live metadata within 5s of play
- [ ] `(device)` Tidbyt push works from Pi (if P2 enabled)
- [ ] `(device)` Echo webhook reachable from Pi (if P6 enabled)
- [ ] `(ops)` **`GET /api/version`** returns expected `version`, `gitCommit`, `deployPhase=p49`
- [ ] `(soak)` 24h uptime without manual restart
- [ ] `(ops)` Reboot Pi → all services auto-start
- [ ] `(doc)` [deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md) — fresh Pi install

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
└── (see deploy/docker/README-WARN.md)
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

1. Pi: `sudo ./deploy/rpi/install.sh` — [deploy/rpi/README.md](../deploy/rpi/README.md), [p49-rpi-bare-metal-lessons.md](../docs/p49-rpi-bare-metal-lessons.md)
2. Soak + beta sign-off on LAN
3. P99

Optional Docker path: `./bin/p49-up.sh docker` — [deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md)

---

## References

- [multi-room-airplay.md](../docs/multi-room-airplay.md)
- [p5-deployment.md](./p5-deployment.md) — platform tradeoffs (Pi bare metal, Docker, Synology)
- [p49-rpi-bare-metal-lessons.md](../docs/p49-rpi-bare-metal-lessons.md) — first Pi bring-up
- [deploy/rpi/README.md](../deploy/rpi/README.md) — bare-metal quick start
- [p99-prod-readiness.md](./p99-prod-readiness.md)
- [shairport-sync BUILD.md](https://github.com/mikebrady/shairport-sync/blob/master/BUILD.md)
- [nqptp](https://github.com/mikebrady/nqptp)

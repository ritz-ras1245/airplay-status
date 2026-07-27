# Phase P5 — Cross-Platform Deployment

**Status:** Reference doc — platform tradeoffs; **Pi bare metal implemented via P49** (`deploy/rpi/`)  
**Depends on:** Phase 4 (live metadata); benefits all phases P1–P4  
**Related:** [P49 pre-prod beta](./p49-preprod-deployment.md) (opinionated RPi4 path), [p49-rpi-bare-metal-lessons.md](../docs/p49-rpi-bare-metal-lessons.md) (live bring-up notes)

## Goal

Document how to run airplay-status **outside macOS development**: Raspberry Pi as the recommended always-on receiver, Docker on Linux as an optional reference path, and honest guidance for Synology and Docker-on-Mac limitations.

Answer: **No, it does not have to run on a Mac.** Mac remains the dev target (port **3003**); Linux (especially Raspberry Pi bare metal) is the recommended production home for a 24/7 AirPlay 2 metadata receiver (port **80** on P49 beta).

## Feasibility summary

| Platform | Verdict | Confidence | Notes |
|----------|---------|------------|-------|
| **macOS** | Works today | High | Bonjour (`dns-sd`), Homebrew shairport-sync AP1, `./bin/run-local.sh` |
| **Raspberry Pi (bare metal)** | **Recommended** | High | `deploy/rpi/install.sh` — nqptp + shairport-sync AP2 + systemd; see [deploy/rpi/README.md](../deploy/rpi/README.md) |
| **Docker (Linux / Pi host)** | Optional reference | Medium | `deploy/docker/` — host network; nqptp still on host; see [README-WARN](../deploy/docker/README-WARN.md) |
| **Synology Docker** | Difficult | Low | DSM networking often breaks mDNS; advanced/experimental |
| **Docker Desktop on Mac** | Smoke/API only | Low | No iPhone AirPlay discovery; use native Mac dev instead |

## Architecture (production)

```
┌─────────────────────────────────────────────────────────┐
│  Raspberry Pi / Linux host                              │
│                                                         │
│  ┌──────────┐   ┌─────────────────┐   metadata pipe   │
│  │  nqptp   │   │ shairport-sync  │ ─────────────────►  │
│  │ (host)   │   │ AP2 (host)      │                     │
│  └──────────┘   └────────┬────────┘                     │
│                            │ AirPlay 2 (mDNS / Avahi)   │
└────────────────────────────┼─────────────────────────────┘
                             │
                      ┌──────┴──────┐
                      ▼             ▼
                   iPhone/Mac    Real speakers (multi-room on Pi)
                      │
                      └──────────► ┌──────────────────┐
                                   │ Node airplay-status │
                                   │ :80 (Pi beta)       │
                                   │ :3003 (Mac dev)     │
                                   └─────────┬───────────┘
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     ▼                       ▼                       ▼
               LAN browsers              Tidbyt push              Kindle / eInk
```

Single metadata pipe feeds one Node process; all UIs and integrations consume `/api/status`.

## macOS (current dev target)

**Status:** Supported — default `./bin/run-local.sh` flow.

| Component | Setup |
|-----------|-------|
| shairport-sync | Homebrew; `config/shairport-sync.conf.example` with `mdns_backend = "dns-sd"` (AirPlay 1 only) |
| Metadata pipe | `/tmp/shairport-sync-metadata` FIFO |
| Node app | `npm start` or `run-local.sh` on port **3003** |
| mDNS | Bonjour built-in |

**iPhone multi-room:** Not supported on macOS Homebrew — select **AirPlay Status only**. See [multi-room-airplay.md](../docs/multi-room-airplay.md).

## Relationship to P49 and P99

| Spec | Role |
|------|------|
| **P5** (this doc) | Platform reference — macOS, Pi, Docker, Synology tradeoffs |
| **P49** | Opinionated **pre-prod beta** path — bare-metal RPi4, AP2, systemd → [p49-preprod-deployment.md](./p49-preprod-deployment.md) |
| **P99** | Prod readiness after beta sign-off → [p99-prod-readiness.md](./p99-prod-readiness.md) |

**iPhone multi-room:** macOS = AirPlay 1 only; full multi-speaker beta is **P49** on RPi4 — [multi-room-airplay.md](../docs/multi-room-airplay.md), [p49-preprod-deployment.md](./p49-preprod-deployment.md).

## Raspberry Pi (recommended production)

**Status:** Implemented — bare metal is the **default** P49 path.

### Why Pi?

- Low power, always-on friendly
- Native Avahi for mDNS AirPlay 2 advertisement
- nqptp + shairport-sync AP2 with metadata pipe (same pattern as macOS, plus multi-room)
- systemd units for nqptp, shairport-sync, and airplay-status

### Requirements

- Raspberry Pi 4 or 5 (Pi 3 may work with lighter load)
- Raspberry Pi OS 64-bit Lite (Trixie validated — see [p49-rpi-bare-metal-lessons.md](../docs/p49-rpi-bare-metal-lessons.md))
- Same LAN as AirPlay senders
- Wired Ethernet preferred for stable mDNS

### Bare-metal install (default)

Quick start: [deploy/rpi/README.md](../deploy/rpi/README.md)

```bash
git clone https://github.com/ritz-ras1245/airplay-status.git
cd airplay-status
sudo ./deploy/rpi/install.sh          # ~15–25 min (compiles shairport-sync AP2)
./bin/check-p49-beta.sh
./bin/check-version.sh http://localhost
```

| Item | Location |
|------|----------|
| App | `/opt/airplay-status` |
| shairport config | `/etc/shairport-sync.conf` (rendered from `config/shairport-sync-airplay2.conf.example`) |
| Metadata pipe | `/tmp/shairport-sync-metadata` |
| Dashboard | `http://<pi-ip>/` — port **80** (`config/deploy/beta.env.example`) |
| systemd | `nqptp`, `shairport-sync`, `airplay-status` |

Lessons from first bring-up: [p49-rpi-bare-metal-lessons.md](../docs/p49-rpi-bare-metal-lessons.md).

Key config differences from macOS (`config/shairport-sync-airplay2.conf.example`):

```conf
general = {
  name = "AirPlay Status (Beta)";   // via render-shairport-config.sh --stage beta
  output_backend = "pipe";
  mdns_backend = "avahi";           // not dns-sd
  port = 7000;                      // AirPlay 2
  regtype = "_airplay._tcp";
};

pipe = { name = "/dev/null"; };

metadata = {
  enabled = "yes";
  include_cover_art = "yes";
  pipe_name = "/tmp/shairport-sync-metadata";
};
```

**Prerequisites on Pi:** nqptp (UDP 319/320) and Avahi — both installed and enabled by `deploy/rpi/install.sh`.

### Verification

1. iPhone AirPlay picker → **AirPlay Status (Beta)** appears on same LAN
2. Select real speakers + AirPlay Status together (multi-room)
3. Dashboard at `http://<pi-ip>/` shows live metadata
4. `./bin/check-p49-beta.sh` passes
5. `GET /api/version` returns `deployPhase=p49`, `deployStage=beta`

### Docker on Pi (optional)

Docker on a dedicated Pi adds compose + host nqptp complexity without benefit over bare metal. If experimenting: host nqptp first via `deploy/rpi/install.sh`, then [deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md). **Prefer bare metal** for always-on beta/prod.

Reference: [App Code Labs — AirPlay metadata on Raspberry Pi](https://appcodelabs.com/show-artist-song-metadata-using-airplay-on-raspberry-pi)

## Docker (Linux host)

**Status:** Reference implementation in `deploy/docker/` — feasible with host networking; not the Pi beta default.

See [deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md) for limitations (macOS, Pi host bootstrap).

### Critical constraint

AirPlay discovery uses **mDNS (Bonjour)**. Bridge networking breaks advertisement. **Use `network_mode: host`**. AirPlay 2 requires **nqptp on the host** (not inside compose) — UDP 319/320.

### Quick start (Linux / Pi with host nqptp)

From repo root:

```bash
cp config/deploy/beta.env.example .env
./bin/render-shairport-config.sh --stage beta \
  --output deploy/docker/shairport/shairport-sync.conf
./bin/p49-up.sh docker
```

Compose file: [deploy/docker/docker-compose.yml](../deploy/docker/docker-compose.yml)

| Service | Where | Notes |
|---------|-------|-------|
| nqptp | **Host** | `deploy/rpi/install.sh` or manual install |
| shairport-sync AP2 | Container | `network_mode: host` |
| airplay-status | Container | `network_mode: host`; `METADATA_PIPE=/tmp/shairport-sync-metadata` |

**Notes:**

- Pipe path is on the host at `/tmp/shairport-sync-metadata` (host network namespace)
- `output_backend = "pipe"` with `name = "/dev/null"` discards audio
- Docker default `PORT` in compose is **3003**; bare-metal Pi beta uses **80** via `.env`
- Pi + Docker adds overhead; **bare-metal Pi install preferred**

Dockerfile: [deploy/docker/Dockerfile](../deploy/docker/Dockerfile)

## Docker on macOS

**Not recommended** for the AirPlay **receiver** role.

| Topic | Reality |
|-------|---------|
| `network_mode: host` | Containers run in a Linux VM — mDNS does not reach iPhone on Wi‑Fi |
| nqptp (UDP 319/320) | macOS reserves these ports — nqptp cannot run on Mac host |
| iPhone sees speaker | **Will not work** on Mac Docker |

Use **native Homebrew shairport-sync** via `./bin/run-local.sh` for development. Mac Docker is useful only for compose build smoke and `docker exec` API checks — see [deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md).

## Synology NAS (DSM Docker)

**Status:** Advanced / experimental — expect friction.

### Common failures

- DSM Docker default bridge network isolates mDNS
- NAS firewall blocks UDP 5353 (mDNS) or TCP 7000 (RAOP)
- Avahi not running or not on same interface as Docker
- nqptp unlikely to run correctly on DSM

### If attempting Synology

1. Use **host network** mode if DSM version supports it for the stack
2. Install/run Avahi on NAS or ensure shairport-sync publishes on host network namespace
3. Open firewall: UDP 5353, TCP 5000–7000 range (RAOP)
4. Prefer **bare-metal Pi** (`deploy/rpi/install.sh`) instead of Synology for reliability

### Synology troubleshooting checklist

| Check | Command / action |
|-------|------------------|
| Container network | Host mode, not bridge |
| shairport-sync logs | Receiver name visible; no mdns errors |
| From iPhone | AirPlay list shows receiver name |
| Pipe mounted | Node container reads same FIFO path |
| Firewall | Allow mDNS and RAOP ports on LAN interface |

## Environment variables (all platforms)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3003` (dev); **80** (Pi beta per `config/deploy/stages.json`) | HTTP server |
| `DEPLOY_STAGE` | `dev` / `beta` / `prod` | Stage label; drives config render |
| `DEPLOY_PHASE` | unset / `p49` | Set on Pi beta |
| `METADATA_PIPE` | `/tmp/shairport-sync-metadata` | FIFO path |
| `SKIP_SHAIRPORT_CHECK` | unset | Set `1` in systemd/Docker (Node does not run shairport) |
| `METADATA_DEBUG` | unset | `1` enables debug UI |
| `TIDBYT_*` | — | See [p2-tidbyt.md](./p2-tidbyt.md), [p49-tidbyt-credentials.md](../docs/p49-tidbyt-credentials.md) |
| `EINK_*` | — | See [p3-eink-display.md](./p3-eink-display.md) |

Stage defaults: [config/deploy/stages.json](../config/deploy/stages.json), [config/deploy/beta.env.example](../config/deploy/beta.env.example).

## File structure (implemented)

```
deploy/
├── rpi/
│   ├── install.sh              # bare-metal default (nqptp + shairport + Node + systemd)
│   ├── systemd/
│   └── README.md
├── docker/
│   ├── docker-compose.yml      # host network; optional Pi/Linux path
│   ├── Dockerfile
│   └── README-WARN.md          # limitations (macOS, Pi bootstrap)
└── balena/
    └── README.md               # optional fleet (P49.1)
config/
├── shairport-sync.conf.example           # macOS AP1
├── shairport-sync-airplay2.conf.example  # Linux / Pi AP2
└── deploy/
    ├── beta.env.example                  # PORT=80, DEPLOY_PHASE=p49
    └── stages.json
bin/
├── p49-up.sh / p49-down.sh     # Docker path
├── check-p49-beta.sh           # Pi post-install sanity
└── render-shairport-config.sh  # stage-aware shairport config
docs/
├── p49-rpi-bare-metal-lessons.md
└── multi-room-airplay.md
specs/
├── p5-deployment.md            # this doc
└── p49-preprod-deployment.md   # opinionated beta checklist
```

## Platform decision guide

| Your situation | Recommendation |
|----------------|----------------|
| Developing on Mac | `./bin/run-local.sh` — port 3003, AP1 only |
| Always-on home / P49 beta | **Raspberry Pi 4/5**, `sudo ./deploy/rpi/install.sh` — port 80 |
| Compose experiment on Linux | `deploy/docker/` + host nqptp; read [README-WARN](../deploy/docker/README-WARN.md) |
| Synology only | Try host network; fallback to Pi bare metal |
| Need receiver on Mac only | Homebrew shairport-sync — no Docker |

## Acceptance criteria

- [x] `config/shairport-sync-airplay2.conf.example` with `mdns_backend = "avahi"` (P49)
- [x] `deploy/docker/docker-compose.yml` — host network (P49)
- [x] `deploy/rpi/install.sh` — bare-metal Pi path with systemd (P49)
- [x] This spec explains Pi vs Mac vs Docker tradeoffs
- [x] Synology documented as experimental with troubleshooting checklist
- [x] `METADATA_PIPE` and `PORT` documented for container vs bare-metal deployments
- [x] Cross-links to [p49-rpi-bare-metal-lessons.md](../docs/p49-rpi-bare-metal-lessons.md) and [deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md)

## Out of scope (P5)

- Kubernetes / cloud deployment (local LAN tool)
- Automated Pi imaging (SD card flash scripts — see [p49-beta-remote-deploy.md](../docs/p49-beta-remote-deploy.md) for human steps)
- Synology package SPK build
- TLS / reverse proxy for remote access (security risk for home LAN tool)

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| mDNS fails in Docker bridge | Mandate host network; [README-WARN](../deploy/docker/README-WARN.md) |
| nqptp missing on Pi Docker path | `deploy/rpi/install.sh` installs host nqptp before compose |
| Pipe path mismatch | Host network namespace shares `/tmp/shairport-sync-metadata` |
| Pi performance for PNG render (P3) | Cache PNG; optional disable `EINK` on Pi 3 |
| User expects Synology to "just work" | Label experimental; recommend Pi bare metal |
| User picks Docker on Pi over bare metal | Document simpler ops story in [p49-rpi-bare-metal-lessons.md](../docs/p49-rpi-bare-metal-lessons.md) |

## Success criteria

- [x] Clear recommendation: Pi bare metal for production/beta, Mac for dev
- [x] Config examples and deploy paths enable reproducible deploy
- [x] Limitations of Docker-on-Mac and Synology stated honestly
- [x] Port **80** (Pi beta) vs **3003** (Mac dev) documented

## References

- [deploy/rpi/README.md](../deploy/rpi/README.md) — bare-metal quick start
- [deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md) — Docker limitations
- [p49-rpi-bare-metal-lessons.md](../docs/p49-rpi-bare-metal-lessons.md) — first Pi bring-up
- [p49-preprod-deployment.md](./p49-preprod-deployment.md) — beta sign-off checklist
- [shairport-sync](https://github.com/mikebrady/shairport-sync) · [nqptp](https://github.com/mikebrady/nqptp)
- [p2-tidbyt.md](./p2-tidbyt.md), [p3-eink-display.md](./p3-eink-display.md) — integrations on deployed host

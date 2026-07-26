# Phase P5 — Cross-Platform Deployment

**Status:** Spec (pre-implementation)  
**Depends on:** Phase 4 (live metadata); benefits all phases P1–P4

## Goal

Document how to run airplay-status **outside macOS development**: Raspberry Pi as the recommended always-on receiver, Docker on Linux, and honest guidance for Synology and Docker-on-Mac limitations.

Answer: **No, it does not have to run on a Mac.** Mac remains the dev target; Linux (especially Raspberry Pi) is the recommended production home for a 24/7 AirPlay metadata receiver.

## Feasibility summary

| Platform | Verdict | Confidence | Notes |
|----------|---------|------------|-------|
| **macOS** | Works today | High | Bonjour (`dns-sd`), Homebrew shairport-sync, existing scripts |
| **Raspberry Pi (Linux)** | **Recommended** | High | Native shairport-sync + Avahi; well-documented metadata-only pattern |
| **Docker (Linux host)** | Feasible | Medium | Official image; **`network_mode: host`** required for mDNS |
| **Synology Docker** | Difficult | Low | DSM networking often breaks mDNS; advanced/experimental |
| **Docker Desktop on Mac** | Poor for receiver | Low | mDNS/AirPlay discovery unreliable inside VM |

## Architecture (production)

```
┌─────────────────────────────────────────────────────────┐
│  Raspberry Pi / Linux host                              │
│                                                         │
│  ┌─────────────────┐      metadata pipe (volume)       │
│  │ shairport-sync  │ ───────────────────────────────►  │
│  │ (host or container)                                   │
│  └────────┬────────┘                                    │
│           │ AirPlay (mDNS)                              │
└───────────┼─────────────────────────────────────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
  iPhone/Mac    Real speakers (optional second output)
     │
     └──────────────────────────► ┌──────────────────┐
                                  │ Node airplay-status │
                                  │ :3003               │
                                  └─────────┬───────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
              LAN browsers              Tidbyt push              Kindle /eink
```

Single metadata pipe feeds one Node process; all UIs and integrations consume `/api/status`.

## macOS (current dev target)

**Status:** Supported — default `./bin/run-local.sh` flow.

| Component | Setup |
|-----------|-------|
| shairport-sync | Homebrew; `config/shairport-sync.conf.example` with `mdns_backend = "dns-sd"` |
| Metadata pipe | `/tmp/shairport-sync-metadata` FIFO |
| Node app | `npm start` or `run-local.sh` on port 3003 |
| mDNS | Bonjour built-in |

## Relationship to P49 and P99

| Spec | Role |
|------|------|
| **P5** (this doc) | Platform reference — macOS, Pi, Docker, Synology tradeoffs |
| **P49** | Opinionated **pre-prod beta** path — package RPi4, AP2, fleet optional → [p49-preprod-deployment.md](./p49-preprod-deployment.md) |
| **P99** | Prod readiness after beta sign-off → [p99-prod-readiness.md](./p99-prod-readiness.md) |

**iPhone multi-room:** macOS = AirPlay 1 only; full multi-speaker beta is **P49** on RPi4 — [multi-room-airplay.md](../docs/multi-room-airplay.md), [p49-preprod-deployment.md](./p49-preprod-deployment.md).

## Raspberry Pi (recommended production)

**Status:** Recommended for always-on home use.

### Why Pi?

- Low power, always-on friendly
- Native Avahi for mDNS AirPlay advertisement
- shairport-sync packages available for ARM Linux
- Same metadata pipe → Node pattern as macOS

### Requirements

- Raspberry Pi 4 or 5 (Pi 3 may work with lighter load)
- Raspberry Pi OS (64-bit recommended) or Debian/Ubuntu ARM
- Same LAN as AirPlay senders
- Optional: wired Ethernet for stable mDNS

### shairport-sync (native install)

```bash
sudo apt update
sudo apt install shairport-sync avahi-daemon
```

Copy Linux config (planned):

```
config/shairport-sync.conf.linux.example
```

Key differences from macOS example:

```conf
general = {
  name = "AirPlay Status";
  output_backend = "pipe";
  mdns_backend = "avahi";   # not dns-sd
};

pipe = {
  name = "/dev/null";
};

metadata = {
  enabled = "yes";
  include_cover_art = "yes";
  pipe_name = "/tmp/shairport-sync-metadata";
};
```

Ensure Avahi is running:

```bash
sudo systemctl enable --now avahi-daemon
```

### Node app

```bash
git clone https://github.com/ritz-ras1245/airplay-status.git
cd airplay-status
npm ci
PORT=3003 node src/index.js
```

Use systemd unit (future P99 / P5 addendum) or `pm2` for persistence.

### Verification

1. iPhone Settings → AirPlay → **AirPlay Status** appears
2. Select as output; dashboard shows metadata
3. `./bin/check-sidecar.sh` passes

Reference: [App Code Labs — AirPlay metadata on Raspberry Pi](https://appcodelabs.com/show-artist-song-metadata-using-airplay-on-raspberry-pi)

## Docker (Linux host)

**Status:** Feasible with host networking.

### Critical constraint

AirPlay discovery uses **mDNS (Bonjour)**. Bridge networking in Docker breaks advertisement unless the host publishes services. **Use `network_mode: host`** for the shairport-sync container (and typically the Node container too, or bind-mount pipe only on host network stack).

### Planned `docker-compose.yml` sketch

```yaml
services:
  shairport-sync:
    image: mikebrady/shairport-sync:latest
    network_mode: host
    restart: unless-stopped
    volumes:
      - ./config/shairport-sync.conf.linux.example:/etc/shairport-sync.conf:ro
      - shairport-metadata:/tmp/shairport-metadata

  airplay-status:
    build: .
    network_mode: host
    restart: unless-stopped
    environment:
      - PORT=3003
      - METADATA_PIPE=/tmp/shairport-metadata/shairport-sync-metadata
    volumes:
      - shairport-metadata:/tmp/shairport-metadata
    depends_on:
      - shairport-sync

volumes:
  shairport-metadata:
```

**Notes:**

- Pipe path must match between containers via shared volume
- `output_backend = "pipe"` with `name = "/dev/null"` discards audio
- On SELinux hosts, label volumes appropriately
- Pi + Docker adds overhead; **native Pi install preferred** unless user already runs Docker stack

### Dockerfile (planned sketch)

```dockerfile
FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3003
CMD ["node", "src/index.js"]
```

Metadata pipe path via env var — extend `airplayMetadataService` to read `METADATA_PIPE` (implementation task, not blocking spec).

## Docker on macOS

**Not recommended** for the AirPlay **receiver** role.

Docker Desktop runs containers in a Linux VM. mDNS packets for `_raop._tcp` often do not reach the LAN correctly. Use **native Homebrew shairport-sync on Mac** for development and testing.

Running **only the Node dashboard** in Docker on Mac while shairport-sync runs natively is possible (mount pipe from host) — document as advanced split setup if needed.

## Synology NAS (DSM Docker)

**Status:** Advanced / experimental — expect friction.

### Common failures

- DSM Docker default bridge network isolates mDNS
- NAS firewall blocks UDP 5353 (mDNS) or TCP 7000 (RAOP)
- Avahi not running or not on same interface as Docker

### If attempting Synology

1. Use **host network** mode if DSM version supports it for the stack
2. Install/run Avahi on NAS or ensure shairport-sync publishes on host network namespace
3. Open firewall: UDP 5353, TCP 5000–7000 range (RAOP)
4. Prefer **native Linux package on Pi** instead of Synology for reliability

Document troubleshooting section in README — do not promise easy Synology setup.

### Synology troubleshooting checklist

| Check | Command / action |
|-------|------------------|
| Container network | Host mode, not bridge |
| shairport-sync logs | Receiver name visible; no mdns errors |
| From iPhone | AirPlay list shows "AirPlay Status" |
| Pipe mounted | Node container reads same FIFO path |
| Firewall | Allow mDNS and RAOP ports on LAN interface |

## Environment variables (all platforms)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3003` | HTTP server |
| `METADATA_PIPE` | `/tmp/shairport-sync-metadata` | FIFO path (override for Docker volume) |
| `SKIP_SHAIRPORT_CHECK` | unset | Set `1` in Docker if check fails falsely |
| `METADATA_DEBUG` | unset | `1` enables debug UI |
| `TIDBYT_*` | — | See [p2-tidbyt.md](./p2-tidbyt.md) |
| `EINK_*` | — | See [p3-eink-display.md](./p3-eink-display.md) |

## File structure (planned additions)

```
config/
├── shairport-sync.conf.example          # macOS (existing)
└── shairport-sync.conf.linux.example    # Linux / Pi / Docker
docker-compose.yml                       # host network stack
Dockerfile
specs/
└── p5-deployment.md
docs/
└── deployment.md                        # user-facing guide (optional, post-spec)
```

## Platform decision guide

| Your situation | Recommendation |
|----------------|----------------|
| Developing on Mac | Keep current `./bin/run-local.sh` |
| Always-on home display | **Raspberry Pi 4/5**, native install |
| Already run Docker on Linux server | Compose stack with host network |
| Synology only | Try host network; fallback to Pi |
| Need receiver on Mac only | Homebrew shairport-sync — no Docker |

## Acceptance criteria

- [ ] `config/shairport-sync.conf.linux.example` with `mdns_backend = "avahi"`
- [ ] `docker-compose.yml` sketch committed (host network, shared pipe volume)
- [ ] README or deployment doc explains Pi vs Mac vs Docker tradeoffs
- [ ] Synology documented as experimental with troubleshooting checklist
- [ ] `METADATA_PIPE` env documented for container deployments

## Out of scope (P5)

- Kubernetes / cloud deployment (local LAN tool)
- Automated Pi imaging (SD card flash scripts)
- Synology package SPK build
- TLS / reverse proxy for remote access (security risk for home LAN tool)

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| mDNS fails in Docker bridge | Mandate host network in compose; warn prominently |
| Pipe path mismatch across containers | Shared named volume; document in compose |
| Pi performance for PNG render (P3) | Cache PNG; optional disable `EINK` on Pi 3 |
| User expects Synology to "just work" | Label experimental; recommend Pi |

## Success criteria

- [ ] Clear recommendation: Pi for production, Mac for dev
- [ ] Linux config example and compose sketch enable reproducible deploy
- [ ] Limitations of Docker-on-Mac and Synology stated honestly

## References

- [shairport-sync](https://github.com/mikebrady/shairport-sync)
- [shairport-sync Docker Hub](https://hub.docker.com/r/mikebrady/shairport-sync)
- [App Code Labs — Raspberry Pi metadata display](https://appcodelabs.com/show-artist-song-metadata-using-airplay-on-raspberry-pi)
- [p2-tidbyt.md](./p2-tidbyt.md), [p3-eink-display.md](./p3-eink-display.md) — integrations on deployed host

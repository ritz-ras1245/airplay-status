# P49 Path A — Docker on Raspberry Pi (host network)

Try this path first. If iPhone discovery or AirPlay 2 multi-room fails after the spike, use [Path B (bare metal)](../rpi/README.md).

## Architecture

```
Host (RPi4)
├── nqptp (systemd on host — UDP 319/320)
├── shairport-sync container (network_mode: host)
└── airplay-status container (network_mode: host)
         └── metadata FIFO: /tmp/shairport-sync-metadata (host path)
```

**Why nqptp on the host:** AirPlay 2 timing uses exclusive UDP ports 319/320. Running nqptp inside Docker is fragile; the spike assumes host nqptp + host-network shairport-sync.

## Prerequisites

1. Raspberry Pi OS 64-bit with Docker Engine + Compose v2
2. Avahi on host: `sudo apt install avahi-daemon && sudo systemctl enable --now avahi-daemon`
3. nqptp on host (install via Path B script once, or build manually):

```bash
git clone --depth 1 --branch 1.2.4 https://github.com/mikebrady/nqptp.git /tmp/nqptp
make -C /tmp/nqptp && sudo make -C /tmp/nqptp install
sudo cp deploy/rpi/systemd/nqptp.service /etc/systemd/system/
sudo systemctl enable --now nqptp
```

## Quick start

From repo root on the Pi:

```bash
cp config/deploy/beta.env.example .env
./bin/render-shairport-config.sh --stage beta \
  --output deploy/docker/shairport/shairport-sync.conf
./bin/p49-up.sh docker
```

Dashboard: `http://<pi-lan-ip>:3003`

## Scripts

| Script | Action |
|--------|--------|
| `./bin/p49-up.sh` | Start Docker stack (default) |
| `./bin/p49-up.sh docker` | Same |
| `./bin/p49-up.sh rpi` | Start systemd stack (Path B) |
| `./bin/p49-down.sh` | Stop Docker stack |

## Configuration

| Path | Purpose |
|------|---------|
| `.env` | `DEPLOY_STAGE=beta`, `DEPLOY_PHASE=p49`, `PORT`, Tidbyt |
| `deploy/docker/shairport/shairport-sync.conf` | AP2 receiver config mounted into container |

After changing `.env` or stage name, re-render shairport config (see Quick start) and restart:

```bash
./bin/p49-down.sh && ./bin/p49-up.sh docker
```

## Verify (on Pi)

```bash
docker compose -f deploy/docker/docker-compose.yml ps
curl -sf http://localhost:3003/api/version | python3 -m json.tool
./bin/check-sidecar.sh
```

## Spike pass/fail

Document results in [docs/p49-docker-spike.md](../../docs/p49-docker-spike.md).

**Spike fails → use Path B** if:

- iPhone cannot discover **AirPlay Status (Beta)** after host nqptp + compose up
- AirPlay 2 multi-room (HomePods + AirPlay Status) does not work
- Official `mikebrady/shairport-sync` image lacks AP2 on arm64

## Human beta sign-off

Complete the device checklist in [docs/p49-docker-spike.md](../../docs/p49-docker-spike.md#human-beta-sign-off-checklist). Not runnable in cloud CI.

## References

- [p49-docker-spike.md](../../docs/p49-docker-spike.md)
- [deploy/rpi/README.md](../rpi/README.md) — bare-metal fallback
- [specs/p49-preprod-deployment.md](../../specs/p49-preprod-deployment.md)

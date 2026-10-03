# P49 - Docker deploy

Host-network compose: **nqptp on the host** + **shairport-sync** + **airplay-status** containers.

## Limitations

### macOS + Docker Desktop

| Topic | Reality |
|-------|---------|
| **`network_mode: host`** | Containers run in a Linux VM, not on your LAN. mDNS/AirPlay does not reach iPhone on Wi‑Fi. |
| **Firewall / open ports** | Does not fix discovery. |
| **nqptp (UDP 319/320)** | Required for AirPlay 2. macOS reserves these ports - nqptp cannot run on the Mac host. |
| **iPhone sees speaker** | **Will not work** on Mac Docker. Use a Pi on your LAN, or `./bin/run-local.sh --debug` on Mac (AP1 only). |
| **What Mac Docker is good for** | Compose build, container logs, `docker exec` API checks |

### Raspberry Pi

Requires **nqptp** and **Avahi** on the **host** (not in compose). Same Wi‑Fi/LAN as iPhone. Wired Ethernet preferred.

### Linux container host (2026-10-03)

A normal Linux container host replaces Synology Container Manager. Container-shaped workloads map to that host even when older docs say Synology or never name the host.

Host networking on that host (Podman or Docker) removes the discovery blockers tied to a Docker bridge, Docker Desktop on a Mac, and DSM Container Manager. Publishing ports alone does not. [`docker-compose.yml`](./docker-compose.yml) uses `network_mode: host`, not a ports map.

That does not make the current AirPlay 2 package runnable. Still required, and not supplied as a container:

1. **nqptp listening on the host (UDP 319 and 320).** This repo only installs nqptp by compiling it on the host. There is no nqptp image. [README.md](./README.md) calls in-container nqptp fragile and keeps it out of compose.
2. **avahi-daemon on the host.** The only install line is apt (`sudo apt install avahi-daemon` in [README.md](./README.md)). There are no rpm instructions.
3. **One shared mount** so shairport-sync and the Node app see the same `/tmp/shairport-sync-metadata` FIFO. The [P49 spec](../../specs/p49-preprod-deployment.md) requires that path on the host. `docker-compose.yml` mounts only `./shairport/shairport-sync.conf`.
4. **A start path that loads `linux/amd64` images built elsewhere.** [`bin/p49-up.sh`](../../bin/p49-up.sh) runs `docker compose up -d --build` and pulls `mikebrady/shairport-sync:latest`. The repo never says whether that image does AirPlay 2 on amd64. The only image failure it names is lacking AP2 on arm64 ([README.md](./README.md)).

[`deploy/rpi/install.sh`](../rpi/install.sh) is a separate path (`apt-get`, then compile). It is not the container package. Podman is never mentioned.

Same note: [P5 container host mapping](../../specs/p5-deployment.md#container-host-mapping-2026-10-03), [P49 Synology line](../../specs/p49-preprod-deployment.md#synology-line-2026-10-03).

---

## Host setup (Pi, once)

Before first `./bin/p49-up.sh docker`:

```bash
sudo ./deploy/rpi/install.sh   # nqptp, Avahi, Node deps on host
```

Or install nqptp manually - see comments in `deploy/rpi/install.sh`.

---

## Quick start

From repo root:

```bash
cp config/deploy/beta.env.example .env
./bin/render-shairport-config.sh --stage beta \
  --output deploy/docker/shairport/shairport-sync.conf
./bin/p49-up.sh docker
```

Dashboard: `http://<host>:3003` (Pi LAN IP on Pi; `docker exec` on Mac).

## Tail logs

```bash
docker compose -f deploy/docker/docker-compose.yml logs -f --tail=100
docker compose -f deploy/docker/docker-compose.yml logs -f --tail=100 airplay-status
docker compose -f deploy/docker/docker-compose.yml logs -f --tail=100 shairport-sync
```

## Stop

```bash
./bin/p49-down.sh docker
```

## Verify

```bash
docker compose -f deploy/docker/docker-compose.yml ps
docker exec airplay-status-app curl -sf http://127.0.0.1:3003/api/version | python3 -m json.tool
./bin/check-version.sh http://<host>:3003
./bin/check-sidecar.sh
```

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | shairport-sync + Node |
| `Dockerfile` | Node app image |
| `shairport/shairport-sync.conf` | AP2 config - render before up |

Spike log: [docs/p49-docker-spike.md](../../docs/p49-docker-spike.md)

# P49 — Docker deploy (Mac / smoke only)

**The Pi does not run Docker.** Household Docker is on **Synology**. Pi updates are a Mac-built tarball — [deploy/rpi/README.md](../rpi/README.md), [DECISIONS.md](../../DECISIONS.md).

The compose stack below is for **Mac smoke / API checks** only.

Host-network compose (if you still experiment): **nqptp on the host** + **shairport-sync** + **airplay-status** containers.

## Limitations

### macOS + Docker Desktop

| Topic | Reality |
|-------|---------|
| **`network_mode: host`** | Containers run in a Linux VM, not on your LAN. mDNS/AirPlay does not reach iPhone on Wi‑Fi. |
| **Firewall / open ports** | Does not fix discovery. |
| **nqptp (UDP 319/320)** | Required for AirPlay 2. macOS reserves these ports — nqptp cannot run on the Mac host. |
| **iPhone sees speaker** | **Will not work** on Mac Docker. Use a Pi on your LAN, or `./bin/run-local.sh --debug` on Mac (AP1 only). |
| **What Mac Docker is good for** | Compose build, container logs, `docker exec` API checks |

### Raspberry Pi

**Do not** run this compose on the Pi. Use [deploy/rpi/README.md](../rpi/README.md).

---

## Host setup (retired on Pi)

`./bin/p49-up.sh docker` is not the P49 update path. For the Pi, push an artifact. The old on-Pi compile is `sudo ./deploy/rpi/install.sh --break-glass-compile` only.

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
| `shairport/shairport-sync.conf` | AP2 config — render before up |

Spike log: [docs/p49-docker-spike.md](../../docs/p49-docker-spike.md)

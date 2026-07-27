# P49 — Docker deploy

Host-network compose: **nqptp on the host** + **shairport-sync** + **airplay-status** containers.

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

Requires **nqptp** and **Avahi** on the **host** (not in compose). Same Wi‑Fi/LAN as iPhone. Wired Ethernet preferred.

---

## Host setup (Pi, once)

Before first `./bin/p49-up.sh docker`:

```bash
sudo ./deploy/rpi/install.sh   # nqptp, Avahi, Node deps on host
```

Or install nqptp manually — see comments in `deploy/rpi/install.sh`.

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

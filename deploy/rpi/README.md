# P49 Path B — Bare Raspberry Pi OS (AirPlay 2)

Recommended fallback when the Docker spike fails or when you want native nqptp + shairport-sync without container overhead.

## Prerequisites

| Item | Requirement |
|------|-------------|
| Hardware | Raspberry Pi 4 (Pi 5 also works) |
| OS | Raspberry Pi OS 64-bit Lite |
| Network | Same LAN as iPhone; wired Ethernet preferred |
| Ports | UDP 319/320 (nqptp), TCP 7000 (AirPlay 2), UDP 5353 (mDNS) |

## Fresh install (on the Pi)

```bash
git clone https://github.com/ritz-ras1245/airplay-status.git
cd airplay-status
git checkout feat/cursor/p49-rpi-deployment-0a02   # or main after merge

cp config/deploy/beta.env.example .env
# Edit .env: TIDBYT_* if using Tidbyt (optional)

sudo ./deploy/rpi/install.sh
```

The install script:

1. Installs build deps, Avahi, Node.js 20
2. Builds **nqptp** and **shairport-sync** with AirPlay 2 + metadata
3. Copies the app to `/opt/airplay-status` and runs `npm ci`
4. Renders `/etc/shairport-sync.conf` (beta name: **AirPlay Status (Beta)**)
5. Enables systemd units: `nqptp`, `shairport-sync`, `airplay-status`

## Deploy from Mac (optional)

```bash
./bin/p49-install-rpi.sh pi@192.168.1.50
ssh pi@192.168.1.50 'cd ~/airplay-status && sudo ./deploy/rpi/install.sh'
```

## Service management

```bash
sudo systemctl status nqptp shairport-sync airplay-status
sudo systemctl restart shairport-sync airplay-status
./bin/check-version.sh http://localhost:3003
./bin/check-sidecar.sh
```

## Configuration

| File | Purpose |
|------|---------|
| `/opt/airplay-status/.env` | `DEPLOY_STAGE=beta`, `DEPLOY_PHASE=p49`, Tidbyt vars |
| `/etc/shairport-sync.conf` | AP2 receiver (rendered from template) |
| `/tmp/shairport-sync-metadata` | Metadata FIFO (created by shairport-sync) |

Re-render shairport config after `.env` changes:

```bash
cd /opt/airplay-status
sudo SHAIRPORT_CONFIG=/etc/shairport-sync.conf ./bin/render-shairport-config.sh --stage beta --output /etc/shairport-sync.conf
sudo systemctl restart shairport-sync
```

## Verify AirPlay 2

```bash
shairport-sync -V | head -1          # should mention airplay-2
systemctl is-active nqptp            # active
ss -ulnp | grep -E '319|320'         # nqptp listening
curl -sf http://localhost:3003/api/version
```

## Human beta sign-off

Cloud agents and CI **cannot** validate iPhone multi-speaker or HomePod grouping. Complete the checklist in [docs/p49-docker-spike.md](../../docs/p49-docker-spike.md#human-beta-sign-off-checklist) on your home LAN before P99.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Receiver not on iPhone | `systemctl status avahi-daemon`; same Wi‑Fi/LAN; firewall |
| AP2 group fails | nqptp running; shairport built with `--with-airplay-2`; port 7000 |
| No metadata on dashboard | `./bin/check-sidecar.sh`; FIFO at `/tmp/shairport-sync-metadata` |
| Wrong picker name | Re-run `render-shairport-config.sh --stage beta` |

See also [docs/multi-room-airplay.md](../../docs/multi-room-airplay.md) and [specs/p49-preprod-deployment.md](../../specs/p49-preprod-deployment.md).

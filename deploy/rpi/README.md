# P49 — bare-metal deploy (Raspberry Pi)

**Default for Pi beta.** One script installs nqptp, shairport-sync (AP2 + metadata pipe), Node app, and systemd units.

Lessons from first real bring-up: [docs/p49-rpi-bare-metal-lessons.md](../../docs/p49-rpi-bare-metal-lessons.md)

## Fresh install

```bash
git clone https://github.com/ritz-ras1245/airplay-status.git
cd airplay-status
git checkout feat/cursor/p49-rpi-deployment-0a02   # or main after merge

sudo ./deploy/rpi/install.sh
./bin/check-p49-beta.sh
```

Install takes **~15–25 minutes** (shairport-sync compile). `.env` is created from `config/deploy/beta.env.example` automatically.

## After install

| Item | Location |
|------|----------|
| App | `/opt/airplay-status` |
| shairport config | `/etc/shairport-sync.conf` |
| Metadata pipe | `/tmp/shairport-sync-metadata` |
| Dashboard | `http://<pi-ip>:3003` |

```bash
sudo systemctl status nqptp shairport-sync airplay-status
./bin/check-version.sh http://localhost:3003
```

## Docker (optional)

Docker on Pi still requires host nqptp. See [deploy/docker/README-WARN.md](../docker/README-WARN.md). Bare metal is simpler on a dedicated Pi.

## Sync from Mac

```bash
./bin/p49-install-rpi.sh airplay@airplay-beta.local
ssh airplay@airplay-beta.local 'cd ~/airplay-status && sudo ./deploy/rpi/install.sh'
```

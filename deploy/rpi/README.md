# Raspberry Pi — P49 beta (bare metal)

**Plan:** [docs/p49-beta-remote-deploy.md](../../docs/p49-beta-remote-deploy.md)  
**Stage config:** [config/deploy/beta.env.example](../../config/deploy/beta.env.example)

Path B: nqptp + shairport-sync AP2 + Node on Raspberry Pi OS 64-bit Lite.

> **Scaffold note:** `install.sh` and systemd units on branch `doc/ritz-ras1245/p49-release` are placeholders until the cloud agent PR merges. Phase 0 below is actionable now; replace manual build steps with `./deploy/rpi/install.sh` when that PR lands.

---

## Phase 0 — One-time first boot (~30 min)

### 1. Flash SD card

- **Image:** Raspberry Pi OS **64-bit Lite**
- **Imager options:** Enable SSH, set username/password, configure Wi‑Fi if not using Ethernet
- **Network:** Wired Ethernet preferred (mDNS / AirPlay stability)

### 2. Hostname and reachability

Pick one:

- **mDNS:** `airplay-beta.local` (default hostname in imager), or
- **Static IP** on your LAN (document it for deploy secrets)

From your Mac:

```bash
ssh <user>@airplay-beta.local
# or: ssh <user>@<static-ip>
```

### 3. Clone the repo

On the Pi:

```bash
sudo apt-get update
sudo apt-get install -y git curl build-essential
git clone https://github.com/ritz-ras1245/airplay-status.git
cd airplay-status
git checkout feat/ritz-ras1245/p49-rpi-beta   # or main after P49 PR merges
```

### 4. Install stack

**When cloud PR is merged** (preferred):

```bash
./deploy/rpi/install.sh
```

**Until then** (manual bootstrap — minimal):

```bash
# Node 20 (example via NodeSource — adjust if install.sh uses another method)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm ci

# nqptp + shairport-sync AP2: follow cloud agent install.sh when available
# BUILD.md: https://github.com/mikebrady/shairport-sync/blob/master/BUILD.md
# nqptp: https://github.com/mikebrady/nqptp
echo "Complete nqptp/shairport-sync build per P49 PR or AGENT_START_HERE.md" >&2
```

### 5. Beta stage env

```bash
cp config/deploy/beta.env.example .env
./bin/render-shairport-config.sh --stage beta
```

iPhone should eventually show **AirPlay Status (Beta)** in the AirPlay picker.

### 6. Enable systemd services

**When unit files exist** (after cloud PR or from this branch's scaffolds):

```bash
sudo cp deploy/rpi/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nqptp.service shairport-sync.service airplay-status.service
```

Start order: **nqptp → shairport-sync → airplay-status**.

### 7. Verify from Mac

```bash
./bin/check-version.sh http://airplay-beta.local:3003
./bin/check-sidecar.sh   # run on Pi or adapt for remote
curl -sf http://airplay-beta.local:3003/api/health
```

Expect JSON with `"deployStage":"beta"`, `"deployPhase":"p49"`.

### 8. iPhone beta checklist

- [ ] Select **real speakers + AirPlay Status (Beta)** in one AirPlay group
- [ ] Dashboard shows metadata within ~5s
- [ ] Reboot Pi → all three services auto-start

Sign-off criteria: [specs/p49-preprod-deployment.md](../../specs/p49-preprod-deployment.md).

---

## Phase 1 — Remote deploy (after first boot)

Never pull the SD card for routine updates.

From Mac (when `bin/p49-deploy.sh` is implemented):

```bash
./bin/p49-deploy.sh --host airplay-beta.local --ref <git-sha> --stage beta
```

Or trigger GitHub Actions: **Deploy P49 beta** workflow (see [docs/p49-beta-remote-deploy.md](../../docs/p49-beta-remote-deploy.md)).

---

## Files in this directory

| File | Purpose |
|------|---------|
| `install.sh` | Idempotent first-boot install (scaffold → cloud agent) |
| `systemd/nqptp.service` | PTP daemon for AirPlay 2 |
| `systemd/shairport-sync.service` | AP2 receiver + metadata pipe |
| `systemd/airplay-status.service` | Node dashboard |

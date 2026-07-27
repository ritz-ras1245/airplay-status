---
tags:
  - airplay-status
  - p49
  - raspberry-pi
  - bare-metal
  - study
created: 2026-07-26
source: airplay-status/docs/p49-rpi-bare-metal-lessons.md
remarkable: later
---

# P49 RPi bare-metal — study notes

> Copy into Obsidian vault. Remarkable export: optional later.

## One-line summary

**Pi beta = bare metal `install.sh`**, not Docker. Trixie Imager writes **`network-config`** + **`user-data`** on `bootfs`.

## Decisions

- Bare metal default on Pi
- Mac Docker = API smoke only (no AirPlay discovery)
- Imager 2.0+ for Trixie
- Sanity: `./bin/check-p49-beta.sh`

## Imager / SD (pre–first-boot)

| Setting | File on `bootfs` |
|---------|------------------|
| Wi‑Fi | `network-config` |
| user, SSH, hostname | `user-data` |

Legacy **not** on Trixie: `wpa_supplicant.conf`, `config.json` on card.  
`config.txt` = firmware only.

## install.sh fixes

### nqptp
- `autoreconf -fi` → `./configure --with-systemd-startup` → `make install`
- Path: `/usr/local/bin/nqptp`

### shairport-sync
- **`--with-pipe`** required (else "No audio backend")
- Extra apt: `libpopt-dev`, `xxd`
- Path: `/usr/local/bin/shairport-sync`
- `-V` should include `pipe` and `AirPlay2`

### npm
- `chown airplay-status` **before** `npm ci`

## Healthy stack

```
nqptp          → UDP 319/320
shairport-sync → TCP 7000
airplay-status → TCP 3003
pipe           → /tmp/shairport-sync-metadata
API            → deployPhase=p49, deployStage=beta
```

## Commands

```bash
sudo ./deploy/rpi/install.sh
./bin/check-p49-beta.sh
./bin/check-version.sh http://airplay-beta.local:3003
```

## Still human-only

iPhone + HomePods in one AirPlay group with **AirPlay Status (Beta)**.

## Tidbyt on Pi

- `install.sh` installs **pixlet**
- Creds: `docs/p49-tidbyt-credentials.md` — web upload or `tidbyt.env` from iCloud
- Template: `config/deploy/tidbyt.env.example`

## Links

- Repo doc: `docs/p49-rpi-bare-metal-lessons.md`
- `deploy/rpi/README.md`
- PR #4

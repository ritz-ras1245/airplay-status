# P49 RPi bare-metal — lessons learned (2026-07-26)

First successful bring-up on **Raspberry Pi 4**, **Raspberry Pi OS Lite 64-bit (Trixie)**, hostname `airplay-beta`.  
Validated stack: nqptp + shairport-sync AP2 + airplay-status systemd → `http://airplay-beta.local:3003`.

---

## Takeaways (executive)

| Topic | Decision |
|-------|----------|
| **How we update now** | Mac Docker **buildx** `linux/arm64` tarball → `./bin/p49-push-release.sh rasohoni@pi.home.arpa` — [DECISIONS.md](../DECISIONS.md) |
| **Pi deploy path** | **Bare metal** systemd — **no Docker/compose on the Pi** (Synology owns Docker) |
| **On-Pi compile** | **Break-glass only** (`sudo ./deploy/rpi/install.sh --break-glass-compile`) |
| **Mac Docker** | Smoke/API only — no iPhone AirPlay discovery ([README-WARN](../deploy/docker/README-WARN.md)) |
| **Imager OS** | Trixie uses **cloud-init** on boot partition — not `wpa_supplicant.conf` |
| **Imager version** | Need **2.0+** for Trixie customisation; 1.7.x is too old |
| **Compile flags** | Still the source of truth for nqptp/shairport — now in `deploy/rpi/release/*-configure-flags.txt` |
| **Sanity check** | `/opt/airplay-status/bin/check-p49-beta.sh` after artifact install |

---

## SD flash — Raspberry Pi Imager

### Where settings live (before first boot)

Boot partition mounts as **`bootfs`** on Mac (`/Volumes/bootfs`).

| Imager setting | File on SD |
|----------------|------------|
| Wi‑Fi SSID, password, country | **`network-config`** (YAML) |
| Hostname, user, SSH, timezone | **`user-data`** (YAML) |

**Not used on Trixie cloud-init images:** `wpa_supplicant.conf`, `userconf.txt`, `config.json` on the card.  
**`config.txt`** is still present but is **Pi firmware config** (GPU, overlays) — not Wi‑Fi or user accounts.

Reference wizard fields: [config/deploy/p49-rpi-imager-customisation.json](../config/deploy/p49-rpi-imager-customisation.json).

### Imager CLI (optional)

Imager **2.0.3+** supports headless write with cloud-init files:

```bash
rpi-imager --cli \
  --cloudinit-userdata path/to/user-data \
  --cloudinit-networkconfig path/to/network-config \
  path/to/raspios.img.xz \
  /dev/rdiskN
```

Our JSON presets are **Imager inputs on the Mac** — they are not copied onto the SD as-is.

### Pitfalls we hit

- **Old Imager (1.7.x)** — customisation for Trixie unreliable; upgrade to current [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
- **Missing `network-config` / `user-data` after write** — gear-icon customisation did not run; verify files on `bootfs` **before** first boot.
- **Ethernet** avoids Wi‑Fi debug on first bring-up.

---

## Bare metal vs Docker on Pi

| | Bare metal | Docker on Pi |
|--|------------|----------------|
| shairport-sync | Build once on Pi (~20 min) | Prebuilt image |
| nqptp | Host systemd | **Still required on host** |
| Moving parts | systemd only | docker + compose + host nqptp |
| Trixie packages | apt deps only | `docker-compose-plugin` not always in default repos |

**Conclusion:** For a dedicated beta Pi, bare metal is the simpler operational story. Docker remains documented for compose-based deploy experiments ([p49-docker-spike.md](./p49-docker-spike.md)).

---

## How we update (current)

Do **not** `git clone` + compile on the Pi for routine updates.

```bash
# Mac
./bin/p49-build-release.sh
./bin/p49-push-release.sh rasohoni@pi.home.arpa
./bin/check-version.sh http://pi.home.arpa
```

The flags below still matter: the Docker buildx image compiles nqptp/shairport with the **same** `./configure` lines. Host: `pi` / `pi.home.arpa`. SSH sudo: `rasohoni`. `r-bot` cannot sudo.

## `install.sh` compile fixes (historical — now break-glass + Docker build)

These were discovered during live bring-up. They are preserved in `deploy/rpi/break-glass/install-compile-on-pi.sh` and `deploy/rpi/release/` (buildx).

### nqptp

- **Wrong:** `make clean all` — nqptp has no `clean`/`all` targets in autotools tree.
- **Right:** `autoreconf -fi`, `./configure --with-systemd-startup`, `make`, `make install`.
- **Binary path:** `/usr/local/bin/nqptp` (not `sbin`).
- **systemd:** `ExecStart=/usr/local/bin/nqptp`.

### shairport-sync

- **Wrong:** `./configure --with-airplay-2 --with-ffmpeg …` without pipe backend → runtime **“No audio backend found!”**
- **Right:** add **`--with-pipe`** (metadata-only; audio discarded via config).
- **Deps added to apt:** `libpopt-dev`, `xxd` (required for AP2 plist build).
- **Binary path:** `/usr/local/bin/shairport-sync`.
- **systemd:** `ExecStart=/usr/local/bin/shairport-sync -c /etc/shairport-sync.conf`.
- **Skip logic:** do not skip rebuild if AP2 present but **pipe backend missing** (`shairport-sync -V` must mention pipe).

### Node app

- **Wrong:** `npm ci` as `airplay-status` user before `chown` → EACCES on `/opt/airplay-status/node_modules`.
- **Right:** `rsync` → **`chown -R airplay-status`** → `sudo -u airplay-status npm ci`.

### apt lock

- If `apt-get` lock held, wait for other apt process — do not delete lock files.

---

## Bring-up sequence (current)

```bash
# Mac — no git/npm/make on the Pi
./bin/p49-build-release.sh
./bin/p49-push-release.sh rasohoni@pi.home.arpa
./bin/check-version.sh http://pi.home.arpa
```

Break-glass compile (only if artifact push is impossible): `sudo ./deploy/rpi/install.sh --break-glass-compile` (~15–25 min).

---

## Healthy stack signals

| Check | Expected |
|-------|----------|
| `systemctl is-active nqptp shairport-sync airplay-status` | all `active` |
| `ss -ulnp \| grep -E '319\|320'` | nqptp |
| `ss -tlnp \| grep 7000` | shairport-sync AP2 |
| `test -p /tmp/shairport-sync-metadata` | pipe exists |
| `GET /api/version` | `deployPhase=p49`, `deployStage=beta` |
| iPhone AirPlay picker | **AirPlay Status (Beta)** on same LAN |

---

## Human beta (still required)

Automated checks do not replace iPhone + HomePods multi-room test. See [AGENT_START_HERE.md](../AGENT_START_HERE.md) and [p49-docker-spike.md](./p49-docker-spike.md).

---

## References

| Doc | Purpose |
|-----|---------|
| [deploy/rpi/README.md](../deploy/rpi/README.md) | Artifact deploy SOP |
| [DECISIONS.md](../DECISIONS.md) | How we update |
| [deploy/rpi/install.sh](../deploy/rpi/install.sh) | Gate → break-glass compile |
| [bin/check-p49-beta.sh](../bin/check-p49-beta.sh) | Post-install sanity script |
| [p49-beta-remote-deploy.md](./p49-beta-remote-deploy.md) | SD flash + remote deploy plan |
| [deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md) | Docker limitations |

Study copy (Obsidian-friendly): [docs/study/p49-rpi-bare-metal-lessons-obsidian.md](./study/p49-rpi-bare-metal-lessons-obsidian.md)

Tidbyt on Pi: [docs/p49-tidbyt-credentials.md](./p49-tidbyt-credentials.md)

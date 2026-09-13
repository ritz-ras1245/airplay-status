# DECISIONS — airplay-status

Locked choices so agents and humans do not re-litigate them. New decisions go here; do not bury them only in chat.

---

## How we update (P49 Pi)

**Build on the Mac. Push a tarball. The Pi does not compile.**

```text
Mac (Docker buildx linux/arm64)
    → artifacts/releases/airplay-status-<tag>-linux-aarch64.tar.gz
    → scp + sudo unpack  (rasohoni@pi.home.arpa)
    → /opt/airplay-status + systemd  (nqptp → shairport-sync → airplay-status)
```

| Step | Command |
|------|---------|
| Build | `./bin/p49-build-release.sh` |
| Push | `./bin/p49-push-release.sh rasohoni@pi.home.arpa` |
| Sanity | `ssh rasohoni@pi.home.arpa 'sudo /opt/airplay-status/bin/check-p49-beta.sh'` |
| From Mac | `./bin/check-version.sh http://pi.home.arpa` |

**Do not** update by `git pull` + `npm ci` + `./deploy/rpi/install.sh` compile on the Pi.

Break-glass (on-Pi compile, 15–25 min): `sudo ./deploy/rpi/install.sh --break-glass-compile`.

v1 is SSH push only. NAS `persist/pi/<project>` auto-update is later — do not block scripts on it.

---

## Deploy topology (locked)

| Item | Decision |
|------|----------|
| Pi deploy | **Bare metal** systemd only |
| Docker on Pi | **No** — no compose, no containers on the Pi |
| Docker owner | **Synology** (household Docker host) |
| Build | Mac Docker **buildx** `linux/arm64` |
| Node deps | Ship **linux-arm64 `node_modules`** in the tarball (no `npm ci` on Pi) |
| Sidecars | Prebuilt **nqptp** + **shairport-sync** (AirPlay 2 + pipe) in the tarball |
| pixlet | Download upstream **linux_arm64** release — do not compile |
| Pi apt | Thin **runtime** libs only (no `-dev`, no compiler toolchain) |
| Pi hostname | `pi` / `pi.home.arpa` (mDNS: `pi.local`) |
| SSH admin | `rasohoni` — **has sudo** (use this for push/install) |
| Agent account | `r-bot` — **no sudo** (cannot run the installer) |
| Persist (later) | NAS `persist/pi/airplay-status` — not required for v1 scripts |

---

## Sidecar compile flags (verified)

Source of truth was `deploy/rpi/install.sh` from the P49 RPi4 bring-up. Flags now live in `deploy/rpi/release/` and are used by buildx **and** break-glass:

| Binary | Version | Configure |
|--------|---------|-----------|
| nqptp | 1.2.4 | `--with-systemd-startup` |
| shairport-sync | 4.3.6 | `--with-airplay-2 --with-pipe --with-metadata --with-avahi --with-ssl=mbedtls --sysconfdir=/etc` |
| pixlet | 0.34.0 | upstream `pixlet_0.34.0_linux_arm64.tar.gz` |

Omitting `--with-pipe` yields runtime **“No audio backend found!”**. Audio is discarded via config (`pipe` → `/dev/null`).

---

## Related

- [deploy/rpi/README.md](deploy/rpi/README.md)
- [docs/p49-beta-remote-deploy.md](docs/p49-beta-remote-deploy.md)
- [docs/releases/README.md](docs/releases/README.md) — annotated tags
- [docs/p49-rpi-bare-metal-lessons.md](docs/p49-rpi-bare-metal-lessons.md) — historical compile lessons (still inform the Docker build)

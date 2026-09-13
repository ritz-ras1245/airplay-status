# P49 beta — remote deploy

**Default:** Mac Docker **buildx** `linux/arm64` → tarball → SSH push to a **bare-metal** Pi.  
**Do not** update with SSH + git + on-Pi `install.sh` compile.

Locked decisions: [DECISIONS.md](../DECISIONS.md)  
Pi SOP: [deploy/rpi/README.md](../deploy/rpi/README.md)  
Spec: [specs/p49-preprod-deployment.md](../specs/p49-preprod-deployment.md)

---

## Target architecture

```text
Mac (features, AP1 sidecar, Docker buildx)
        │
        │  ./bin/p49-build-release.sh
        ▼
artifacts/releases/airplay-status-<tag>-linux-aarch64.tar.gz
        │
        │  ./bin/p49-push-release.sh rasohoni@pi.home.arpa
        ▼
RPi4 bare metal (no Docker)
        nqptp → shairport-sync (AP2 + pipe) → airplay-status
        health: GET /api/version + ./bin/check-p49-beta.sh
```

| Role | Host | Notes |
|------|------|--------|
| Docker | **Synology** | Not on the Pi |
| Build | **Mac** (or GitHub Actions buildx) | `linux/arm64`; ships `node_modules` |
| Runtime | **`pi` / `pi.home.arpa`** | systemd only |
| SSH sudo | **`rasohoni`** | Required for unpack/install |
| SSH agent | **`r-bot`** | No sudo — cannot run the installer |

NAS `persist/pi/airplay-status` is the future blob store. **v1 does not wait on it** — scp is enough.

---

## Phase 0 — One-time SD flash (~30 min, human)

Do once. Do not pull a compiler toolchain onto the card for routine updates.

| Step | Action |
|------|--------|
| 1 | Flash **Raspberry Pi OS 64-bit Lite** |
| 2 | Enable **SSH**; user `rasohoni` with sudo; hostname `pi` |
| 3 | Ethernet preferred (mDNS). Names: `pi.home.arpa` / `pi.local` |
| 4 | Thin apt only after first boot (`avahi-daemon` arrives with the tarball install) |
| 5 | From Mac: `./bin/p49-build-release.sh` then `./bin/p49-push-release.sh rasohoni@pi.home.arpa` |
| 6 | `ssh rasohoni@pi.home.arpa 'sudo /opt/airplay-status/bin/check-p49-beta.sh'` |
| 7 | From Mac: `./bin/check-version.sh http://pi.home.arpa` |
| 8 | iPhone: HomePods + **AirPlay Status (Beta)** together |

Flash details: [docs/p49-rpi-bare-metal-lessons.md](./p49-rpi-bare-metal-lessons.md) (Imager/cloud-init). Ignore any “git clone + compile on Pi” steps in older sections — those are historical / break-glass.

---

## Phase 1 — Every deploy after that

| Step | Action |
|------|--------|
| 1 | Tag if shipping a named artifact (annotated — [docs/releases/README.md](./releases/README.md#annotated-release-tags-p49-artifacts)) |
| 2 | `./bin/p49-build-release.sh` on Mac, **or** run **Build P49 linux/arm64 release** workflow |
| 3 | `./bin/p49-push-release.sh rasohoni@pi.home.arpa` |
| 4 | Installer: apt runtime debs → unpack `/opt/airplay-status` → restart nqptp → shairport-sync → airplay-status |
| 5 | Health: `/api/version`, `check-p49-beta.sh` |
| 6 | `.env` on the Pi is **preserved** (Tidbyt etc.). `release.env` is overwritten with `GIT_COMMIT` |

**Secrets:** stay in `/opt/airplay-status/.env` on the Pi — never committed.

Optional later: GitHub Actions can scp using `P49_SSH_PRIVATE_KEY` (must be `rasohoni`, not `r-bot`). The scaffold workflow is [`.github/workflows/p49-deploy-beta.yml`](../.github/workflows/p49-deploy-beta.yml) — artifact push is the supported path; git-checkout deploy is retired.

---

## Beta today, prod later — same Pi tier

| Stage | Env file | AirPlay name | When |
|-------|----------|--------------|------|
| **beta** | `config/deploy/beta.env.example` | AirPlay Status **(Beta)** | Now — P49 |
| **prod** | `config/deploy/prod.env.example` | AirPlay Status | After P99 |

Same tarball, different `--stage` on first install (`install.sh --stage prod`). Do **not** run beta and prod on one Pi at once.

---

## Break-glass (compile on Pi)

If Mac/CI cannot produce a tarball:

```bash
sudo ./deploy/rpi/install.sh --break-glass-compile
```

This is the old git + make + `npm ci` path. It is gated on purpose. See [deploy/rpi/break-glass/install-compile-on-pi.sh](../deploy/rpi/break-glass/install-compile-on-pi.sh).

---

## GitHub Free tier

`ritz-ras1245/airplay-status` is public. Actions minutes for `ubuntu-latest` + buildx/QEMU are allowed. Artifact upload is enough for v1; we do not rely on large GitHub Packages storage.

---

## Beta sign-off (human + device)

- [ ] iPhone: HomePods + **AirPlay Status (Beta)** in one AirPlay group
- [ ] Dashboard live metadata within 5s
- [ ] `GET /api/version` → `deployPhase=p49`, correct semver/commit
- [ ] 24h soak; reboot → services auto-start
- [ ] Update path is tarball push (not on-Pi compile)

Then **P50** soak / **P99** prod readiness on the same Pi tier.

---

## References

| Doc | Path |
|-----|------|
| Decisions | [DECISIONS.md](../DECISIONS.md) |
| Pi SOP | [deploy/rpi/README.md](../deploy/rpi/README.md) |
| P49 spec | [specs/p49-preprod-deployment.md](../specs/p49-preprod-deployment.md) |
| Tags | [docs/releases/README.md](./releases/README.md) |
| Deploy stages | [config/deploy/README.md](../config/deploy/README.md) |
| Multi-room | [docs/multi-room-airplay.md](./multi-room-airplay.md) |

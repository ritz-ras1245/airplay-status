# P49 — bare-metal deploy (Raspberry Pi)

**Default:** build a `linux/arm64` release on the Mac, push it over SSH, unpack on the Pi. The Pi does **not** compile, run `npm`, or clone git for updates.

Locked topology: [DECISIONS.md](../../DECISIONS.md) — Synology owns Docker; Pi host is `pi` / `pi.home.arpa`; SSH admin `rasohoni` (sudo); agent `r-bot` (no sudo).

Lessons from first compile bring-up (historical): [docs/p49-rpi-bare-metal-lessons.md](../../docs/p49-rpi-bare-metal-lessons.md)

## Fresh install / update (artifact)

On a Mac with Docker Desktop (Apple Silicon preferred — `linux/arm64` is native):

```bash
./bin/p49-build-release.sh
./bin/p49-push-release.sh rasohoni@pi.home.arpa
# or: rasohoni@pi.local
```

That scp’s `artifacts/releases/airplay-status-<tag>-linux-aarch64.tar.gz` and runs the **in-tarball** `install.sh`, which only:

1. `apt-get install` thin runtime debs (`RUNTIME_DEBS.txt` — no `-dev`, no toolchain)
2. Unpacks the app + linux-arm64 `node_modules` to `/opt/airplay-status`
3. Installs prebuilt `nqptp`, `shairport-sync`, `pixlet` to `/usr/local/bin`
4. Installs systemd units
5. Restarts **nqptp → shairport-sync → airplay-status**

`r-bot` **cannot** sudo — do not push as `r-bot@pi`.

CI can produce the same tarball: [`.github/workflows/p49-build-release.yml`](../../.github/workflows/p49-build-release.yml) (`workflow_dispatch` or annotated `v*` / `p49-*` tags).

### After install

| Item | Location |
|------|----------|
| App | `/opt/airplay-status` |
| Release identity | `/opt/airplay-status/release.env` (`GIT_COMMIT`, overwritten each push) |
| Secrets / stage | `/opt/airplay-status/.env` (preserved across pushes) |
| shairport config | `/etc/shairport-sync.conf` (kept if already present) |
| Metadata pipe | `/tmp/shairport-sync-metadata` |
| Dashboard | `http://pi.home.arpa/` (port **80**) |

```bash
ssh rasohoni@pi.home.arpa 'sudo /opt/airplay-status/bin/check-p49-beta.sh'
./bin/check-version.sh http://pi.home.arpa
```

iPhone on the same LAN: AirPlay picker should show **AirPlay Status (Beta)**. Multi-room = real speakers + AirPlay Status together.

**Tidbyt credentials:** [docs/p49-tidbyt-credentials.md](../../docs/p49-tidbyt-credentials.md)

## What the tarball contains

- Prebuilt **nqptp** `1.2.4` and **shairport-sync** `4.3.6` (AirPlay 2 + pipe metadata)
- Node app tree + **linux-arm64** production `node_modules`
- **pixlet** aarch64 (upstream GitHub release — not compiled)
- systemd units + config templates
- `RUNTIME_DEBS.txt`
- `install.sh` (runtime only — no make/cmake/npm/git)

Build recipe: [release/Dockerfile](./release/Dockerfile). Flags: [release/shairport-configure-flags.txt](./release/shairport-configure-flags.txt) (copied from the original on-Pi `install.sh`).

## Annotated tags

See [docs/releases/README.md](../../docs/releases/README.md#annotated-release-tags-p49-artifacts). Example:

```bash
git tag -a v0.1.0 -m "airplay-status 0.1.0 — P49 linux/arm64 artifact"
./bin/p49-build-release.sh --tag v0.1.0
```

## Break-glass: compile on the Pi

Only if you cannot build/push an artifact (no Mac Docker, corrupted binaries, etc.):

```bash
# On a git checkout on the Pi — 15–25 minutes, installs a compiler toolchain
sudo ./deploy/rpi/install.sh --break-glass-compile
./bin/check-p49-beta.sh
```

That path is [break-glass/install-compile-on-pi.sh](./break-glass/install-compile-on-pi.sh). Do not use it for routine updates.

## Docker on the Pi

**Not supported.** Household Docker runs on Synology. Compose files under `deploy/docker/` are Mac/smoke-only — see [deploy/docker/README-WARN.md](../docker/README-WARN.md).

## Log shipping (optional)

P50 observability — stream Pi journal logs to Grafana/Loki on Mac: [docs/p50-observability.md](../../docs/p50-observability.md).

## Persist (later)

NAS `persist/pi/airplay-status` is the intended long-term home for release blobs. v1 scripts do not require it — SSH push is enough.

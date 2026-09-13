# Deploy (P49)

**How we update:** Mac Docker buildx `linux/arm64` tarball → SSH push to a bare-metal Pi.  
See [DECISIONS.md](../DECISIONS.md) and [rpi/README.md](./rpi/README.md).

| Path | Role |
|------|------|
| [rpi/README.md](./rpi/README.md) | **Default** — artifact build + push (`rasohoni@pi.home.arpa`) |
| [rpi/release/](./rpi/release/) | buildx Dockerfile, flags, in-tarball installer |
| [rpi/break-glass/](./rpi/break-glass/) | On-Pi compile (gated) |
| [docker/README-WARN.md](./docker/README-WARN.md) | Mac/smoke only — **no Docker on the Pi** (Synology owns Docker) |

```bash
./bin/p49-build-release.sh
./bin/p49-push-release.sh rasohoni@pi.home.arpa
```

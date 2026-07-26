# P49.1 — Balena Cloud (optional fleet management)

**Status:** Documented alternative — **not** required for P49 MVP.

P49 default is **Raspberry Pi OS + systemd + SSH** ([../rpi/README.md](../rpi/README.md)). Use Balena if you want OTA updates and fleet env vars for 1–4 Pis without manual `git pull`.

## When to choose Balena

| Benefit | Tradeoff |
|---------|----------|
| OTA deploys from git | Vendor lock-in; free tier device limits |
| Fleet env vars for Tidbyt/Echo | nqptp still needs host network / privileged mode |
| Remote logs | AP2 + mDNS harder than bare systemd |

## AirPlay 2 constraints on Balena

Same as Docker Path A:

1. **nqptp** must run on the host network namespace (privileged container or host OS service)
2. **shairport-sync** needs `network_mode: host` (Balena: `network_mode: host` in compose)
3. Metadata FIFO must be on a shared host path

Balena’s host networking support varies by device type — validate on a spare Pi before committing.

## Sketch (not shipped in P49 MVP)

```yaml
# balena/docker-compose.yml (future P49.1)
version: "2.1"
services:
  shairport-sync:
    image: mikebrady/shairport-sync:latest
    network_mode: host
    restart: always
  airplay-status:
    build: .
    network_mode: host
    restart: always
    labels:
      io.balena.features.balena-api: 1
```

Host nqptp: install via Balena `install.sh` hook or separate `nqptp` service with `privileged: true`.

## Env injection

Use Balena fleet variables (never commit secrets):

- `TIDBYT_DEVICE_ID`, `TIDBYT_API_TOKEN`
- `DEPLOY_STAGE=beta`, `DEPLOY_PHASE=p49`
- `GIT_COMMIT` at release time

## Health check

```bash
curl -sf http://<device-ip>:3003/api/version
```

Full `/api/health` is P99 — use `check-version.sh` and `check-sidecar.sh` for P49.

## References

- [Balena Cloud](https://www.balena.io/cloud/)
- [P49 spec](../../specs/p49-preprod-deployment.md) — fleet section
- [Docker Path A](../docker/README.md)
- [Bare metal Path B](../rpi/README.md)

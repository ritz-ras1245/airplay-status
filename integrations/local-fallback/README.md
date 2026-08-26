# Local-service fallback gateway (P10)

A tiny, dependency-free Node gateway that fronts LAN services. It **probes** each
service's primary host on the ports you care about, **reverse-proxies** to the
primary while it's healthy, and serves a **status/fallback page** (HTTP 200, with
a live port matrix) when the primary is down — so always-on clients (P6–P9) and
browser bookmarks hit a stable URL that still answers when the Pi doesn't.

It's **generic**: declare any number of services, not just airplay-status.

See the spec: [`../../specs/p10-local-service-fallback.md`](../../specs/p10-local-service-fallback.md).

## How it works

```
client → gateway (this)  ──healthy──▶  proxy to primary
                          ──down────▶  fallback status page (200) + probe matrix
```

- `GET /_gateway/health` — gateway's own health (`{ status, uptimeSec }`).
- `GET /_gateway/services` — JSON probe matrix for every configured service.
- Any other request — routed to a service by `Host` header (`hostname`), or the
  first service for single-service setups; proxied when `up`, otherwise fallback.
- A service is `up` only when **all** its probed ports pass; `degraded` if some
  pass; `down` if none. Proxying resumes automatically after `recover_after`
  consecutive healthy probes.

## Configure

Copy the example and edit it with your LAN hosts (this file is gitignored — no
LAN IPs in git, per spec D5):

```bash
cp config/services.example.json config/services.json
```

| Field | Meaning |
|-------|---------|
| `gateway_http_port` | Port the gateway listens on (default `80` on the fallback host) |
| `services.<name>.primary_host` | Host to probe |
| `services.<name>.hostname` | Optional `Host` header to route on |
| `services.<name>.ports[]` | `{ port, check: "tcp"\|"http", path, expect_status }` |
| `services.<name>.proxy_to` | Upstream base URL used when healthy |
| `services.<name>.recover_after` | Consecutive healthy probes before proxying resumes (default 2) |

Env overrides: `SERVICES_CONFIG`, `GATEWAY_HTTP_PORT`, `PROBE_TIMEOUT_MS`, `PROBE_CACHE_MS`.

## Run

```bash
# Docker (recommended — deploy on Synology / an always-on LAN box near the eero)
docker compose up -d --build

# Or directly with Node 20+
SERVICES_CONFIG=./config/services.json node src/server.js
```

Then point DNS (AdGuard / Pi-hole / router) for your service hostname at the
gateway host so clients reach the gateway first — see the P6 DNS options and the
spec for `home.arpa` cutover. Same DNS approaches as Echo (P6).

## Test

```bash
npm test   # node --test: config validation, probe classifiers, proxy + fallback integration
```

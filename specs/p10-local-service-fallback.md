# Phase P10 — Local service fallback gateway

**Status:** Spec (idea — not Cloud-PR ready)  
**Depends on:** Deployed primary services (for airplay-status: P49 RPi beta or Mac host)  
**Used by:** P7 / P8 / P9 display clients; reusable for other LAN `.local` / `home.arpa` services  
**Layout:** Prefer standalone Docker project under `integrations/local-fallback/` (or future dedicated repo — see OD1)  
**Standard:** [cloud-cursor-pr-standard.md](./cloud-cursor-pr-standard.md) (apply when promoted to Cloud-PR ready)

## Agent pickup prompt

```
Pickup and analyse specs/p10-local-service-fallback.md.
Take it from end to end to a PR once Status is Cloud-PR ready
and Decisions (locked) are complete.

Follow specs/cloud-cursor-pr-standard.md.
```

---

## Goal

When the **primary host** (typically the RPi running airplay-status) is **not reachable** on the ports clients expect (idea callout: **`:80`**, plus whatever else we monitor), browsers and always-on clients must land on a **fallback** hosted somewhere more reliable — **Docker on the eero-adjacent always-on box** and/or **Synology**. That fallback:

1. Serves a simple “primary unavailable” / status page (and optional reverse-proxy when healthy).
2. **Probes** the primary over the configured port set.
3. Is **generic** — same pattern for airplay-status and other local services.

One concrete design: a container that **fronts local services** (DNS or reverse-proxy entrypoint) and continuously **pings / health-checks** backends so `.local` (or `home.arpa`) names stay useful even when a single Pi is down.

---

## Problem

| Failure | Client experience today |
|---------|-------------------------|
| RPi powered off / crashed | Hard fail / browser error |
| airplay-status process down but host up | Connection refused on app port |
| Only some ports dead (e.g. `:3003` vs `:80` proxy) | Ambiguous “is the house network OK?” |
| mDNS / `.local` flaky across VLANs | Clients cannot find the Pi |

Always-on clients (P7–P9) and Echo Silk bookmarks (P6) need a **stable URL** that still answers when the Pi does not.

---

## Architecture (target)

```
 Client (Android / iPad / DeskThing / browser)
        │
        │  http://airplay-status.home.arpa/   (or *.local via gateway)
        ▼
 ┌──────────────────────────────────────────┐
 │ Fallback gateway container               │
 │  host: Synology Docker  and/or  always-on│
 │        box on eero LAN                   │
 │                                          │
 │  • DNS or reverse-proxy front door       │
 │  • Health probes: host × ports           │
 │  • If healthy → proxy to primary         │
 │  • If unhealthy → status / last-known UI │
 └───────────────┬──────────────────────────┘
                 │ probe TCP/HTTP
                 ▼
        ┌─────────────────┐
        │ Primary RPi     │
        │ :80 (proxy?)    │
        │ :3003 (Node)    │
        │ other services… │
        └─────────────────┘
```

### Generic multi-service model

Config declares **services**, not one hard-coded app:

```yaml
services:
  airplay-status:
    primary_host: 192.168.1.50   # or airplay-beta.local
    ports:
      - { port: 80, check: "http", path: "/api/health" }   # if Caddy/nginx fronts Node
      - { port: 3003, check: "http", path: "/api/health" }
    proxy_to: "http://192.168.1.50:3003"
    fallback_page: "airplay-status-down.html"
  # other LAN apps…
  # grafana:
  #   primary_host: …
```

Gateway keeps last probe results and exposes:

- `GET /_gateway/health` — gateway itself
- `GET /_gateway/services` — JSON probe matrix
- Per-service vhost or path-based routing

---

## Decisions (locked from idea)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Generic multi-service gateway**, not airplay-status-only | User: “generic behaviour for all local services” |
| D2 | **Fallback hosted off-Pi** (Synology Docker and/or always-on LAN box near eero) | Survives Pi death |
| D3 | **Probe all configured ports** for each service | User: ping RPi over ports we care about |
| D4 | **Clients use the gateway URL as the stable entrypoint** when P10 is enabled | Always-on shells (P7–P9) point here |
| D5 | **No secrets in git** — LAN IPs/hostnames in local config / compose override | Project rule |

---

## Open decisions

| ID | Question | Options | Notes |
|----|----------|---------|-------|
| **OD1** | Home for the code | A) `integrations/local-fallback/` in this repo · B) new `local-service-gateway` repo | B better if many non-airplay services; A faster to start |
| **OD2** | Front-door mechanism | A) Reverse proxy (Caddy/Traefik/nginx) + active health · B) DNS only (AdGuard rewrite flips IP) · C) Both: DNS → gateway IP always; gateway proxies or serves fallback | User lean: “all `.local` calls go via this container” → **C** |
| **OD3** | Name system | A) `home.arpa` via AdGuard/Pi-hole · B) mDNS responder in gateway · C) static IPs / `/etc/hosts` | Echo already prefers `home.arpa` (P6) |
| **OD4** | Where Docker runs | Synology · mini PC on eero · both with identical compose | Pick primary for MVP |
| **OD5** | airplay-status `:80` | Introduce Caddy on Pi mapping `:80` → `:3003`, or treat `:3003` as canonical and probe that | Clarify house convention before locking probes |
| **OD6** | Fallback UX depth | A) Static “RPi down + probe table” · B) Cached last now-playing snapshot · C) Redirect to read-only mirror | A sufficient for MVP |

Mark **DECISION REQUIRED** on OD1, OD2, OD4, OD5 before Cloud-PR ready.

---

## Configuration

| Key / file | Required | Description |
|------------|----------|-------------|
| `config/services.yaml` (name TBD) | Yes | Service list, hosts, ports, check type, proxy target |
| `GATEWAY_HTTP_PORT` | No | Default `80` on the fallback host |
| Compose `ports` / `network_mode` | Yes | LAN reachability; host networking may be required for some mDNS designs |

Example probe types: `tcp`, `http` (GET path + expect 2xx), optional `icmp` (often blocked in containers — prefer TCP/HTTP).

---

## Repository layout (proposed)

| Path | Purpose |
|------|---------|
| `integrations/local-fallback/README.md` | Deploy on Synology / always-on host; DNS cutover |
| `integrations/local-fallback/docker-compose.yml` | Gateway + optional Caddy |
| `integrations/local-fallback/config/services.example.yaml` | Template services |
| `integrations/local-fallback/src/` or Caddyfile + small health worker | Probe loop + status pages |
| `integrations/local-fallback/public/status.html` | Generic down page with live probe JSON |
| `docs/local-service-fallback.md` | House runbook (optional) |
| `specs/p10-local-service-fallback.md` | This spec |

---

## Behaviour

### Healthy primary

- Gateway reverse-proxies to `proxy_to` (or returns DNS that still points at gateway which proxies).
- Clients experience normal airplay-status UI.

### Unhealthy primary

- Gateway stops proxying (or proxies only healthy ports).
- Serves fallback page showing:
  - Service name
  - Each port: up/down, last latency, last checked
  - Hint: “RPi unreachable — check power / Ethernet”
- Always-on clients (P7–P9) remain “alive” (HTTP 200 from gateway) instead of WebView hard-failing.

### Recovery

- When probes succeed again N times (default 2–3), resume proxy automatically.
- Optional short sticky banner “primary recovered”.

---

## Implementation steps (when Cloud-PR ready)

1. Lock OD1–OD2–OD5; scaffold compose + example `services.yaml`
2. Implement probe worker + `/_gateway/services` JSON
3. Implement reverse proxy path + static fallback page
4. Document Synology Docker deploy + AdGuard/`home.arpa` pointing at gateway
5. Document eero: custom DNS → AdGuard/Synology (same as P6 DNS options)
6. Add CI tests for probe matrix parsing (no real Pi required)
7. Cross-link P7–P9 `FALLBACK_URL` / stable entrypoint docs
8. Update `AGENTS.md` phase table

---

## Automated tests

| Test | Notes |
|------|-------|
| Parse services config | Valid / invalid YAML |
| Probe classifier | Mock TCP/HTTP success/fail → healthy vs fallback |
| HTTP: unhealthy backend → fallback HTML 200 | Testcontainers or mocked upstream |
| HTTP: healthy backend → proxied body | Same |

---

## Acceptance criteria

- [ ] `(automated)` Config with two ports; one down → service marked degraded/unhealthy per rules
- [ ] `(automated)` Unhealthy → gateway returns fallback page (not connection error)
- [ ] `(automated)` Healthy → proxy returns upstream body
- [ ] `(manual)` Compose up on Synology or always-on LAN host
- [ ] `(manual)` Point `airplay-status.home.arpa` (or test name) at gateway
- [ ] `(manual)` Stop Node / unplug Pi → clients see probe table within probe interval
- [ ] `(manual)` Restore Pi → automatic proxy resume
- [ ] `(manual)` Second dummy service in config proves generic path

---

## Out of scope (P10)

- Cloudflare tunnel / off-LAN access (see P5)
- Replacing P49 Pi deploy itself
- High-availability clustering of the gateway (single always-on box is enough)
- Authoritative DNS server replacement beyond “point records at gateway”

---

## Relationship to other phases

| Phase | Interaction |
|-------|-------------|
| **P5 / P49** | Primary still runs on Pi; P10 is the stable front door |
| **P6 Echo** | `ECHO_DISPLAY_URL` can target gateway hostname so Silk never hits a dead Pi IP directly |
| **P7–P9** | Always-on shells use gateway as `DISPLAY_URL` / `FALLBACK_URL` |
| **P50 / P99** | Gateway health can later ship logs to Loki; not required for idea MVP |

---

## PR body template (copy into PR)

```markdown
## Summary
- P10 local service fallback gateway (`integrations/local-fallback/`)

## Automated verification
- [ ] Config + probe unit/integration tests pass

## Manual setup & test (complete before merge)
- [ ] Deploy compose on Synology or always-on LAN host
- [ ] DNS / home.arpa → gateway
- [ ] Kill airplay-status / disconnect Pi → fallback page + port matrix
- [ ] Restore → proxy resumes
- [ ] Optional second service entry proves genericity
- [ ] Point one P7/P8/P9 client at gateway URL

## Spec
- specs/p10-local-service-fallback.md
```

---

## References

- P6 DNS options (eero / Synology / AdGuard): [p6-echo-show.md](./p6-echo-show.md)
- P5 deployment platforms: [p5-deployment.md](./p5-deployment.md)
- Always-on clients: [guidelines/always-on-display-client.md](./guidelines/always-on-display-client.md)

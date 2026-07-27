# Phase P50 — Beta soak + observability

**Status:** In progress (P49 beta live; observability stack on branch)  
**Depends on:** P49 beta deployed and validated ✅  
**Precedes:** P99 production readiness  
**Related:** [p49-preprod-deployment.md](./p49-preprod-deployment.md), [docs/p50-observability.md](../docs/p50-observability.md)

## Goal

Run the **working P49 beta** on RPi4 through a **soak period** (24h–1wk+) without feature churn on the Pi, while **shipping logs to Mac Grafana/Loki** so incidents can be debugged by timestamp when the operator is away (Slack → `@cursor error at …` → log pull).

P50 is **ops + observation**, not new product features. Feature work (P1–P6) continues on Mac / cloud agents in parallel.

---

## Pipeline position (line 1)

```
P49 deploy + sign-off  →  P50 soak + observability  →  P99 prod readiness  →  P100 release 1.0.0
```

| Phase | Pi | Mac |
|-------|-----|-----|
| **P49** | Bare-metal AP2 beta live | Dev + optional Docker smoke |
| **P50** | **Leave running** — no deploy churn unless blocker | Loki + Grafana Docker; Pi Promtail → Mac |
| **P99** | Structured logs, SOPs, health, persistence polish | Same stack hardened |

---

## Deliverables

| Path | Purpose |
|------|---------|
| `config/observability/docker-compose.yml` | Mac: Loki + Grafana (+ optional Mac Promtail) |
| `config/observability/loki-config.yml` | 45-day retention, LAN push |
| `config/observability/promtail-pi.example.yml` | Pi journal scrape (airplay stack units) |
| `deploy/rpi/promtail/install-promtail.sh` | One-shot Pi install (additive) |
| `bin/observability-up.sh` / `observability-down.sh` | Mac stack lifecycle |
| `bin/query-loki.sh` | Agent CLI: logs by timestamp |
| `docs/p50-observability.md` | Setup, Slack workflow, agent checklist |

**Out of scope for P50:** Prometheus, full `src/lib/logger.js`, launchd/SOP docs (P99).

---

## Soak rules

- **Do not** redeploy Pi or change `deploy/rpi/install.sh` unless **beta blocker**
- **Do not** reset Tidbyt creds or SSH keys on Pi during soak
- **Do** keep Mac observability stack running when Pi is active (Docker)
- **Do** install Promtail on Pi once Mac Loki is reachable on LAN

Optional: set `DEPLOY_PHASE=p50` in Pi `.env` during soak (`GET /api/version`).

---

## Sign-off checklist

- [ ] Mac `./bin/observability-up.sh` — Grafana http://localhost:3030 shows **AirPlay Status Logs**
- [ ] Pi Promtail installed — `systemctl status promtail` active
- [ ] Grafana shows `{host="airplay-beta"}` lines from all three units within 15m
- [ ] `./bin/query-loki.sh --around '<recent-iso>' --window 5m` returns lines on Mac
- [ ] 24h+ soak with no beta blockers (human)
- [ ] Tidbyt + multi-room still OK (spot check)

After sign-off → **P99**.

---

## Slack → Cursor workflow

Documented in [docs/p50-observability.md](../docs/p50-observability.md): user posts timestamp; agent runs `query-loki.sh` or Grafana Explore when back online.

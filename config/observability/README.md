# Observability stack (P50)

Mac Docker: **Loki + Grafana**. Pi **Promtail** pushes journal logs over LAN.

**Setup:** [docs/p50-observability.md](../../docs/p50-observability.md)  
**Spec:** [specs/p50-beta-soak-observability.md](../../specs/p50-beta-soak-observability.md)

```bash
./bin/observability-up.sh      # from repo root
./bin/observability-down.sh
./bin/query-loki.sh --around '2026-07-27T03:15:00Z' --window 10m
```

Copy `observability.env.example` → `observability.env` (gitignored) before first run.

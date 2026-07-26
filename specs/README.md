# Spec phase numbering

All phase specs live in `specs/p*.md`. Numbering is intentional and permanent.

## Iteration 1 (current)

| Range | Meaning |
|-------|---------|
| **P0** | Foundation — live dashboard (complete) |
| **P1–P98** | Feature phases — integrations, controls, displays, deployment guides, etc. |
| **P99** | **Production readiness** — implement **last** (see scope below) |

## Iteration 2 (future)

| Range | Meaning |
|-------|---------|
| **P100–P998** | Iteration 2 features |
| **P999** | Iteration 2 production readiness (same scope as P99) |

Do not renumber iteration 1 specs when starting iteration 2.

## Production readiness — canonical scope (P99 / P999)

**Do not call this “P0 hardening”.** In any spec or doc, **hardening** and **prod readiness** mean the same bundle:

1. **Persistence** — install script, launchd/systemd, boot/start
2. **Logs** — structured always-on logging, prod log paths
3. **Observability** — optional self-hosted Grafana + Loki (not SaaS)
4. **SOPs** — `docs/sop/debugging-humans.md` + `docs/sop/debugging-agents.md`
5. **Health & runbooks** — `/api/health`, `check-sidecar.sh`, prod troubleshooting docs

Full spec: [p99-prod-readiness.md](./p99-prod-readiness.md). Deep metadata debug (`--debug`) stays dev-only per [debug-capture.md](../docs/debug-capture.md).

## Sub-phases

Decimal-style suffixes in prose only (not filenames): **P3.1** device profiles in `p3-eink-display.md`. File remains `p3-eink-display.md`.

## Index

| Spec | Phase |
|------|-------|
| [p0-airplay-status.md](./p0-airplay-status.md) | P0 — dashboard |
| [p1-remote-control.md](./p1-remote-control.md) | P1 |
| [p2-tidbyt.md](./p2-tidbyt.md) | P2 |
| [p3-eink-display.md](./p3-eink-display.md) | P3 |
| [p4-eink-controls.md](./p4-eink-controls.md) | P4 |
| [p5-deployment.md](./p5-deployment.md) | P5 |
| [p99-prod-readiness.md](./p99-prod-readiness.md) | P99 — prod readiness |

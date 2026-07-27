# Phase P99 — Production Readiness

**Status:** Spec (pre-implementation)  
**Depends on:** Feature phases you intend to ship (minimum: P0 live dashboard ✅)  
**Iteration:** 1 — run **after P49 beta sign-off**, **before P100** release (`1.0.0`)

## Goal

Make airplay-status **reliable for daily home use** without manual terminal sessions: install once, start on boot/login, recover from crashes, **centralize logs**, optional **Grafana** visibility, and **SOPs** so humans and AI agents debug the same way every time.

This is **not** new product functionality — it is ops polish for whatever features exist at ship time.

## Relationship to other phases

| Phase | Scope |
|-------|--------|
| **P0–P98** | Iteration 1 features (dashboard, Tidbyt, Echo, eInk, …) |
| **P99** (this) | Iteration 1 **prod readiness** — persistence, logs, Grafana, SOPs |
| **P5** | Cross-platform **deployment guide** (Pi, Docker, Synology) — platform how-to |

P5 answers *“how do I run this on a Pi?”* P99 answers *“how do I operate and debug it in production?”*

Existing **debug capture** ([docs/debug-capture.md](../docs/debug-capture.md)) remains the **deep-dive dev tool** (`--debug`). P99 adds always-on prod logging + operator SOPs without requiring debug mode 24/7.

---

## Deliverables

### 1. Install script (`bin/install.sh`)

One-shot setup beyond `setup-sidecar.sh`:

- Verify Node 20+, Homebrew (macOS), shairport-sync
- Run `setup-sidecar.sh` if needed
- Copy example config if missing
- `npm install`
- Print next steps (enable launchd, log dir, optional Grafana, open dashboard URL)

Idempotent — safe to re-run.

### 2. macOS launchd (`config/launchd/`)

| Plist | Role |
|-------|------|
| `com.airplay-status.shairport.plist` | Keep shairport-sync running |
| `com.airplay-status.node.plist` | Keep Node dashboard running |

- Use `run-shairport.sh` / `npm start` with `WorkingDirectory` set to install path
- `KeepAlive` + sensible `ThrottleInterval`
- **Stdout/stderr** → `~/Library/Logs/airplay-status/` (not repo)

Document load/unload commands in `docs/prod-macos.md`.

### 3. Structured logging

**Always-on** (no `--debug` required for baseline ops logs):

| Requirement | Detail |
|-------------|--------|
| Format | Single-line; prefix `[component]` — e.g. `[meta]`, `[tidbyt]`, `[echo]`, `[http]` |
| Timestamps | ISO-8601 on every line |
| Levels | `info`, `warn`, `error` (env `LOG_LEVEL`, default `info`) |
| Secrets | Never log tokens, webhook secrets, or full `.env` |
| Correlation | Optional `requestId` on HTTP; playback events log `title` truncated if needed |

**Debug mode unchanged:** `METADATA_DEBUG=1` / `--debug` adds verbose metadata + test markers per [debug-capture.md](../docs/debug-capture.md).

**Log files (prod):**

| File | Source |
|------|--------|
| `~/Library/Logs/airplay-status/node.log` | Express + services (launchd) |
| `~/Library/Logs/airplay-status/shairport.log` | shairport-sync stderr |
| `/tmp/airplay-status-debug.log` | Debug runs only (`--debug`) |

Implement `src/lib/logger.js` — thin wrapper used by services; no heavy deps required for MVP.

### 4. Grafana + Loki (optional stack, spec’d for home lab)

**P50** delivers the MVP stack (Pi Promtail → Mac Loki/Grafana) — see [p50-beta-soak-observability.md](./p50-beta-soak-observability.md). **P99** completes structured logging, SOPs, and dashboard polish.

Self-hosted observability — **not** Grafana Cloud / SaaS.

```
┌─────────────┐     tail      ┌──────────┐     ┌──────────┐
│ node.log    │ ────────────► │ Promtail │ ──► │   Loki   │
│ shairport   │               └──────────┘     └────┬─────┘
└─────────────┘                                      │
                                                     ▼
                                              ┌──────────┐
                                              │ Grafana  │
                                              │ :3000    │
                                              └──────────┘
```

**Deliver:**

| Path | Purpose |
|------|---------|
| `config/observability/docker-compose.yml` | Loki + Grafana + Promtail (pinned images) |
| `config/observability/promtail-config.yml` | Scrape `~/Library/Logs/airplay-status/*.log` (macOS) |
| `config/observability/grafana/dashboards/airplay-status.json` | Panels: log volume by component, errors, Tidbyt/Echo push outcomes |
| `bin/observability-up.sh` | `docker compose up -d` with env for log path |
| `docs/prod-grafana.md` | First login, datasource, import dashboard |

**MVP dashboard panels:**

- Log stream filtered `[meta]`, `[tidbyt]`, `[echo]`
- Error rate (`level=error` or grep `error`)
- Tidbyt push success/fail (from log lines)
- Echo webhook success/fail (P6+)
- Optional: scrape `GET /api/health` via Prometheus if added later — defer Prometheus to P99 stretch

**Default ports:** Grafana `3000` (document conflict with other apps). Loki internal only.

**Pi / P5:** Document alternate log paths in `promtail-config.yml` example for `/var/log/airplay-status/`.

### 5. Health check

- `GET /api/version` → `{ name, version, gitCommit, deployPhase, deployHost, node }` — **implemented**; see [versioning.md](../docs/versioning.md)
- `GET /api/health` → `{ ok, shairport, uptimeSec, version, … }` (P99)
- `bin/check-version.sh http://<host>:3003` for deploy verification
- `bin/check-sidecar.sh` remains quick CLI probe; SOP references both

### 5b. Pi secrets UX (Tidbyt — deferred from P49)

P49 ships one-time `/setup?token=…` upload but the token is only visible via install output or SSH ([docs/p49-tidbyt-credentials.md](../docs/p49-tidbyt-credentials.md) — **Known limitation**).

**P99 deliverable:** When `.setup-token` exists, dashboard shows LAN-only setup URL (e.g. banner + QR on `/` or `/setup`) so iPhone file upload needs no Mac/SSH. Power-loss already OK (token persists on disk until upload).

### 6. Troubleshooting runbook (`docs/prod-troubleshooting.md`)

Symptom → cause → fix (link to SOPs):

- AirPlay receiver not in list → mDNS, shairport not running
- Dashboard empty → pipe missing, wrong output selected
- Stale “playing” after stop → debug capture SOP
- Port 3003 in use
- Tidbyt / Echo push silent → check logs + integration env
- After macOS update / sleep

### 7. SOPs — humans and agents

Two documents + index. Agents and humans follow the **same sequence**; agents automate log reads.

| Doc | Audience | Purpose |
|-----|----------|---------|
| `docs/sop/README.md` | Both | Index; when to use which SOP |
| `docs/sop/debugging-humans.md` | Human operators | Step-by-step: reproduce → collect logs → interpret |
| `docs/sop/debugging-agents.md` | Cursor / Cloud agents | Machine checklist; grep patterns; no guessing without log evidence |

**`docs/sop/debugging-humans.md` must include:**

1. **Quick triage** — `./bin/check-sidecar.sh`, `/api/health`, is music playing to **AirPlay Status**?
2. **Standard repro** — numbered steps; use `/debug` test markers when metadata/state is wrong
3. **Prod log collection** — where files live; `tail -f ~/Library/Logs/airplay-status/node.log`
4. **Grafana** — open dashboard, filter `[meta]`, time range last 15m
5. **Escalation** — when to restart launchd vs full `./bin/run-local.sh --debug` session
6. **Integration-specific** — Tidbyt pixlet/creds; Echo webhook/Lambda (link P6 docs)

**`docs/sop/debugging-agents.md` must include:**

1. **Before asking user to reproduce** — enable logging path; confirm `--debug` if metadata FSM
2. **Test markers** — `POST /api/debug/mark` or UI buttons; user says **done** → read log
3. **Grep recipes** (copy-paste):

```bash
grep -a -E "TEST MARK|state |error|pend|aend|\[tidbyt\]|\[echo\]" /tmp/airplay-status-debug.log
tail -100 ~/Library/Logs/airplay-status/node.log
```

4. **Rules** — do not infer pause/disconnect from one field; align marks with events (see event-log-capture skill)
5. **Grafana** — if user has stack up, note time range + panel; otherwise use file logs
6. **Output format** — timeline table: time | mark/action | log evidence | conclusion

Link SOPs from `AGENTS.md`, `README.md`, and `docs/debug-capture.md`.

---

## File structure (planned)

```
bin/
├── install.sh
└── observability-up.sh
config/
├── launchd/
│   ├── com.airplay-status.node.plist
│   └── com.airplay-status.shairport.plist
└── observability/
    ├── docker-compose.yml
    ├── promtail-config.yml
    └── grafana/dashboards/airplay-status.json
docs/
├── prod-macos.md
├── prod-grafana.md
├── prod-troubleshooting.md
└── sop/
    ├── README.md
    ├── debugging-humans.md
    └── debugging-agents.md
src/lib/
└── logger.js
```

---

## Out of scope (P99)

- Hosted observability SaaS (Datadog, Grafana Cloud paid tiers)
- Raspberry Pi systemd units (defer to P5 + P999 addendum)
- Full Prometheus + alerting rules (stretch only)
- CI/CD release pipeline
- On-call paging

---

## Acceptance criteria

- [ ] `./bin/install.sh` completes on clean macOS with Homebrew
- [ ] launchd plists load; receiver + dashboard survive reboot
- [ ] Prod logs written to `~/Library/Logs/airplay-status/` with `[component]` prefixes
- [ ] `GET /api/health` returns structured JSON
- [ ] `docs/sop/debugging-humans.md` + `docs/sop/debugging-agents.md` + index exist and cross-link debug capture
- [ ] `docs/prod-troubleshooting.md` linked from README
- [ ] `(optional)` `bin/observability-up.sh` brings up Grafana; dashboard shows live logs from node
- [ ] `(Pi)` Pending Tidbyt setup: dashboard shows setup URL or QR (no SSH to read token)
- [ ] No secrets in repo or committed log examples

---

## When to implement

**Last** in iteration 1 — after the feature set you care about is merged (e.g. P2 Tidbyt + P6 Echo tested). Re-run P99 checklist when adding major integrations (new sidecars, webhooks).

---

## References

- [p0-airplay-status.md](./p0-airplay-status.md) — core dashboard (done)
- [p5-deployment.md](./p5-deployment.md) — Pi/Docker deployment
- [debug-capture.md](../docs/debug-capture.md) — deep metadata debug
- `bin/check-sidecar.sh`, `bin/run-local.sh`
- Event-log-capture skill — test marker workflow for agents

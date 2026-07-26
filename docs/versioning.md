# airplay-status — semver & API reference

**Global RVS** (phases, GitHub/Jira/ClickUp, patches): Cursor rule `~/.cursor/rules/release-and-versioning.mdc` — not in this repo.  
**This file:** project-specific semver, deploy env, and `/api/version`.

---

## This repo today

| Item | Value |
|------|-------|
| Semver | **`0.1.0`** (pre-**P100**) |
| Next prod gate | **P100** → **`1.0.0`** |
| Current milestone | **P49** — RPi4 beta (AirPlay 2) |
| API | **`GET /api/version`** |
| CLI | **`./bin/check-version.sh http://<host>:3003`** |

---

## Phase ↔ semver (summary)

| Gate | Readiness | Ship |
|------|-----------|------|
| **P100** | **P99** | **1.0.0** |
| **P200** | **P199** | **2.0.0** |
| Patches | — | **1.0.x** on **`release/1.x`** |

Full phase index: [specs/README.md](../specs/README.md).

---

## Deploy env (optional)

| Variable | Example |
|----------|---------|
| `DEPLOY_PHASE` | `p49`, `p99`, `p100`, `release-1.0.x` |
| `GIT_COMMIT` | short sha |
| `DEPLOY_HOST` | hostname label (no secrets) |

---

## Related

- [specs/p49-preprod-deployment.md](../specs/p49-preprod-deployment.md) — **next: RPi beta**
- [specs/p99-prod-readiness.md](../specs/p99-prod-readiness.md)
- [docs/releases/README.md](./releases/README.md) — ship records at P100+

# Spec phase numbering

All phase specs live in `specs/p*.md`. Numbering is intentional and permanent.

## Release lines vs phases

| Concept | Meaning |
|---------|---------|
| **P100, P200, P300…** | **Release gates** — ship **1.0.0**, **2.0.0**, **3.0.0** to prod |
| **P99, P199, P299…** | **Prod-readiness** work for the **next** hundred milestone |
| **P49, P149, P249…** | **Beta / pre-prod** on real hardware before prod-readiness |
| **P0–P48, P101–P148…** | Features (Mac dev with documented caveats) |

**Semver ↔ phases:** [docs/versioning.md](../docs/versioning.md) (this repo) · global RVS: `~/.cursor/rules/release-and-versioning.mdc`

| Release gate | Prod readiness | Semver shipped |
|--------------|----------------|----------------|
| **P100** | **P99** | **1.0.0** (patches **1.0.x**) |
| **P200** | **P199** | **2.0.0** (patches **2.0.x**) |
| **P300** | **P299** | **3.0.0** (patches **3.0.x**) |

**Current repo:** building towards **P100** → semver **0.y.z** (now **0.1.0**). **Next milestone: P49** (RPi4 beta). Patches on shipped prod use **`release/N.x`** — see global RVS (Cursor rule `~/.cursor/rules/release-and-versioning.mdc`).

---

## Formula (line N ≥ 1)

| Step | Phase |
|------|-------|
| Features | N=1: **P0–P48**; N≥2: **P((N−1)×100+1)–P((N−1)×100+48)** |
| Beta | **P((N−1)×100+49)** |
| Prod readiness | **P((N−1)×100+99)** |
| **Release** | **P(N×100)** → **N.0.0** |

Iteration 1 uses **P49** for beta+pre-prod combined (no P149).

---

## Pipelines

**Line 1 (now):** Mac dev → **P49** beta (RPi4) → **P50** soak + observability → **P99** → **P100** release `1.0.0`

**Line 2+:** Mac dev → **P149** beta → **P199** → **P200** release `2.0.0`

**Patches:** ad-hoc on **`release/1.x`** as `1.0.1`, `1.0.2` while `main` continues `2.0.0-dev`.

---

## Production readiness (P99 / P199 / P299)

Same scope every line — see [p99-prod-readiness.md](./p99-prod-readiness.md) (P99 template; P199/P299 reuse scope at their line):

Persistence, logs, Grafana/Loki optional, SOPs, `/api/health`, `/api/version`, runbooks.

Do **not** call this “P0 hardening”.

---

## Runtime versioning

**This repo:** [docs/versioning.md](../docs/versioning.md) + **`GET /api/version`**. Global field naming: `~/.cursor/rules/release-and-versioning.mdc`.

Record `version` + `gitCommit` at P49 / P99 / P100 and every patch deploy.

---

## Optional guideline

[guidelines/mac-dev-linux-beta.md](./guidelines/mac-dev-linux-beta.md) — Mac dev when beta needs Linux/Pi.

---

## Index

| Spec | Phase |
|------|-------|
| [p0-airplay-status.md](./p0-airplay-status.md) | P0 |
| [p1-remote-control.md](./p1-remote-control.md) – [p5-deployment.md](./p5-deployment.md) | P1–P5 features |
| [p6-echo-show.md](./p6-echo-show.md) | P6 — Echo Show Tier B |
| [p7-android-always-on.md](./p7-android-always-on.md) | P7 — Android always-on WebView (authored; device-test pending) |
| [p8-deskthing-carthing.md](./p8-deskthing-carthing.md) | P8 — DeskThing / Car Thing (authored; device-test pending) |
| [p9-ipad-always-on.md](./p9-ipad-always-on.md) | P9 — iPad fallback client (web MVP) |
| [p10-local-service-fallback.md](./p10-local-service-fallback.md) | P10 — local service fallback gateway (MVP) |
| [p49-preprod-deployment.md](./p49-preprod-deployment.md) | P49 — line 1 beta |
| [p50-beta-soak-observability.md](./p50-beta-soak-observability.md) | P50 — soak + Mac Grafana/Loki |
| [p99-prod-readiness.md](./p99-prod-readiness.md) | P99 — line 1 prod readiness |
| *(future)* | P149, P199, P100 release checklist |
| [guidelines/always-on-display-client.md](./guidelines/always-on-display-client.md) | Shared P7–P9 client rules |
| [guidelines/mac-dev-linux-beta.md](./guidelines/mac-dev-linux-beta.md) | Cross-project |
| [../docs/versioning.md](../docs/versioning.md) | Semver + API (this repo) |

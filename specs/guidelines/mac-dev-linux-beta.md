# Guideline — Mac dev, Linux/Pi beta (optional)

When **Mac dev cannot reproduce beta/prod behavior**, use this pipeline. Global RVS: `~/.cursor/rules/release-and-versioning.mdc`.

---

## Release lines

| Gate | Prod readiness | Semver |
|------|----------------|--------|
| **P100** | **P99** | **1.0.0** → patches **1.0.x** |
| **P200** | **P199** | **2.0.0** → patches **2.0.x** |
| **P300** | **P299** | **3.0.0** → patches **3.0.x** |

**P199 is prod-readiness for line 2** (ships **2.0.0** at P200), not semver 1.1.

---

## Line 1 pipeline (airplay-status)

| Step | Phase | Semver (typical) |
|------|-------|------------------|
| Dev | Mac AP1 | **0.y.z** |
| Beta | **P49** RPi4 | **0.y.z** |
| Prod readiness | **P99** | **0.9.z** → ready for **1.0.0** |
| Release | **P100** | **1.0.0** tag |
| Patch prod while building v2 | **`release/1.x`** | **1.0.1**, **1.0.2** |
| Next line dev | `main` | **2.0.0-dev** |

---

## Patch rule

After **P100**, create **`release/1.x`**. Urgent prod fixes cherry-pick there; **`main` keeps moving toward P200**. Same for **`release/2.x`** after P200.

---

## Dev tier

Document caveats; don’t block merges on beta-only tests; use `/api/version` on every deploy.

See [p49-preprod-deployment.md](../p49-preprod-deployment.md), [p99-prod-readiness.md](../p99-prod-readiness.md).

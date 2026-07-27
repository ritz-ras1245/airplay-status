# P49 beta — remote deploy plan

**Branch:** `doc/ritz-ras1245/p49-release` (plan + scaffolds)  
**Implementation branch:** `feat/ritz-ras1245/p49-rpi-beta` (cloud agent → PR)  
**Spec:** [specs/p49-preprod-deployment.md](../specs/p49-preprod-deployment.md)

One SD flash on the Pi, then headless remote deploys forever via **SSH + git + systemd**. Balena/fleet deferred to P49.1+.

---

## GitHub Free tier — all planned features allowed

`ritz-ras1245/airplay-status` is a **public** repository. Every GitHub feature in this plan is available on the **GitHub Free** personal plan at no extra cost.

| Planned use | Free tier | Notes |
|-------------|-----------|-------|
| GitHub Actions (PR CI, deploy workflow) | **Yes — unlimited minutes** on standard `ubuntu-latest` runners for public repos | [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |
| `workflow_dispatch` (manual deploy) | **Yes** | Manual trigger while learning the Pi |
| Push / tag triggers (later) | **Yes** | Automate after beta checklist is green |
| Repository secrets | **Yes** | e.g. `P49_SSH_PRIVATE_KEY`, `P49_HOST` |
| Environment `beta` + env secrets | **Yes** | [Environments on all plans](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment); optional approval rules on public repos |
| SSH deploy from Actions | **Yes** | Standard `ssh` / `appleboy/ssh-action` pattern; no paid add-on |
| Read-only deploy key on Pi | **Yes** | Clone/fetch from Pi without personal SSH key |
| Branch policy CI (existing) | **Yes** | `.github/workflows/branch-policy.yml` |
| Artifact storage (~500 MB shared) | **Yes** | We do not rely on large artifacts for P49 |
| Protected `main` / rulesets | **Yes** | Basic protection on free personal accounts |

**Not required for P49 (no GitHub tier impact):**

- Self-hosted runner on the Pi — health checks run over SSH from `ubuntu-latest`, not on-device
- Balena Cloud — separate vendor free tier; deferred
- GitHub Enterprise deployment features — not in scope

**If the repo were private:** 2,000 Actions minutes/month on Free would still cover occasional manual deploys; public repo avoids that cap entirely.

---

## Target architecture

```text
Mac dev (AP1, mock, features)
        │
        │  merge P49 PR → main
        ▼
GitHub Actions ──SSH──► RPi4 (headless, SD stays in)
        │
        └── git fetch + checkout SHA
            render beta .env + shairport config
            systemd restart (nqptp → shairport-sync → airplay-status)
            health: GET /api/version + check-sidecar
```

**On the Pi (real stack):** nqptp, shairport-sync AP2, metadata pipe, mDNS/AirPlay.  
**On Mac (dev only):** mock dashboard, AP1 sidecar, feature iteration.

---

## Phase 0 — One-time SD flash (~30 min, human)

Do once; do not remove the SD card for routine updates.

| Step | Action |
|------|--------|
| 1 | Flash **Raspberry Pi OS 64-bit Lite** |
| 2 | Enable **SSH**; create user; Wi‑Fi or Ethernet (**Ethernet preferred** for mDNS) |
| 3 | Static IP or reliable hostname (e.g. `airplay-beta.local`) |
| 4 | Clone repo; checkout `feat/ritz-ras1245/p49-rpi-beta` (or `main` after P49 PR merges) |
| 5 | Run [`deploy/rpi/install.sh`](../deploy/rpi/install.sh) — **scaffold until cloud PR**; see [deploy/rpi/README.md](../deploy/rpi/README.md) for manual bootstrap |
| 6 | `cp config/deploy/beta.env.example .env` → `./bin/render-shairport-config.sh --stage beta` |
| 7 | Enable systemd: `nqptp`, `shairport-sync`, `airplay-status` |
| 8 | From Mac: `./bin/check-version.sh http://<pi>:3003` → `deployStage=beta`, `deployPhase=p49` |
| 9 | iPhone beta checklist — HomePods + **AirPlay Status (Beta)** together |

Full first-boot SOP: [deploy/rpi/README.md](../deploy/rpi/README.md).

---

## Phase 1 — Every deploy after that (remote, headless)

**Default MVP:** SSH + git + systemd (not Balena).

| Step | Action |
|------|--------|
| 1 | Trigger [`.github/workflows/p49-deploy-beta.yml`](../.github/workflows/p49-deploy-beta.yml) (`workflow_dispatch`) or run [`bin/p49-deploy.sh`](../bin/p49-deploy.sh) from Mac |
| 2 | On Pi: `git fetch && git checkout <sha> && npm ci` |
| 3 | Re-render config if stage/env changed |
| 4 | `systemctl restart` in order: nqptp → shairport-sync → airplay-status |
| 5 | Health: `/api/version`, `./bin/check-sidecar.sh` |
| 6 | On failure: do not update last-good SHA on Pi |

**Secrets:** SSH deploy key in GitHub Actions secrets; `.env` on Pi only (Tidbyt, Echo, etc.) — never committed.

### Deploy triggers (pick one to start)

| Trigger | When |
|---------|------|
| **Manual `workflow_dispatch`** | **Start here** — safest while learning the Pi |
| Push to `main` after P49 merge | Every merge to beta |
| Tag `beta-*` | Explicit beta releases |

---

## Beta today, prod later — same Pi tier

| Stage | Env file | AirPlay name | When |
|-------|----------|--------------|------|
| **beta** | `config/deploy/beta.env.example` | AirPlay Status **(Beta)** | Now — P49 sign-off |
| **prod** | `config/deploy/prod.env.example` | AirPlay Status | After P99 |

Same deploy script, different `--stage`. Do **not** run beta and prod on one Pi at once — switch stage on redeploy or use a second Pi for prod.

---

## Scaffold vs cloud agent deliverables

This branch **scaffolds** paths the cloud agent is building on `feat/ritz-ras1245/p49-rpi-beta`. Stubs exit with a clear message until the implementation PR merges.

| Path | Status on this branch | Cloud agent replaces with |
|------|----------------------|---------------------------|
| `deploy/rpi/install.sh` | Scaffold | Idempotent apt + nqptp/shairport build |
| `deploy/rpi/systemd/*.service` | Scaffold | Production units |
| `deploy/rpi/README.md` | **Phase 0 SOP** (usable now) | Merge cloud agent first-boot details |
| `deploy/docker/*` | Scaffold | Docker spike (Path A) |
| `docs/p49-docker-spike.md` | Scaffold template | Spike results |
| `bin/p49-deploy.sh` | Scaffold | SSH remote deploy + health gate |
| `bin/p49-install-rpi.sh` | Scaffold | Optional Mac bootstrap helper |
| `bin/p49-up.sh` / `p49-down.sh` | Scaffold | Docker compose helpers |
| `.github/workflows/p49-deploy-beta.yml` | Scaffold workflow | Wire secrets after Pi SSH works |

After the cloud agent PR merges to `main`, re-run Phase 0 step 4–7 if `install.sh` was scaffold-only, then use Phase 1 for all updates.

---

## GitHub setup (once Pi SSH works)

1. Generate deploy key pair; add **public** key to Pi `~/.ssh/authorized_keys`; store **private** key as repo secret `P49_SSH_PRIVATE_KEY`.
2. Add secrets: `P49_HOST`, `P49_SSH_USER`, optional `P49_DEPLOY_PATH` (default `~/airplay-status`).
3. Create Actions environment **`beta`**; scope secrets to `beta` if desired.
4. Run **Deploy P49 beta (scaffold)** workflow manually with a known-good SHA.

---

## Beta sign-off (human + device)

- [ ] iPhone: HomePods + **AirPlay Status (Beta)** in one AirPlay group
- [ ] Dashboard live metadata within 5s
- [ ] `GET /api/version` → `deployPhase=p49`, correct semver/commit
- [ ] 24h soak; reboot → services auto-start
- [ ] Fresh install doc works ([deploy/rpi/README.md](../deploy/rpi/README.md))

Then proceed to **P99** prod readiness on the same Pi tier.

---

## References

| Doc | Path |
|-----|------|
| P49 spec | [specs/p49-preprod-deployment.md](../specs/p49-preprod-deployment.md) |
| Agent handoff | [AGENT_START_HERE.md](../AGENT_START_HERE.md) |
| Deploy stages | [config/deploy/README.md](../config/deploy/README.md) |
| Multi-room | [docs/multi-room-airplay.md](./multi-room-airplay.md) |

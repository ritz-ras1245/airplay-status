# Next session — PR review & manual test plan

**Status:** Paused — resume when owner says **resume**  
**Context:** P49 beta + **P50** observability live on Pi. Five cloud-agent **draft PRs** await review. Merge **one at a time**.

---

## PR summary

| # | Phase | Title | Link | CI |
|---|-------|-------|------|-----|
| 10 | **P1** | DACP remote control | https://github.com/ritz-ras1245/airplay-status/pull/10 | ✅ |
| 7 | **P3** | eInk read-only display | https://github.com/ritz-ras1245/airplay-status/pull/7 | ✅ |
| 9 | **P4** | eInk transport controls | https://github.com/ritz-ras1245/airplay-status/pull/9 | ✅ |
| 11 | **P5** | Deployment docs (P49 alignment) | https://github.com/ritz-ras1245/airplay-status/pull/11 | ✅ |
| 8 | **P6** | Echo Show Tier B | https://github.com/ritz-ras1245/airplay-status/pull/8 | ✅ |

**Already merged:** P49 deploy · P50 observability ([#12](https://github.com/ritz-ras1245/airplay-status/pull/12)) · P2 Tidbyt  
**Pi during P50 soak:** no deploy unless beta blocker · Promtail → Mac Loki OK

---

## Merge order (recommended)

```
P1 → P3 → P4 (rebase/dedupe vs P1+P3) → P5 → P6
```

P4 bundles minimal P1+P3 — expect overlap; rebase after P1 and P3 land.

---

## Session 1 — P1 Remote control (PR #10)

```bash
git fetch origin && git checkout feat/cursor/p1-remote-control && npm ci
./bin/run-local.sh --debug
```

| Step | Action | Pass |
|------|--------|------|
| 1 | Apple Music → **AirPlay Status only** (Mac AP1) | |
| 2 | `curl -s localhost:3003/api/status \| jq .controlAvailable` → `true` after connect | |
| 3 | Dashboard: ⏮ ▶/⏸ ⏭ — pause/play/next affect sender | |
| 4 | Stop AirPlay → `controlAvailable: false`, reason sensible | |
| 5 | Note iOS 17.4+ may show `ios_blocked` — not a regression | |

**Merge if pass** → `main` → `./bin/run-local.sh` smoke on `main`.

---

## Session 2 — P3 eInk display (PR #7)

```bash
git checkout feat/cursor/p3-eink-display   # or PR head: feat/cursor/p3-e-ink-display-4fc4
npm ci && ./bin/run-local.sh
cp -n config/eink-devices.example.json config/eink-devices.json
```

| Step | Action | Pass |
|------|--------|------|
| 1 | Play to AirPlay Status | |
| 2 | Browser: http://localhost:3003/eink | |
| 3 | http://localhost:3003/eink?device=7inch — segmented bar, ~22s refresh | |
| 4 | `curl -o /tmp/eink.png 'localhost:3003/api/display/7inch.png'` — valid PNG | |
| 5 | Repeat curl with `If-None-Match` → 304 | |

**Merge if pass.**

---

## Session 3 — P4 eInk controls (PR #9)

**After P1 + P3 merged** (or test branch as-is knowing overlap):

```bash
git checkout feat/cursor/p4-eink-controls-f6e3
npm ci && ./bin/run-local.sh
```

| Step | Action | Pass |
|------|--------|------|
| 1 | http://localhost:3003/eink — Prev / Play-Pause / Next forms visible | |
| 2 | With AirPlay active, POST pause via form → redirect `?control=ok` | |
| 3 | Idle → buttons disabled + reason text | |
| 4 | `curl /api/display/7inch.png` still read-only PNG | |

**Merge if pass** (rebase onto `main` first if P1/P3 landed).

---

## Session 4 — P5 Deployment docs (PR #11)

Docs only — no runtime test required.

| Step | Action | Pass |
|------|--------|------|
| 1 | Read diff: `specs/p5-deployment.md` vs `deploy/rpi/README.md` | |
| 2 | Pi port **80** vs Mac **3003** consistent | |
| 3 | Docker → `deploy/docker/README-WARN.md`, no false Mac AirPlay claims | |
| 4 | Cross-links resolve | |

**Merge if pass.**

---

## Session 5 — P6 Echo Show (PR #8)

```bash
git checkout feat/cursor/p6-echo-show-integration-be09
npm ci && npm test          # expect 17/17
./bin/run-local.sh
```

| Step | Action | Pass |
|------|--------|------|
| 1 | http://localhost:3003/echo — SSE UI loads with mock/live | |
| 2 | `./bin/check-tracked-privacy.sh` | |
| 3 | `cd integrations/echo && sam build` (local, needs SAM CLI) | |
| 4 | **Manual (later):** SAM deploy, `.env` webhook, Echo Show Silk + routine | |

Merge after Mac tests + accept manual AWS/Alexa checklist in PR body.

---

## After each merge

1. `./bin/check-tracked-privacy.sh`
2. `./bin/run-local.sh` quick smoke
3. **Do not** redeploy Pi during P50 soak unless beta blocker
4. Optional: `./bin/check-observability.sh` — logs still flowing

---

## P50 incident workflow

Slack or note: **error at `<ISO timestamp>`**

```bash
./bin/check-observability.sh
./bin/query-loki.sh --around '<timestamp>' --window 10m
./bin/query-loki.sh --around '<timestamp>' --search 'error' --unit 'airplay-status.service'
```

Grafana: http://localhost:3030 → **AirPlay Status Logs** → `{host="airplay-beta"}`

---

## Resume trigger

When owner says **resume**, start with **Session 1 (P1)** unless a different PR is specified.

# airplay-status — Next Steps Plan

_Last updated 2026-08-26 (refresh: #25/#26/#27 merged; #28 P11 validated in-VM and ready). A followable checklist to take the current work from "authored / in-review" to a shipped 1.0.0._

Repo: https://github.com/ritz-ras1245/airplay-status · Base branch: `main`

---

## 1. Current state (snapshot)

**Merged to `main` this cycle**

- Cloud dev-env docs (AGENTS.md) + phase/docs table updates
- Kiosk view `GET /display` (SSE, Screen Wake Lock, idle screen-off, focus-before-idle "tap to resume")
- Per-client kiosk tuning (`?client=android|deskthing|ipad`)
- `GET /api/health` (status, mode, uptime, watcher, **sidecar**, nowPlaying) + `bin/check-health.sh`
- P10 local-service fallback gateway (`integrations/local-fallback/`) + human `/_gateway` status page
- P9 iPad always-on **web MVP** (`docs/ipad-guided-access.md`)
- P8 DeskThing/Car Thing app (`integrations/deskthing/`) — authored
- P7 Android always-on app (`integrations/android/`) — authored

**Open PRs**

- **#28 — P11 Media Status (AirPlay + Spotify, one-by-one)** — _validated in-VM, ready to merge._ `npm test` 40/40; `/api/sources` + `/api/status?source=…` correct; `/display` rotation and pill **pinning** verified (pin persists past the 8s rotate window); trial-merges cleanly into `main`. Only unchecked item: "live mode stays AirPlay-only" (needs a live-mode eyeball). Ships **mock** Spotify; real Web API is the P12 follow-on.
- #10 — P1 DACP remote control — draft; **device-pending** (Mac + Apple Music + AirPlay). Trial-merges clean; CI green.
- #7 — P3 eInk read-only display — draft; **device-pending** (eInk).
- #9 — P4 eInk transport controls — draft; **depends on P1**; device-pending (eInk).
- #8 — P6 Echo Show Tier B — draft; **device-pending** (Echo Show + LAN DNS + LWA token).
- #11 — P5 deployment docs — draft; ⚠️ **stale (18 behind), conflicts** in `AGENTS.md` + `specs/p0-airplay-status.md` → **needs a rebase** before it can merge.

**Device-test pending (merged code, needs hardware)**

- P7 Android APK · P8 DeskThing on Car Thing · P9 iPad on device · P10 deploy on LAN

**New follow-on spec**

- **P12 — real Spotify Web API + controls** (`specs/p12-spotify-source.md`, arrives with #28) — `DECISION REQUIRED`: Spotify Client ID before it's Cloud-PR ready.

---

## 2. Immediate merges / low-risk (no hardware required)

- [ ] Merge **#28** (P11 Media Status) — validated in-VM, merges cleanly; optionally eyeball live-mode-AirPlay-only first
- [ ] Rebase **#11** (P5 docs) onto `main` (resolve `AGENTS.md` + `specs/p0-airplay-status.md` conflicts), then merge

_(The other no-device PRs — kiosk, health + sidecar, `check-health.sh`, gateway + `/_gateway`, per-client tuning, phase/docs, this plan — are already merged.)_

---

## 3. Device-test + merge queue (draft PRs)

Each item: **prerequisites → steps → acceptance → mark ready → merge**. All require hardware not available to a cloud agent.

### 3.1 P1 — DACP remote control (#10)

- Prerequisites: Mac dev host; Apple Music; the "AirPlay Status" receiver running (`./bin/run-local.sh --debug`).
- Steps:
  - [ ] `./bin/run-local.sh --debug` on the Mac
  - [ ] iPhone/Mac → Apple Music → select **AirPlay Status only** (not multi-room on Mac)
  - [ ] `curl http://localhost:3003/api/status` → `controlAvailable: true` after connect
  - [ ] Exercise dashboard transport buttons (play/pause/next/prev); confirm the sender responds
- Acceptance: transport works, or the UX correctly shows `ios_blocked` / `ap2_unsupported` (iOS 17.4+ may ignore DACP — shairport-sync #1858).
- Then: mark #10 **Ready for review** → merge. (Trial merge into current `main` is clean; CI green.)

### 3.2 P3 — eInk read-only display (#7)

- Prerequisites: target eInk device/driver (per the PR/spec).
- Steps:
  - [ ] Load `/eink` page and request the on-demand PNG against a running dashboard
  - [ ] Validate rendering on the actual eInk panel (contrast, refresh cadence)
- Acceptance: eInk shows current now-playing; on-demand PNG matches.
- Then: mark ready → merge.

### 3.3 P4 — eInk transport controls (#9)  _(depends on P1)_

- Prerequisites: **P1 (#10) merged**; eInk device.
- Steps:
  - [ ] Confirm control availability plumbing from P1 is present
  - [ ] Exercise eInk HTML-form transport controls end to end
- Acceptance: controls actuate playback via the P1 path.
- Then: mark ready → merge **after** #10.

### 3.4 P6 — Echo Show Tier B (#8)

- Prerequisites: Echo Show / Fire device; LAN DNS (`home.arpa`) per the PR docs; LWA dev token.
- Steps:
  - [ ] Configure DNS + routine per `integrations/echo/docs/`
  - [ ] Trigger push-on-play; confirm the `/echo` SSE UI renders on Silk
- Acceptance: now-playing appears on the Echo Show on playback.
- Then: mark ready → merge.

---

## 4. Device verification of already-merged clients

These are on `main` but were authored without a device build in CI.

### 4.1 P7 — Android (`integrations/android/`)

- Prerequisites: Android Studio / SDK; an Android tablet; same LAN as airplay-status.
- Steps:
  - [ ] Set `DISPLAY_URL` / `STATUS_URL` (+ optional `FALLBACK_URL`) in `app/build.gradle.kts`
  - [ ] `./gradlew test` (JVM state-machine tests) then `./gradlew assembleDebug`
  - [ ] `adb install -r app/build/outputs/apk/debug/app-debug.apk`; grant notifications; exempt battery optimization
  - [ ] Play → screen stays on; idle → screen off; focused-idle → play → "Tap here to resume" notification; left-before-idle → play → no notification
- Acceptance: matches the P7 spec acceptance list.

### 4.2 P8 — DeskThing / Car Thing (`integrations/deskthing/`)

- Prerequisites: DeskThing server host on LAN; a flashed Car Thing (Thing Labs superbird-tool); pinned DeskThing SDK/version (OD5).
- Steps:
  - [ ] `npm install && npm test` (shared state machine) then `npm run build`
  - [ ] Zip `dist/`, load into DeskThing server, initialize onto Car Thing; set settings (`airplayStatusUrl`, optional `fallbackUrl`)
  - [ ] Verify SDK method names against the pinned `@deskthing/*` version
  - [ ] Play → display awake; idle → sleep; focused-idle → play → resume splash; unfocused → silent
- Acceptance: matches the P8 spec acceptance list; record tested DeskThing + firmware versions.

### 4.3 P9 — iPad (web / Guided Access)

- Prerequisites: an iPad on constant power, same LAN.
- Steps (per `docs/ipad-guided-access.md`):
  - [ ] Open `http://<host>:3003/display?client=ipad` in Safari → Add to Home Screen
  - [ ] Set a long Auto-Lock; start Guided Access
  - [ ] Verify live updates, idle dim, on-screen tap-to-resume
- Acceptance: display + idle behaviour hold on one iPadOS version (record it). Promote to native (OD1=A) only if a screen-off resume notification is required.

---

## 5. P10 gateway — deployment (LAN)

- Prerequisites: Docker on Synology or an always-on box near the eero; DNS control (AdGuard/Pi-hole/router).
- Steps:
  - [ ] `cp config/services.example.json config/services.json`; set your LAN hosts/ports (this file is gitignored)
  - [ ] `docker compose up -d --build`
  - [ ] Point `airplay-status.home.arpa` (or a test name) at the gateway host
  - [ ] Stop the Node app / unplug the Pi → clients get the fallback page + probe matrix within the probe interval
  - [ ] Restore → proxy resumes automatically after `recover_after` healthy probes
  - [ ] Add a second dummy service → confirms the generic path
  - [ ] Browse `/_gateway` for the live status page; `/_gateway/services` for JSON
- Acceptance: matches the P10 spec manual acceptance list.

---

## 6. Post-merge follow-ups

- [ ] After **#10 merges**: add a dashboard → `/display` link (held back to avoid an `index.ejs` conflict with #10)
- [ ] Record tested versions (OD5) for P7/P8 in their acceptance notes
- [ ] Optional: promote P9 to native WKWebView (OD1=A) if background screen-off resume nudges become mandatory
- [ ] Optional: cross-link `FALLBACK_URL` in each client's config docs once the gateway hostname is finalized

---

## 7. Road to release (P49 → P50 → P99 → P100)

- **P49** — RPi4 pre-prod beta: done
- **P50** — beta soak + observability (Pi logs → Mac Loki/Grafana): active — complete soak sign-off
- **P99** — prod readiness (permanent definition): persistence (`bin/install.sh`, launchd/systemd, start-on-boot); always-on structured logs + prod log dir; optional self-hosted Grafana+Loki; debugging SOPs; health (`/api/health`, `/api/version`, `bin/check-sidecar.sh`, `bin/check-health.sh`, `bin/check-version.sh`); runbooks
- **P100** — tag **v1.0.0**; open `release/1.x` for `1.0.x` patches while `main` moves to `2.0.0-dev`

---

## 8. Suggested execution order

1. Merge **#28** (validated); rebase + merge **#11** (P5 docs)
2. Device-test **P1 (#10)** → merge → then **P4 (#9)**
3. Device-test **P3 (#7)** and **P6 (#8)** → merge
4. Verify merged clients on hardware: **P7**, **P8**, **P9**
5. Deploy **P10** on the LAN box; DNS cutover; kill/restore test
6. Add dashboard → `/display` link (post-#10)
7. Finish **P50** soak → **P99** prod readiness → **P100** release `1.0.0`

---

## Appendix A — quick commands

- Dashboard (mock, headless): `USE_MOCK=true SKIP_SHAIRPORT_CHECK=1 npm start` → http://localhost:3003
- Dashboard (live): `SKIP_SHAIRPORT_CHECK=1 npm start`
- Kiosk view: `/display` (add `?client=android|deskthing|ipad`)
- Parser demo (no hardware): `npm run demo`
- App tests: `npm test`
- Health check: `./bin/check-health.sh http://<host>:3003`
- Gateway: `cd integrations/local-fallback && cp config/services.example.json config/services.json && npm start` (or `docker compose up -d --build`); tests: `npm test`
- Headless live-path test (no AirPlay hardware): create FIFO `mkfifo /tmp/shairport-sync-metadata`, run live mode, write shairport-style `<item>` XML records into the pipe (see AGENTS.md "Cursor Cloud specific instructions")

## Appendix B — branch / PR policy

- Branches: `{action}/{user}/{description}` (e.g. `feat/cursor/<name>`); never commit on `main`.
- Bots/agents open PRs; the owner may merge without a PR. CI enforces branch name + privacy.

## Appendix C — usage / model note

- Prefer **Cursor Grok / Composer** (included) for further work; **do not** draw down the credit balance.
- "Other Models" quota is exhausted and on-demand spending is disabled — non-Cursor models would fail or consume credits, so keep automation on Cursor models and avoid heavy subagents.

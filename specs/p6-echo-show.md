# Phase P6 — Echo Show Now Playing (Tier B)

**Status:** Spec (Cloud-PR ready)  
**Depends on:** P0 live metadata (`/api/status`, `/api/events` SSE)  
**Optional dependency:** P1 not required (display-only)  
**Layout:** Monorepo under `integrations/echo/` (single PR)  
**Standard:** [cloud-cursor-pr-standard.md](./cloud-cursor-pr-standard.md)

## Agent pickup prompt

```
Pickup and analyse specs/p6-echo-show.md.
Take it from end to end to a PR.

In the PR body, add a checklist of manual steps to hook up Alexa, AWS, DNS,
and Echo Show, and test manually before approving and merging.

Follow specs/cloud-cursor-pr-standard.md.
```

---

## Goal

When AirPlay playback starts (or materially changes), **airplay-status pushes an event to AWS**. Lambda dispatches an **Alexa Routines custom trigger**. A user-configured routine opens the **Silk browser** on Echo Show to a **LAN-resolvable URL** that renders live now-playing metadata via SSE.

Echo Show keeps normal Alexa behavior (voice, Spotify, routines, alarms). Only the **display surface** is replaced while the dashboard is open — avoiding the native home screen **sponsored content** without sideloading or blocking Amazon services.

**Tier A (24×7 kiosk)** is documented here as a **future companion path** when a dedicated home kiosk is ready; P6 implements **Tier B (push on play)** only.

---

## Tier A — Future kiosk mode (not in P6 scope)

Use when a dedicated Echo Show acts as an always-on display:

- Silk stays on `ECHO_DISPLAY_URL` (see Configuration)
- Page uses SSE; idle vs playing states built into `/echo`
- Optional [keep-silk-open](https://gitlab.com/DaGammla/keep-silk-open) script to prevent Silk sleep
- Optional Alexa routine: periodic “return to Silk” (HA virtual-switch pattern) — document in `integrations/echo/README.md` only

**Why defer:** Tier A is lucrative for 24×7 signage; Tier B matches “show when something plays” without occupying the device when idle.

---

## Architecture (Tier B)

```
┌─────────────────┐     on play / track change      ┌──────────────────┐
│ airplay-status  │ ─── POST (signed webhook) ────► │ API Gateway      │
│ echoPushService │                                 └────────┬─────────┘
└────────┬────────┘                                          │
         │ SSE / HTML                                         ▼
         │                                          ┌──────────────────┐
         │                                          │ Lambda           │
         │                                          │ triggerRoutine   │
         │                                          └────────┬─────────┘
         │                                                   │
         │                                          Alexa Routines Trigger
         │                                          Instance REST API
         │                                                   │
         │                                                   ▼
         │                                          ┌──────────────────┐
         │                                          │ User routine     │
         │                                          │ → Custom action  │
         │                                          │   invokes skill  │
         │                                          └────────┬─────────┘
         │                                                   │
         │                                          OpenURL APL (Silk)
         ▼                                                   ▼
┌─────────────────┐◄──── GET ECHO_DISPLAY_URL ─────── Echo Show (LAN)
│ /echo + SSE     │      (LAN DNS → host IP)
└─────────────────┘
```

**Critical constraint:** Lambda never calls the LAN. Only Echo Show fetches `ECHO_DISPLAY_URL` after the routine runs.

---

## Decisions (locked)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Tier B only** in P6 implementation | User request |
| D2 | **Push on playback start/change**; debounce like Tidbyt (`250ms`) | Avoid routine spam |
| D3 | **No push on idle/stop** for MVP | Echo keeps last frame until Silk times out; returns to native home/ads |
| D4 | **Monorepo** — skill + Lambda under `integrations/echo/` | Single Cloud PR |
| D5 | **Custom Routines Trigger** (not Proactive Events) | Only path to drive Echo Show display action |
| D6 | **OpenURL APL** in skill ([home-assistant-on-echo-show](https://github.com/aldadic/home-assistant-on-echo-show)) | Proven Silk open on Echo Show |
| D7 | **Display URL** default `http://airplay-status.home.arpa:3003/echo` | LAN DNS; eero cannot host records natively (see DNS section) |
| D8 | **Webhook auth:** `X-Echo-Push-Secret` header | Simple; no OAuth on LAN push |
| D9 | **AWS region:** `us-east-1` | Alexa Routines Trigger Instance API (NA) |
| D10 | **Skill trigger name:** `AirPlayStatusNowPlaying` | Routine trigger identifier |
| D11 | **Node test runner:** `node:test` | Repo has no test framework yet |
| D12 | **`.env` for local secrets** (gitignored) | Matches P2 Tidbyt pattern |
| D13 | **Devices:** Echo Show 5/8/10 primary; Fire TV Stick secondary; Echo Spot 1st gen (rook) optional | User request |
| D14 | **DNS on eero:** document RPi or Synology DNS path; raw IP fallback | eero has no static local DNS |
| D15 | **Dev/test DNS:** Option D — raw LAN IP; host Node on macOS (`./bin/run-local.sh`) | User decision; Echo uses `http://<mac-lan-ip>:3003/echo` |

---

## Open decisions

_All resolved — agent implements locked decisions above._

---

## Configuration

### airplay-status (`.env.example` additions)

| Variable | Required | Description |
|----------|----------|-------------|
| `ECHO_PUSH_ENABLED` | No | `0` disables push; auto-enable when `ECHO_PUSH_WEBHOOK_URL` + `ECHO_PUSH_SECRET` set |
| `ECHO_PUSH_WEBHOOK_URL` | Yes if enabled | API Gateway POST URL (SAM deploy output) |
| `ECHO_PUSH_SECRET` | Yes if enabled | Must match Lambda env `ECHO_PUSH_SECRET` |
| `ECHO_DISPLAY_URL` | No | Default for skill/routine docs; not read by push service |

### Lambda env (AWS console / SSM — `integrations/echo/`)

| Variable | Description |
|----------|-------------|
| `ECHO_PUSH_SECRET` | Validates incoming webhook |
| `ALEXA_SKILL_CLIENT_ID` | LWA security profile |
| `ALEXA_SKILL_CLIENT_SECRET` | LWA security profile |
| `ALEXA_ROUTINE_TRIGGER_NAME` | Default `AirPlayStatusNowPlaying` |
| `ALEXA_TARGET_USER_ID` | `amzn1.ask.account.…` for UNICAST |
| `ALEXA_TARGET_BEARER_TOKEN` | Per-user token from skill enable / account linking |
| `ECHO_DISPLAY_URL` | OpenURL target (default `http://airplay-status.home.arpa:3003/echo`) |

Never commit secrets to git.

---

## Device support matrix

| Device | Tier B (routine → OpenURL) | `/echo` layout | P6 MVP |
|--------|---------------------------|----------------|--------|
| Echo Show 5 | Yes | Compact landscape | **Primary** |
| Echo Show 8 | Yes | Standard landscape | **Primary** |
| Echo Show 10 / 11 | Yes | Large landscape | **Primary** |
| Fire TV Stick | **Partial** — Silk exists; OpenURL APL may not apply | TV-safe `@media (min-width: 1280px)` | **Secondary** — manual Silk doc |
| Echo Spot 1st gen (**rook**) | Yes if stock Alexa supports OpenURL | Circular `?profile=spot` | **Optional** — skip if low effort / APL blocked |

**Fire TV:** Document manual Silk bookmark in `integrations/echo/docs/fire-tv.md`. Not a merge blocker.

**Rook (Spot):** Codename for 2017 Echo Spot. Circular viewport; optional spot profile. Not required for MVP sign-off if Show 5/8 pass.

---

## Repository layout (monorepo)

| Path | Purpose |
|------|---------|
| `src/services/echoPushService.js` | Webhook push on playback change |
| `src/views/echo.ejs` | Echo-optimized dashboard |
| `public/echo.css` | Responsive Show 5/8/10 + TV + spot profile |
| `public/echo.js` | SSE client; `?kiosk=1` enables keep-silk-open |
| `src/index.js` | Wire service; route `GET /echo` |
| `test/echoPushService.test.js` | Unit tests |
| `test/echoRoute.test.js` | HTTP smoke test |
| `.env.example` | New vars |
| `integrations/echo/skill/` | ASK manifest + interaction model |
| `integrations/echo/lambda/trigger/` | Webhook → Routines Trigger API |
| `integrations/echo/lambda/skill/` | OpenURL intent handler |
| `integrations/echo/template.yaml` | AWS SAM: API Gateway + Lambdas |
| `integrations/echo/test/` | Lambda unit tests |
| `integrations/echo/README.md` | Deploy overview |
| `integrations/echo/docs/routine-setup.md` | Alexa routine steps |
| `integrations/echo/docs/dns-setup.md` | eero + RPi + Synology DNS |
| `integrations/echo/docs/lwa-dev-token.md` | Dev LWA token acquisition |
| `integrations/echo/docs/fire-tv.md` | Fire TV Stick manual Silk path |

---

## Echo UI (`GET /echo`)

**Layout:**

- Full-viewport dark theme; min touch targets (kiosk-friendly for Tier A later)
- Album art (max 40vh), title, artist, album
- Play/pause indicator + progress bar (reuse P0 field semantics)
- **Idle state:** “Nothing playing” + subtle AirPlay hint
- **SSE:** subscribe to `/api/events`; fallback poll `/api/status` every 5s
- **Silk:** keep-silk-open only when `?kiosk=1` (Tier A)
- **Profiles:** `?profile=spot` for Echo Spot (rook) — circular-safe layout

**Non-goals:** Transport controls (P1), login/auth on `/echo`.

---

## Push service (`echoPushService.js`)

Mirror `tidbytPushService.js` patterns:

1. Subscribe to `onPlaybackChange()` when not mock mode
2. **Push when** `title` or `artist` present (same as Tidbyt `shouldPushPlayback`)
3. **Skip when** idle / cleared
4. Debounce `250ms`; queue if POST in flight
5. POST JSON body:

```json
{
  "event": "now_playing",
  "title": "…",
  "artist": "…",
  "isPlaying": true,
  "displayUrl": "http://airplay-status.home.arpa:3003/echo"
}
```

6. Headers: `Content-Type: application/json`, `X-Echo-Push-Secret: <secret>`
7. Log failures; exponential backoff; disable after 10 consecutive failures (bordered WARN like Tidbyt)
8. `ECHO_PUSH_ENABLED=0` suppresses with cyan hint on stderr

**Do not push** on progress-only updates (title/artist/art/isPlaying key only — no progress buckets).

---

## Lambda webhook handler (`integrations/echo/lambda/trigger/`)

1. API Gateway `POST /trigger` → trigger Lambda
2. Reject if secret mismatch → `401`
3. On valid body, call:

```
POST https://api.amazonalexa.com/v1/routines/triggerInstances
Authorization: Bearer <LWA token, scope alexa::routines:triggerinstances:write>
```

4. UNICAST payload per [Routines Trigger Instance API](https://developer.amazon.com/en-US/docs/alexa/routines/routines-custom-trigger-api-reference.html)
5. Return `202` to API Gateway on success

**LWA token refresh:** minimal cache in Lambda; document dev token flow in `docs/lwa-dev-token.md`.

---

## Alexa skill (`integrations/echo/skill/`)

**Invocation name:** `airplay status`  
**Intent:** `OpenNowPlayingIntent` — opens `ECHO_DISPLAY_URL` via OpenURL APL

**Routines integration:**

- Manifest enables `routines` API + UNICAST trigger `AirPlayStatusNowPlaying`
- Implement `Routines.Trigger.Create` / `Delete` SPI handlers (log + acknowledge)

**User routine (manual setup):**

1. Trigger: **AirPlay Status → Now Playing** (custom trigger from skill)
2. Action: **Custom action** → “open airplay now playing” (utterance → `OpenNowPlayingIntent`)

---

## DNS setup (`integrations/echo/docs/dns-setup.md`)

**Preferred URL:** `http://airplay-status.home.arpa:3003/echo`

### eero

eero **does not** expose custom static DNS records. Document these options (user picks one):

| Option | Where | Summary |
|--------|-------|---------|
| **A — RPi** | Pi-hole or AdGuard Home on Raspberry Pi | Local rewrite `airplay-status.home.arpa` → LAN IP; eero → Advanced → DNS → Custom DNS → Pi IP |
| **B — Synology** | Synology DNS Server or Docker AdGuard | Same rewrite; eero custom DNS → Synology IP |
| **C — Host dnsmasq** | macOS/Linux on airplay-status host | Local DNS on LAN IP; eero custom DNS → that IP |
| **D — Raw IP** | No DNS server — **default for dev/test** | `ECHO_DISPLAY_URL=http://192.168.x.x:3003/echo` in Lambda/skill env; Mac runs Node via `./bin/run-local.sh` |
| **E — mDNS** | Last resort | `http://<host>.local:3003/echo` — flaky on Echo; not MVP sign-off |

Also document OpenWrt / UniFi native local DNS where supported.

**Dev note:** `localhost` works on the Mac only. Echo Show must use the Mac’s LAN IP on the same Wi‑Fi.

**Verify:** Load `ECHO_DISPLAY_URL` in Silk on Echo before testing routines.

---

## Implementation steps

1. Add `echoPushService.js` + wire in `src/index.js` (parallel to Tidbyt)
2. Add `GET /echo` route + `echo.ejs` + responsive static assets
3. Extend `.env.example`
4. Add `integrations/echo/` — SAM, Lambdas, skill, docs
5. Add tests: `test/` + `integrations/echo/test/`; `"test": "node --test test/**/*.test.js integrations/echo/test/**/*.test.js"` in `package.json`
6. Update `AGENTS.md` phase table

---

## Automated tests

| Test | Location | Command |
|------|----------|---------|
| Push service / debounce / secret header | `test/` | `npm test` |
| `GET /echo` returns 200, SSE script present | `test/` | `npm test` |
| Webhook rejects bad secret | `integrations/echo/test/` | `npm test` |
| Trigger builds valid Routines payload | `integrations/echo/test/` | `npm test` |
| Skill returns OpenURL directive | `integrations/echo/test/` | `npm test` |

Use mock playback — no shairport, Echo, or AWS in CI.

---

## Acceptance criteria

- [ ] `(automated)` Push service POSTs on track change with correct secret header
- [ ] `(automated)` Push service does not POST on idle/clear
- [ ] `(automated)` `/echo` renders idle and playing states
- [ ] `(automated)` Trigger Lambda returns 401 on bad secret
- [ ] `(automated)` Skill handler includes OpenURL for configured display URL
- [ ] `(manual)` DNS option works on Echo Show (A/B/C/D per dns-setup.md)
- [ ] `(manual)` SAM deploy succeeds; webhook URL in `.env`
- [ ] `(manual)` Dev skill + routine: AirPlay → Echo opens `/echo` within ~5s
- [ ] `(manual)` Voice / Spotify / routines work after Silk closes
- [ ] `(device)` SSE updates title/artist on Show 5 or 8 without re-triggering routine

---

## Out of scope (P6)

- Tier A kiosk automation (keep-silk-open default, periodic routines)
- Skill public certification / multi-tenant UNICAST
- Idle/stop routine to dismiss Silk
- Transport controls on `/echo`
- Cloudflare tunnel / off-LAN access (see P5)
- Blocking ads system-wide (display overlay only while Silk is open)

---

## PR body template (copy into PR)

```markdown
## Summary
- P6 Echo Show Tier B: `/echo` view + `echoPushService` + `integrations/echo/` (SAM + skill)

## Automated verification
- [ ] `npm test` passes
- [ ] `sam build` in `integrations/echo/` succeeds (if SAM CLI available)

## Manual setup & test (complete before merge)
- [ ] DNS (pick one per `integrations/echo/docs/dns-setup.md`):
  - [ ] Option A: Pi-hole/AdGuard on RPi + eero custom DNS
  - [ ] Option B: Synology DNS rewrite + eero custom DNS
  - [ ] Option D: raw LAN IP in `ECHO_DISPLAY_URL`
- [ ] Confirm `ECHO_DISPLAY_URL` loads in Silk on Echo Show 5/8/10
- [ ] `sam deploy --guided`; copy webhook URL + secret to `.env`
- [ ] Amazon Developer: enable dev skill, LWA profile, Lambda ARNs
- [ ] Create routine: custom trigger **AirPlay Status Now Playing** → open now playing
- [ ] `./bin/run-local.sh`; AirPlay to **AirPlay Status** + speakers
- [ ] Confirm Echo opens Silk within ~5s on play
- [ ] Change track; confirm SSE updates without new routine fire
- [ ] Stop playback; confirm no webhook spam (last frame until Silk timeout)
- [ ] Optional: Fire TV — `integrations/echo/docs/fire-tv.md`
- [ ] Optional: Echo Spot (rook) — `?profile=spot`
- [ ] Confirm voice/Spotify/routines still work after Silk closes

## Spec
- specs/p6-echo-show.md
- specs/cloud-cursor-pr-standard.md
```

---

## References

- [Custom Triggers for Routines](https://developer.amazon.com/en-US/docs/alexa/routines/introduction-to-custom-trigger-for-routines.html)
- [Routines Trigger Instance REST API](https://developer.amazon.com/en-US/docs/alexa/routines/routines-custom-trigger-api-reference.html)
- [OpenURL APL command](https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/apl-standard-commands-v1-5.html#open_url_command)
- [home-assistant-on-echo-show](https://github.com/aldadic/home-assistant-on-echo-show)
- [keep-silk-open](https://gitlab.com/DaGammla/keep-silk-open)
- [eero custom DNS](https://support.eero.com/hc/en-us/articles/360059988432-Setting-up-custom-DNS-servers-with-eero)
- P2 Tidbyt push pattern: `src/services/tidbytPushService.js`

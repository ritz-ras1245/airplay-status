# Phase P1 — Remote Control (Web Play/Pause/Prev/Next)

**Status:** Implemented on `feat/cursor/p1-remote-control` — **Pi device sign-off required** ([docs/p1-pi-validation.md](../docs/p1-pi-validation.md))  
**Depends on:** Phase 4 live metadata (`/api/status`, metadata pipe reader)  
**Priority source devices:** iPhone, iPod Touch; Mac when available

## Goal

Add transport controls to the existing dashboard that control the **AirPlay sender** (phone or Mac running Music/Spotify), not local playback on the receiver.

The user keeps **AirPlay Status** selected as an output. Buttons on the web UI send play, pause, and skip commands to the device that is streaming.

## Feasibility

| Aspect | Assessment |
|--------|------------|
| **Overall** | **Conditional** — technically possible via DACP; reliability varies by sender OS and AirPlay mode |
| **Classic AirPlay (AP1)** | Required for DACP; matches current dev setup (`Startup in Classic AirPlay mode` in shairport-sync logs) |
| **iPhone / iPod (iOS 17.4+)** | **High risk** — Apple largely ignores DACP remote commands; commands may send without effect ([shairport-sync #1858](https://github.com/mikebrady/shairport-sync/issues/1858)) |
| **Mac (Music.app)** | **Medium–high** — same DACP path; often more reliable than iOS |
| **AirPlay 2-only senders** | **Not feasible** — AP2 remote control not reverse-engineered ([shairport-sync #2186](https://github.com/mikebrady/shairport-sync/issues/2186)) |
| **shairport-sync D-Bus/MQTT** | **Not recommended** — D-Bus is Linux-only; MQTT remote is unreliable on modern iOS |

**Decision:** Implement a **Node.js DACP HTTP client** using session fields from the existing metadata pipe. Do not depend on shairport-sync D-Bus or MQTT for P1.

## Architecture

```
┌──────────────┐     metadata pipe      ┌─────────────────────┐
│ shairport-   │ ─────────────────────► │ airplayMetadata     │
│ sync         │   daid, dapo, clip     │ Service             │
└──────────────┘                        └──────────┬──────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │ playbackControl     │
                                          │ Service             │
                                          └──────────┬──────────┘
                                                     │ HTTP DACP
                                                     ▼
                                          ┌─────────────────────┐
                                          │ iPhone / Mac sender │
                                          └─────────────────────┘

Browser ──POST /api/control/*──► playbackControlService ──► dacpClient
Browser ◄──SSE /api/status────── airplayMetadataService
```

All outputs (web, Tidbyt, Kindle) share the same playback state from `airplayMetadataService`. Control is a separate concern layered on top.

## DACP session discovery

shairport-sync emits these **ssnc** metadata codes when a sender connects (observed in debug logs):

| Code | Field | Purpose |
|------|-------|---------|
| `daid` | DACP ID | Client identifier for control session |
| `dapo` | DACP port | TCP port on sender for HTTP control |
| `clip` | Client IP | Sender IPv4/IPv6 address |

**Planned pipe reader additions** (`src/lib/metadataPipeReader.js`):

```js
DAID: 0x64616964,
DAPO: 0x6461706f,
CLIP: 0x636c6970,
```

Map to internal `controlSession`:

```json
{
  "dacpId": "C58E4CA45698A4C6",
  "dacpPort": 3689,
  "clientIp": "fe80::879:96f:2142:485a",
  "updatedAt": "2026-07-26T10:48:33.059Z"
}
```

Clear `controlSession` on `active_end`, `disconnect`, or when pipe goes idle with no title.

## DACP command protocol

HTTP GET to sender (Classic AirPlay / iTunes Remote protocol):

```
http://<clientIp>:<dacpPort>/ctrl?command=<cmd>
```

Optional query param when required: `active-remote=<dacpId>` (verify during spike; some clients need it).

| UI action | DACP command | Notes |
|-----------|--------------|-------|
| Play | `play` | Use when `isPlaying === false` |
| Pause | `pause` | Use when `isPlaying === true` |
| Toggle | `playpause` | Alternative single command |
| Next track | `nextitem` | |
| Previous track | `previtem` | |

**Client behavior (`src/lib/dacpClient.js`):**

- Timeout: 3s per command
- Normalize IPv6 link-local addresses from `clip`
- Parse response body for error hints if present
- Return `{ ok: true }` or `{ ok: false, reason: string }`
- Never throw to caller; map network errors to structured failure

**Probe on session establish:**

After `daid` + `dapo` + `clip` are all present, send a low-impact command (e.g. `status` or `playpause` with no state change expectation) to set `controlAvailable`. If probe fails, set `controlAvailable: false` and `controlReason: "dacp_probe_failed"`.

## Public API

### Extended playback state

Add to `toPublicState()` output:

```json
{
  "controlAvailable": true,
  "controlReason": null
}
```

When unavailable:

```json
{
  "controlAvailable": false,
  "controlReason": "no_session"
}
```

`controlReason` enum:

| Value | Meaning |
|-------|---------|
| `null` | Control available |
| `no_session` | No active AirPlay session / missing daid,dapo,clip |
| `dacp_probe_failed` | Probe command failed |
| `ios_blocked` | Commands send but sender ignores (detected after failed action) |
| `ap2_unsupported` | Sender on AirPlay 2 without DACP |

### Control endpoint

```
POST /api/control/:action
```

| `action` | Behavior |
|----------|----------|
| `play` | Send `play` |
| `pause` | Send `pause` |
| `toggle` | Send `playpause` |
| `next` | Send `nextitem` |
| `prev` | Send `previtem` |

**Response (success):**

```json
{ "ok": true, "action": "pause" }
```

**Response (failure):**

```json
{ "ok": false, "action": "pause", "reason": "dacp_probe_failed" }
```

HTTP status: `200` for structured failure (UI handles); `503` only if service not initialized.

**Guards:**

- Return `{ ok: false, reason: "no_session" }` if `controlSession` incomplete
- Return `{ ok: false, reason: "control_unavailable" }` if `controlAvailable === false`
- Do not optimistically set `isPlaying` in local state; wait for metadata pipe confirmation

## UI requirements

**Location:** Transport row below progress bar on main dashboard (`src/views/index.ejs`, `src/public/js/live.js`).

**Buttons:** Previous | Play/Pause (single toggle) | Next

**States:**

| State | Appearance |
|-------|------------|
| `controlAvailable` | Buttons enabled |
| `!controlAvailable` | Buttons disabled; tooltip explains reason |
| No track (`!title`) | Buttons hidden or disabled |
| Request in flight | Brief loading state on clicked button |

**Accessibility:** `aria-label` on each button; keyboard focusable.

**No false success:** If POST returns `ok: false`, show non-blocking toast or inline message (not alert()).

## New modules (implementation checklist)

| File | Responsibility |
|------|----------------|
| `src/lib/dacpClient.js` | HTTP DACP commands, probe, error mapping |
| `src/services/playbackControlService.js` | Hold `controlSession`, expose `sendAction()`, probe logic |
| `src/lib/metadataPipeReader.js` | Parse `daid`, `dapo`, `clip` |
| `src/services/airplayMetadataService.js` | Forward session fields to control service |
| `src/index.js` | `POST /api/control/:action` route |

## Acceptance test matrix

Run with `./bin/run-local.sh --debug`. Mark steps via `/debug` UI.

| # | Sender | AP mode | App | Action | Expected |
|---|--------|---------|-----|--------|----------|
| 1 | iPhone | Classic | Apple Music | Pause while playing | Sender pauses; UI shows paused within 2s |
| 2 | iPhone | Classic | Apple Music | Resume | Sender resumes |
| 3 | iPhone | Classic | Apple Music | Next track | New title in UI |
| 4 | iPhone | Classic | Apple Music | Prev track | Previous title or restart |
| 5 | iPhone | Classic | Spotify | Pause | Same as Music (may differ) |
| 6 | Mac | Classic | Music.app | Pause / next | Commands work |
| 7 | iPhone | AP2 only | Any | Any | `controlAvailable: false`, reason `ap2_unsupported` |
| 8 | Any | Classic | Any | Control with AirPlay Status deselected | `no_session` |

Record iOS version on each iPhone test. If iOS 17.4+ ignores commands, document as known limitation — UI must show `ios_blocked` after confirmed failure, not pretend success.

## Spike (required before full UI)

1. Log raw `daid`, `dapo`, `clip` on connect (already partially visible in debug logs)
2. Manually curl DACP URL from Mac terminal during active session
3. Implement minimal `dacpClient.send('pause')` and verify iPhone/Mac response
4. Only proceed to UI if at least one sender device responds

## Out of scope (P1)

- Volume up/down
- Seek / scrub within track
- Control when AirPlay Status is not selected as output
- Control via Siri or shortcuts
- Spotify Connect API (different protocol; not AirPlay)

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| iOS ignores DACP | Probe + honest UI; document iOS version in README |
| `clip` is IPv6 link-local | Prefer routable address if multiple `clip` events; allow manual override in debug |
| Stale session after reconnect | Clear session on `aend`; re-probe on new `abeg` |
| User expects control without AirPlay Status | Empty-state copy explains receiver must be selected |

## Success criteria

- [ ] DACP session parsed from metadata pipe
- [ ] `POST /api/control/*` implemented with structured errors
- [ ] Dashboard shows transport buttons with correct enabled/disabled state
- [ ] Works on at least one primary device (iPhone **or** Mac) in Classic AirPlay mode
- [ ] Failures documented in UI, not silent no-ops

## References

- [shairport-sync metadata reader](https://github.com/mikebrady/shairport-sync-metadata-reader) — ssnc codes including `daid`, `dapo`, `clip`
- [shairport-sync #223](https://github.com/mikebrady/shairport-sync/issues/223) — D-Bus remote control (Linux; not used here)
- [shairport-sync #1858](https://github.com/mikebrady/shairport-sync/issues/1858) — MQTT/DACP ignored on iOS 17.4+

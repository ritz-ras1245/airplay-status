# P1 transport controls — Pi / device validation

**Branch:** `feat/cursor/p1-remote-control`  
**Do not merge until this checklist is filled from a real Pi + phone session.**

The Pi stays **AirPlay 2**. This PR does **not** switch the receiver to Classic/AP1.

## What shipped

| Surface | Transport (prev / play-pause / next) |
|---------|--------------------------------------|
| Web `/` | Yes — `POST /api/control/:action` (JSON fetch) |
| eInk `/eink` (Kindle browser) | Yes — HTML forms, same API, 303 back to `/eink` |
| eInk PNG `/api/display/*.png` | **No** — not implemented; static image cannot take input |
| Tidbyt | **No** — display-only |

Same DACP client for web and `/eink`. Same `controlAvailable` / `controlReason` honesty.

## Protocol limitations (expected, not a failed deploy)

| Situation | Expected UI |
|-----------|-------------|
| iPhone in **AP2** group (HomePods + AirPlay Status) | Buttons **disabled**, reason `ap2_unsupported` (no DACP/MRP on this receiver) |
| Native second iPhone/iPad Now Playing | **Works** (Apple MRP). Our dashboard **cannot** clone that on AP2 |
| Classic AirPlay / Mac Music.app | Buttons **may** enable if `daid`+`dapo`+`clip` appear and DACP probe reaches the sender |
| iOS 17.4+ even on classic | Commands may send and **do nothing** (`ios_blocked` — confirm in notes below) |
| AirPlay Status not selected | `no_session` |

## PR steps (run on Pi after deploy)

### A — Smoke (no AirPlay required)

- [ ] `curl -sf http://<pi>:3003/api/version` returns JSON
- [ ] Open `http://<pi>:3003/` — dashboard loads
- [ ] Open `http://<pi>:3003/eink` — high-contrast page, 60s refresh, transport row visible (likely disabled)

### B — AP2 multi-room (upgrade path — must not regress)

- [ ] iPhone can select **speakers + AirPlay Status** together
- [ ] Web shows title/art while grouped
- [ ] Record: transport enabled? **yes / no**
- [ ] If no: confirm hint mentions AirPlay 2 / MRP (not a blank fail)
- [ ] `/eink` shows the same enabled/disabled state as web

### C — DACP session log (debug)

On Pi, with `METADATA_DEBUG=1` for one session (then turn off):

- [ ] Connect iPhone (AP2 group) and note whether logs contain `daid`, `dapo`, `clip`, `acre`
- [ ] Connect Mac Music if available; note the same four codes
- [ ] Paste a short excerpt in the PR (no personal IPs required — redact)

### D — If DACP fields exist (classic / Mac)

- [ ] Pause from **web** — sender pauses within ~2s
- [ ] Play/resume from web
- [ ] Next / prev from web
- [ ] Repeat pause from **`/eink`** (Kindle or Safari in eink mode)
- [ ] Failed command shows flash/reason, not a silent success

### E — Surfaces that must stay read-only

- [ ] Tidbyt still updates metadata only (no control expectation)
- [ ] No PNG control path claimed in UI copy

## Merge bar

Merge when A + B pass (AP2 listening still works, UI honest).  
C–D are **bonus** if a sender actually advertises DACP; failure of D on iPhone AP2 is **in spec**, not a reason to revert AP2.

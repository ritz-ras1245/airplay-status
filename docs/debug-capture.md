# Debug capture for AirPlay metadata

Use this workflow when debugging pause, resume, track changes, disconnect, or any live metadata behavior.

## Quick start

**Terminal 1** — receiver (if not already running):

```bash
./bin/run-shairport.sh
```

**Terminal 2** — dashboard with capture:

```bash
chmod +x bin/run-debug.sh   # once
./bin/run-debug.sh
```

Open **http://localhost:3003?debug=1** — shows numbered test buttons.

## What gets captured

| Output | Location | Contents |
|--------|----------|----------|
| Timestamped console | Terminal 2 | `HH:MM:SS` prefix on every line |
| Log file | `/tmp/airplay-status-debug.log` (override with `DEBUG_LOG=`) | Full untimestamped copy via `tee` |
| Test marks | Both | `[meta HH:MM:SS.mmm] >>> TEST MARK: <label>` |
| Raw pipe events | Both (when `METADATA_DEBUG=1`) | `[meta …] raw ssnc/pend`, parsed updates, state transitions |

## Test procedure

1. Tap a **UI button** (1–6) *before* the iPhone action.
2. Perform the action on iPhone.
3. Wait ~2–3 seconds before the next button.
4. Reply **done** in chat so the agent can read the log.

### Standard sequence

| Button | iPhone action |
|--------|---------------|
| 1 Play | Start music, select AirPlay Status + speakers |
| 2 Pause | Pause |
| 3 Resume | Resume |
| 4 Next | Skip track |
| 5 Pause | Pause again |
| 6 Disconnect | Deselect AirPlay Status |

## Reading the log

Useful grep (binary-safe):

```bash
grep -a -E "TEST MARK|state title|pend|pbeg|aend|pause|prsm|pfls" /tmp/airplay-status-debug.log
```

Key shairport-sync codes:

| Code | Meaning |
|------|---------|
| `abeg` / `aend` | AirPlay session start / end (disconnect → `aend`) |
| `pbeg` / `pend` | Play stream start / end (Apple Music pause → `pend`, not `pause`) |
| `pfls` + `prsm` | Buffer flush during pause (ignore `prsm` after `pfls`) |
| `core/minm` | Track title |

**Connect quirks:** Apple Music may send a spurious `pend` within ~3s of `pbeg` on connect, then `aend` ~10s later while the iPhone still shows AirPlay active. The server ignores only that connect-time `pend`/`aend` pair — real pause `pend` and disconnect `aend` are always honored.

## Environment variables

| Variable | Default | Effect |
|----------|---------|--------|
| `METADATA_DEBUG` | `1` in `run-debug.sh` | Verbose pipe logging |
| `DEBUG_LOG` | `/tmp/airplay-status-debug.log` | Tee destination |

## API

```bash
curl -X POST http://localhost:3003/api/debug/mark \
  -H 'Content-Type: application/json' \
  -d '{"label":"manual step"}'
```

Test marks always log (even without `METADATA_DEBUG`). Raw pipe events require `METADATA_DEBUG=1`.

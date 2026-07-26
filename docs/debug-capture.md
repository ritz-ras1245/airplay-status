# Debug capture for AirPlay metadata

Only available when started with `./bin/run-local.sh --debug`.

## Run

```bash
./bin/run-local.sh --debug
```

- Dashboard: http://localhost:3003
- Debug UI: http://localhost:3003/debug (or `/?debug=1`)
- Log file: `/tmp/airplay-status-debug.log`

Normal `./bin/run-local.sh` has no debug UI — `/debug` and `/?debug=1` redirect to `/`.

## Test procedure

1. Tap a **UI button** (1–6) at `/debug` before each iPhone action
2. Wait ~2–3 seconds between steps
3. Reply **done** — agent reads the log:

```bash
grep -a -E "TEST MARK|state title|pend|pbeg|aend" /tmp/airplay-status-debug.log
```

## Key events

| Code | Meaning |
|------|---------|
| `pbeg` / `pend` | Play stream start / end (pause on Apple Music) |
| `aend` | Session ended → clear UI |
| `pfls` + `prsm` | Buffer flush on pause (ignore `prsm` after `pfls`) |

Connect quirk: spurious `pend` within ~3s of `pbeg` is ignored, as is the following `aend`.

# Multi-speaker AirPlay from iPhone

## Symptom

On iPhone, you can select **either** your HomePods / AirPlay 2 speakers **or** **AirPlay Status**, but not both in the same multi-room group. Tapping one AP2 speaker shows checkmarks on other AP2 devices only — **AirPlay Status** never joins the group.

## Root cause (confirmed)

| Factor | This project today (macOS dev) |
|--------|------------------------------|
| **Protocol** | Homebrew `shairport-sync` is **AirPlay 1 (classic)** only — no `--with-airplay-2` in the formula |
| **Advertisement** | `_raop._tcp` on port **5000** (classic RAOP) |
| **iOS behavior** | Multi-select in the AirPlay menu groups **AirPlay 2 endpoints only** |
| **Mixed AP1 + AP2** | iOS stops playback or refuses to start when mixing classic and AP2 targets |

Your speculation is correct: **AirPlay 1 is the reason**, not a bug in airplay-status Node code.

### Why macOS cannot run an AP2 receiver

From [shairport-sync AIRPLAY2.md](https://github.com/mikebrady/shairport-sync/blob/master/AIRPLAY2.md):

> Shairport Sync can **not** run in AirPlay 2 mode on a Mac because **NQPTP** needs ports **319** and **320**, which are already used by macOS.

Homebrew also does not ship `nqptp` or an AirPlay 2 build of shairport-sync.

Check your install:

```bash
shairport-sync -V
# macOS Homebrew: …dns_sd-ao-…-metadata…  (no airplay-2)
./bin/check-sidecar.sh
```

## Fix: AirPlay 2 receiver on Linux (Pi)

Run **AirPlay Status** on a Raspberry Pi (or Linux host) with AirPlay 2 enabled. Then iPhone can select **speakers + AirPlay Status** in one group.

1. Install **nqptp** and build **shairport-sync** with `--with-airplay-2` — see [shairport-sync BUILD.md](https://github.com/mikebrady/shairport-sync/blob/master/BUILD.md)
2. Copy [config/shairport-sync-airplay2.conf.example](../config/shairport-sync-airplay2.conf.example) to the Pi
3. Start **nqptp** then **shairport-sync** (port **7000**, `_airplay._tcp`)
4. Run the Node dashboard on the same Pi (or another LAN host reading the metadata pipe)

P5 deployment spec covers Pi layout; this doc is the multi-room-specific requirement.

## macOS development workarounds

| Approach | Multi-room from iPhone? | Metadata? |
|----------|-------------------------|-----------|
| Select **only AirPlay Status** | N/A (single target) | Yes |
| Select **only** real speakers | N/A | No (not streaming to receiver) |
| **Pi/Linux AP2** receiver on LAN | **Yes** | Yes |
| AirPlay from **Mac** (not iPhone) | Sometimes more outputs; mixed AP1+AP2 still unreliable | Varies |

There is **no config tweak** on Mac Homebrew shairport-sync to enable iPhone multi-room with AP2 speakers.

## References

- [shairport-sync AIRPLAY2.md](https://github.com/mikebrady/shairport-sync/blob/master/AIRPLAY2.md)
- [nqptp](https://github.com/mikebrady/nqptp)
- Apple Community: [AirPlay 1 & 2 simultaneously](https://discussions.apple.com/thread/250623491)

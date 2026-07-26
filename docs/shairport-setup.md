# shairport-sync Sidecar Setup

This guide covers Phase 3: running **AirPlay Status** as a virtual AirPlay receiver that captures metadata.

## Prerequisites

- macOS with Homebrew
- Node.js v20+
- Same Wi‑Fi network as your phone/Mac when AirPlaying

## One-time setup

```bash
chmod +x bin/*.sh
./bin/setup-sidecar.sh
```

This will:

1. Install `shairport-sync` via Homebrew
2. Clone and build [shairport-sync-metadata-reader](https://github.com/mikebrady/shairport-sync-metadata-reader) into `vendor/`
3. Copy `config/shairport-sync.conf.example` to `~/.config/shairport-sync/shairport-sync.conf` (if missing)

Verify metadata support:

```bash
shairport-sync -V
# Should include the word "metadata"
```

## Running the sidecar

**Terminal 1 — start the AirPlay receiver:**

```bash
./bin/run-shairport.sh
```

**AirPlay Status** should appear in your device's AirPlay picker.

**Terminal 2 — read human-readable metadata:**

```bash
./bin/read-metadata.sh
```

**Or stream JSON state (for debugging / Phase 4):**

```bash
npm run watch:metadata
```

**Or run both together:**

```bash
./bin/run-local.sh
```

## Using it

1. Start playback on iPhone or Mac
2. Open AirPlay and select **both** your real speakers and **AirPlay Status**
3. Metadata lines (or JSON) should appear in Terminal 2

When you stop playback or disconnect, the reader emits an empty state.

## Configuration

Edit `~/.config/shairport-sync/shairport-sync.conf`:

| Setting | Purpose |
|---|---|
| `general.name` | Name shown in AirPlay picker (`AirPlay Status`) |
| `pipe.name = "/dev/null"` | Discards audio — metadata only |
| `metadata.pipe_name` | FIFO path for metadata (`/tmp/shairport-sync-metadata`) |

## Troubleshooting

**Receiver not in AirPlay list**

- Ensure `shairport-sync` is running (`./bin/run-shairport.sh`)
- Check firewall allows local mDNS/Bonjour
- Restart Wi‑Fi on sender device

**No metadata in reader**

- Confirm you selected **AirPlay Status** as an output (not just your speakers)
- Check pipe exists: `ls -l /tmp/shairport-sync-metadata`
- Rebuild reader: `make -C vendor/shairport-sync-metadata-reader`

**Metadata reader not found**

```bash
./bin/setup-sidecar.sh
```

**Audio echo / unwanted sound**

- Config must use `output_backend = "pipe"` with `name = "/dev/null"`
- Do not use `ao` or `alsa` backends for this project

## Next: Phase 4

Phase 4 wires the metadata watcher into the Express dashboard at http://localhost:3003.

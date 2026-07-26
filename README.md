# AirPlay Status

A local dashboard that shows what's playing on your AirPlay speakers — from any app.

Add **AirPlay Status** as an extra AirPlay output alongside your real speakers. A background receiver captures track metadata (title, artist, album, artwork) while discarding the audio. A Node.js server renders it in your browser.

## How It Works

```
Your device (Music, Spotify, etc.)
    ├──► Your speakers        (you hear this)
    └──► AirPlay Status       (metadata only → this dashboard)
```

## Prerequisites

- macOS (primary) or Linux
- Node.js v20+
- [Homebrew](https://brew.sh) (macOS)
- shairport-sync with metadata support (Phase 3)

## Quick Start

> Phase 1 is documentation and scaffolding only. The dashboard arrives in Phase 2.

```bash
# Clone (after GitHub repo is created)
git clone https://github.com/<USER>/airplay-status.git
cd airplay-status

# Install Node dependencies (Phase 2+)
npm install

# Start the dashboard (Phase 2+)
npm start
# → http://localhost:3003
```

## Running with Live AirPlay Metadata (Phase 3+)

### 1. Install shairport-sync

```bash
brew install shairport-sync
```

Verify metadata support:

```bash
shairport-sync -V
# Output should include the word "metadata"
```

### 2. Configure the receiver

Copy the example config and edit as needed:

```bash
mkdir -p ~/.config/shairport-sync
cp config/shairport-sync.conf.example ~/.config/shairport-sync/shairport-sync.conf
```

Key settings: receiver name **"AirPlay Status"**, metadata pipe enabled, dummy audio output.

### 3. Start shairport-sync

```bash
shairport-sync -c ~/.config/shairport-sync/shairport-sync.conf
```

The receiver appears in your AirPlay picker as **AirPlay Status**.

### 4. Start the dashboard

```bash
npm start
```

Or use the wrapper script (Phase 5):

```bash
./bin/run-local.sh
```

### 5. Play music

On your iPhone or Mac, start playback and select **both** your real speakers and **AirPlay Status** as outputs. Open http://localhost:3003 to see the track info.

## Development Phases

| Phase | Description |
|---|---|
| 1 | Spec, docs, project scaffolding |
| 2 | Wireframe UI with mock data |
| 3 | shairport-sync sidecar + metadata reader |
| 4 | Live metadata in dashboard |
| 5 | Service setup, install scripts, troubleshooting |

See [docs/spec.md](docs/spec.md) for the full technical specification.

## Project Docs

- [docs/spec.md](docs/spec.md) — architecture, data model, API, phases
- [AGENTS.md](AGENTS.md) — context for AI assistants continuing this work

## Limitations

- You must select **AirPlay Status** as an output each time you play (or save an AirPlay group).
- Metadata quality depends on the source app (Apple Music is best; some apps send little or no artwork).
- Local network only — sender and receiver must be on the same LAN.

## License

MIT

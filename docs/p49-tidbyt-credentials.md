# P49 — Tidbyt credentials on the Pi

Tidbyt push needs **credentials** + **pixlet** on the host running `airplay-status` (your Pi). Secrets never go in git.

---

## What gets installed automatically

`deploy/rpi/install.sh` now installs:

- **pixlet** (`linux_arm64` from [tidbyt/pixlet releases](https://github.com/tidbyt/pixlet/releases))
- **One-time setup token** (if `TIDBYT_*` not in `.env` yet)

---

## Credential options (pick one)

| Option | Best for | How |
|--------|----------|-----|
| **A. Web upload (recommended)** | iPhone or Mac on same Wi‑Fi | Open URL from install output → upload `tidbyt.env` |
| **A1. Mac export → iPhone upload** | Creds on Mac; upload from phone | `./bin/tidbyt-creds-mac.sh` → AirDrop `.local/tidbyt.env` |
| **A2. Mac direct upload** | Skip iPhone | `./bin/tidbyt-creds-mac.sh --upload 'http://…/setup?token=…'` |
| **B. SCP + apply script** | File in iCloud / Files app | Copy `config/deploy/tidbyt.env.example` → fill on phone → `scp` → `apply-secrets-file.sh` |
| **C. SSH + nano** | Comfortable on terminal | Edit `/opt/airplay-status/.env` directly |
| **D. Mac push only** | Pi has no pixlet (not our Pi path) | Run `./bin/push-tidbyt.sh` on Mac against Pi API — manual, no auto loop |

### A. One-time web upload

After `install.sh`, output includes:

```text
Secrets setup: http://192.168.x.x:3003/setup?token=<hex>
```

1. On iPhone Safari or Mac browser (same LAN as Pi), open that URL **once**.
2. Choose your `tidbyt.env` file (can live in **iCloud Drive / Files**).
3. Upload → merges into `/opt/airplay-status/.env` → **Tidbyt push starts immediately** (no restart).

The `/setup` page **stops working** after a successful upload (token deleted).

### A1. Mac export (AirDrop / iCloud → iPhone)

From your Mac clone (creds in env or repo `.env`):

```bash
export TIDBYT_DEVICE_ID=… TIDBYT_API_TOKEN=…   # or already in .env
./bin/tidbyt-creds-mac.sh
```

Writes **`.local/tidbyt.env`** (gitignored, mode `600`). AirDrop or iCloud that file to iPhone, then use option **A** above.

### A2. Mac direct upload (no iPhone)

Same env vars; POST to the one-time setup URL from install output:

```bash
./bin/tidbyt-creds-mac.sh --upload 'http://airplay-beta.local:3003/setup?token=<hex>'
```

Tidbyt enables on the Pi immediately (same as the web form).

### B. iCloud / Files file + SCP

1. Duplicate [config/deploy/tidbyt.env.example](../config/deploy/tidbyt.env.example) in Files (iCloud).
2. Fill `TIDBYT_DEVICE_ID` and `TIDBYT_API_TOKEN` (Tidbyt app → Settings → API key).
3. From Mac:

```bash
scp ~/path/to/tidbyt.env airplay@airplay-beta.local:~/
ssh airplay@airplay-beta.local \
  'sudo /opt/airplay-status/bin/apply-secrets-file.sh ~/tidbyt.env && sudo systemctl restart airplay-status'
```

### C. SSH edit

```bash
sudo nano /opt/airplay-status/.env
# add TIDBYT_DEVICE_ID, TIDBYT_API_TOKEN
sudo systemctl restart airplay-status
```

---

## Verify Tidbyt

```bash
sudo journalctl -u airplay-status -n 40 | grep -i tidbyt
# expect: Tidbyt push enabled (pixlet: /usr/local/bin/pixlet)

cd /opt/airplay-status && ./bin/push-tidbyt.sh   # one-shot while playing
```

---

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `TIDBYT_DEVICE_ID` | Yes | From Tidbyt app |
| `TIDBYT_API_TOKEN` | Yes | From Tidbyt app |
| `TIDBYT_INSTALLATION_ID` | No | Default `airplaystatus` |
| `DISABLE_TIDBYT` | No | Set to `1` to force off (`.env`, export, or systemd) |

**Auto-enable:** when both `TIDBYT_DEVICE_ID` and `TIDBYT_API_TOKEN` are set, push starts at boot (or immediately after web upload). No `TIDBYT_ENABLED` flag.

---

## Allowed keys (setup upload / apply script)

Setup upload and `apply-secrets-file.sh` accept **Tidbyt creds only**:

- `TIDBYT_DEVICE_ID`
- `TIDBYT_API_TOKEN`
- `TIDBYT_INSTALLATION_ID` (optional)

Use `DISABLE_TIDBYT=1` separately in `.env` or systemd if you need to suppress push without removing creds.

---

## Security notes

- Setup URL is **LAN-only** in practice; token is random 32-char hex, **single use**.
- No HTTPS on `:3003` — acceptable for home LAN one-time provisioning.
- Do **not** commit filled `tidbyt.env` or `.env`.
- iCloud copy is fine if your threat model accepts it (same as password manager export).

---

## Future (not implemented)

- Interactive SSH wizard (`bin/setup-tidbyt-creds.sh` prompts)
- QR code on Pi HDMI showing setup URL
- Keychain / 1Password CLI pull on Mac during `p49-install-rpi.sh`
- CI/CD deploy so Pi picks up code without manual patching

See [integrations/tidbyt/README.md](../integrations/tidbyt/README.md) · [specs/p2-tidbyt.md](../specs/p2-tidbyt.md)

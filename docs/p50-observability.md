# P50 — Beta soak observability (Pi → Mac Grafana/Loki)

**Phase:** [specs/p50-beta-soak-observability.md](../specs/p50-beta-soak-observability.md)  
**Context:** P49 beta is live on RPi4. P50 = **soak the working beta** + **centralize logs on Mac** for timestamp debugging.

Ship **RPi journal logs** to **Loki + Grafana** on Mac (Docker). Logs retain **45 days** on Mac — nothing lost while you are offline.

**Not Grafana Cloud.** Home LAN only.

---

## Architecture

```text
Pi (airplay-beta)                    Mac (Docker)
┌─────────────────────┐              ┌──────────────────────────┐
│ systemd journal     │   HTTP push  │ Loki :3100 (LAN exposed) │
│ airplay-status      │ ───────────► │ Grafana :3030            │
│ shairport-sync      │  (Promtail)  │ optional Mac Promtail    │
│ nqptp               │              └──────────────────────────┘
└─────────────────────┘
```

Promtail on Pi **tails journald continuously** (batched push ~1s). Retries if Mac is asleep; positions file avoids duplicates.

---

## 1. Mac — start stack (one time)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or `brew install --cask docker`).

```bash
cd airplay-status
chmod +x bin/observability-up.sh bin/observability-down.sh bin/query-loki.sh
./bin/observability-up.sh
```

Edit password:

```bash
cp config/observability/observability.env.example config/observability/observability.env
# set GF_SECURITY_ADMIN_PASSWORD
./bin/observability-up.sh
```

| Service | URL |
|---------|-----|
| **Grafana** | http://localhost:3030 |
| **Loki** | http://localhost:3100 |

Dashboard: **AirPlay Status Logs** (auto-imported).

**LAN push URL for Pi** (replace hostname):

```text
http://<mac-hostname>.local:3100/loki/api/v1/push
```

Find Mac hostname: `scutil --get LocalHostName` → `MacStudio.local` style mDNS.

**Firewall:** allow incoming **TCP 3100** from your LAN.

---

## 2. Pi — install Promtail (one SSH session)

Additive — does **not** restart airplay services. OK during P50 soak.

```bash
cd /opt/airplay-status   # or ~/airplay-status clone
git pull

LOKI_PUSH_URL=http://MacStudio.local:3100/loki/api/v1/push \
  sudo ./deploy/rpi/promtail/install-promtail.sh
```

Optional soak identity on Pi:

```bash
# in /opt/airplay-status/.env
DEPLOY_PHASE=p50
sudo systemctl restart airplay-status
```

Verify:

```bash
sudo systemctl status promtail
curl -s http://airplay-beta.local/api/version | jq .deployPhase
```

---

## 3. Slack → Cursor workflow

1. Note **timestamp** when something breaks on beta.
2. Slack: `@cursor error at 2026-07-27T03:15:00Z`
3. When back online on Mac:

```bash
./bin/query-loki.sh --around '2026-07-27T03:15:00Z' --window 10m
./bin/query-loki.sh --around '2026-07-27T03:15:00Z' --search 'error' --unit 'airplay-status.service'
```

4. Or Grafana → **Explore** → Loki:

```logql
{host="airplay-beta", unit="airplay-status.service"} |= "error"
```

---

## 4. Agent checklist

1. `curl -sf http://localhost:3100/ready`
2. Parse user timestamp → ISO-8601 UTC
3. `./bin/query-loki.sh --around '<ts>' --window 10m`
4. Units: `airplay-status.service`, `shairport-sync.service`, `nqptp.service`
5. Root-cause from log evidence — no guessing

---

## 5. Operations

| Task | Command |
|------|---------|
| Stop stack | `./bin/observability-down.sh` |
| Pi promtail | `ssh airplay@airplay-beta.local 'sudo journalctl -u promtail -f'` |
| Retention | 45 days (`loki-config.yml`) |

---

## P50 vs P99

| P50 (now) | P99 (later) |
|-----------|-------------|
| Pi → Mac Loki/Grafana | Structured `logger.js`, log dirs, SOPs |
| `query-loki.sh` + dashboard | `/api/health`, runbooks, launchd polish |
| Soak sign-off | Prod-ready sign-off |

Prometheus deferred (P99 stretch).

---

## Files

| Path | Role |
|------|------|
| `config/observability/` | Docker stack + configs |
| `deploy/rpi/promtail/install-promtail.sh` | Pi install |
| `bin/observability-up.sh` | Mac start |
| `bin/query-loki.sh` | Timestamp queries |

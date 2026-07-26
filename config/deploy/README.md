# Deploy stages

Stage presets in [stages.json](./stages.json). Override with `.env` on each host.

| Stage | iPhone AirPlay name | Dashboard title | Typical host |
|-------|---------------------|-----------------|--------------|
| **dev** | AirPlay Status | AirPlay Status | Mac Studio |
| **beta** | **AirPlay Status (Beta)** | AirPlay Status (Beta) | RPi4 P49 |
| **prod** | AirPlay Status | AirPlay Status | Prod Pi |

## P49 beta on Raspberry Pi

```bash
cp config/deploy/beta.env.example .env
./bin/render-shairport-config.sh --stage beta
# restart nqptp + shairport-sync + node with .env loaded
```

## Env vars

| Variable | Purpose |
|----------|---------|
| `DEPLOY_STAGE` | `dev` \| `beta` \| `prod` |
| `DEPLOY_PHASE` | `p49`, `p100`, … (infers stage if `DEPLOY_STAGE` unset) |
| `AIRPLAY_RECEIVER_NAME` | Name in iPhone AirPlay picker |
| `DASHBOARD_TITLE` | Browser tab / page heading |
| `PORT` | HTTP port (default 3003) |
| `LOG_LEVEL` | App log hint (`info`, `debug`) |
| `SHAIRPORT_LOG_VERBOSITY` | shairport-sync `log_verbosity` |

`GET /api/version` returns `deployStage`, `stageLabel`, and `airplayReceiverName`.

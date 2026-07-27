# Echo Show integration (P6 Tier B)

Push-on-play integration: **airplay-status** → API Gateway webhook → Lambda → Alexa Routines custom trigger → user routine opens Silk to **`GET /echo`**.

Tier A (24×7 kiosk) is documented in [specs/p6-echo-show.md](../../specs/p6-echo-show.md) but **not implemented** in P6.

## Layout

| Path | Purpose |
|------|---------|
| `template.yaml` | AWS SAM — API Gateway `POST /trigger` + skill Lambda |
| `lambda/trigger/` | Webhook → Routines Trigger Instance REST API |
| `lambda/skill/` | OpenURL APL + Routines SPI handlers |
| `skill/` | ASK manifest + interaction model (wire Lambda ARN manually) |
| `docs/` | DNS, routine, LWA token, Fire TV |

## Prerequisites

- AWS account, SAM CLI (`sam build`, `sam deploy --guided`)
- Amazon Developer account (dev skill — no public certification in P6)
- Echo Show on same LAN as airplay-status host
- DNS or raw LAN IP for `ECHO_DISPLAY_URL` — see [docs/dns-setup.md](docs/dns-setup.md)

## Deploy (SAM)

```bash
cd integrations/echo
sam build
sam deploy --guided
```

Note outputs:

- **EchoWebhookUrl** → `ECHO_PUSH_WEBHOOK_URL` in airplay-status `.env`
- **EchoPushSecret** parameter → same value in `.env` and Lambda env
- **SkillFunctionArn** → Alexa Developer Console endpoint

## airplay-status `.env`

```bash
ECHO_PUSH_WEBHOOK_URL=https://….execute-api.us-east-1.amazonaws.com/prod/trigger
ECHO_PUSH_SECRET=your-shared-secret
# Optional — docs/default for skill Lambda:
# ECHO_DISPLAY_URL=http://192.168.x.x:3003/echo
```

Set `ECHO_PUSH_ENABLED=0` to suppress push (cyan hint on stderr).

## Alexa setup

1. Create dev skill from `skill/skill.json` + interaction model
2. Point endpoint to **SkillFunctionArn**
3. Enable **Routines** custom trigger `AirPlayStatusNowPlaying`
4. Follow [docs/routine-setup.md](docs/routine-setup.md)
5. Acquire LWA bearer token — [docs/lwa-dev-token.md](docs/lwa-dev-token.md)

## Verify

1. Load `ECHO_DISPLAY_URL` in Silk on Echo Show
2. `./bin/run-local.sh` on Mac (or Pi beta stack)
3. AirPlay to **AirPlay Status** — Echo routine should open `/echo` within ~5s
4. Change track — SSE updates without new routine fire

## Region

Use **`us-east-1`** for Alexa Routines Trigger Instance API (NA).

## References

- [specs/p6-echo-show.md](../../specs/p6-echo-show.md)
- [Custom Triggers for Routines](https://developer.amazon.com/en-US/docs/alexa/routines/introduction-to-custom-trigger-for-routines.html)

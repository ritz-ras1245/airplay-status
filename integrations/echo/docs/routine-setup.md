# Alexa routine setup (Tier B)

Wire the custom trigger from the **AirPlay Status** dev skill to open Silk on your Echo Show.

## Prerequisites

- Dev skill deployed with Routines custom trigger **AirPlay Status → Now Playing** (`AirPlayStatusNowPlaying`)
- `ECHO_DISPLAY_URL` loads in Silk (see [dns-setup.md](dns-setup.md))
- SAM deploy complete; airplay-status `.env` has webhook URL + secret

## Create the routine

1. Open **Alexa app** → **More** → **Routines**
2. **+** → name e.g. `AirPlay Now Playing`
3. **When this happens** → **Smart Home** or **Custom** (wording varies)
   - Select **AirPlay Status** → **Now Playing** (custom trigger)
4. **Add action** → **Custom action**
   - Utterance: `open airplay now playing`
   - This invokes `OpenNowPlayingIntent` on the skill
5. Save and enable the routine

## Expected flow

```
AirPlay track change
  → airplay-status POST webhook
  → Lambda fires Routines Trigger Instance (UNICAST)
  → Routine runs custom action
  → Skill returns OpenURL APL
  → Silk opens ECHO_DISPLAY_URL (/echo)
```

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Routine never fires | CloudWatch logs on trigger Lambda; verify `ALEXA_TARGET_BEARER_TOKEN` + `ALEXA_TARGET_USER_ID` |
| Routine fires, Silk blank | `ECHO_DISPLAY_URL` wrong or not reachable from Echo LAN |
| 401 on webhook | `ECHO_PUSH_SECRET` mismatch between `.env` and Lambda |
| Voice works, display does not | Skill endpoint ARN; OpenURL requires Echo Show (not all Fire TV models) |

## After testing

Voice, Spotify, alarms, and other routines should work normally after Silk closes or times out.

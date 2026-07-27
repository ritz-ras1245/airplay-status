# LWA dev token (Routines Trigger Instance API)

The trigger Lambda calls:

```
POST https://api.amazonalexa.com/v1/routines/triggerInstances
Authorization: Bearer <token>
```

Required scope: **`alexa::routines:triggerinstances:write`**

P6 uses a **dev per-user bearer token** in Lambda env `ALEXA_TARGET_BEARER_TOKEN`. Do not commit tokens to git.

## Minimal dev flow

1. **Security profile** — Amazon Developer Console → APIs → create LWA security profile for the skill
   - Note **Client ID** and **Client Secret** → Lambda env `ALEXA_SKILL_CLIENT_ID` / `ALEXA_SKILL_CLIENT_SECRET` (for future refresh; P6 scaffold may use static dev token)
2. **Enable skill** on your Amazon account (Echo Show same account)
3. **Account linking / consent** — grant Routines trigger scope to your user
4. Obtain bearer token via LWA authorization code flow or ASK CLI documented dev paths
5. Set Lambda env:
   - `ALEXA_TARGET_USER_ID` — `amzn1.ask.account.…` from skill user enablement
   - `ALEXA_TARGET_BEARER_TOKEN` — short-lived access token with routines scope

## Token refresh (production note)

P6 scaffold documents manual rotation. A production path would cache refresh tokens in SSM and refresh before expiry. See trigger Lambda `lib.js` — refresh hook is intentionally minimal.

## Verify token

```bash
curl -sS -X POST 'https://api.amazonalexa.com/v1/routines/triggerInstances' \
  -H "Authorization: Bearer $ALEXA_TARGET_BEARER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "triggerName": "AirPlayStatusNowPlaying",
    "targetType": "UNICAST",
    "targetDetails": { "userId": "'"$ALEXA_TARGET_USER_ID"'" }
  }'
```

Expect **202** or **204** on success (routine should fire if configured).

## References

- [Routines Trigger Instance REST API](https://developer.amazon.com/en-US/docs/alexa/routines/routines-custom-trigger-api-reference.html)
- [Login with Amazon](https://developer.amazon.com/en-US/docs/login-with-amazon/authorization-code-grant.html)

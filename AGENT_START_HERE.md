# Agent start here — P6 Echo Show

Use this file when a **Cursor Cloud agent** (or any autonomous agent) picks up the P6 feature branch. Read this document first, then execute.

## Pickup prompt

```
Pickup and analyse specs/p6-echo-show.md.
Take it from end to end to a PR.

In the PR body, add a checklist of manual steps to hook up Alexa, AWS, DNS,
and Echo Show, and test manually before approving and merging.

Follow specs/cloud-cursor-pr-standard.md.
```

## Workflow

1. **Branch:** Work on `feat/p6-echo-show` (or the branch that contains this file and the P6 spec).
2. **Read:** `specs/p6-echo-show.md` (implementation spec) and `specs/cloud-cursor-pr-standard.md` (PR rules).
3. **Implement:** All items in P6 **Implementation steps** and **Repository layout**.
4. **Test:** Run `npm test` and any other automated checks listed in the spec.
5. **Open PR** into `main` with the PR body template from P6 (manual Alexa/AWS/DNS checklist included).
6. **Do not merge** — human completes manual checklist on hardware before approving.

## Dev defaults (locked)

| Topic | Default |
|-------|---------|
| DNS / display URL | **Option D** — raw LAN IP, e.g. `http://192.168.x.x:3003/echo` |
| Host for testing | Node on macOS via `./bin/run-local.sh` |
| Repo layout | Monorepo — `integrations/echo/` for SAM + skill |

Echo Show loads the Mac LAN IP; Lambda never reaches the LAN.

## What you cannot do in cloud (document in PR only)

- Amazon Developer Console login, skill enable, routine creation
- `sam deploy` with real AWS credentials (unless user provided secrets in cloud env)
- Physical Echo Show verification

Implement and test everything that runs without those; copy the manual checklist from the spec into the PR body.

## Spec links

- [specs/p6-echo-show.md](specs/p6-echo-show.md)
- [specs/cloud-cursor-pr-standard.md](specs/cloud-cursor-pr-standard.md)

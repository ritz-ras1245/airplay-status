# P49 Docker spike

Deploy steps: [deploy/docker/README-WARN.md](../deploy/docker/README-WARN.md).

## Pass (Pi, home LAN)

- [ ] iPhone sees **AirPlay Status (Beta)**
- [ ] HomePods + AirPlay Status in one AirPlay group
- [ ] Dashboard metadata within ~5s
- [ ] `GET /api/version` → `deployPhase=p49`

## Fail

After ~1 day on **Pi** (Mac does not count):

- Discovery or AP2 multi-room still broken → document blocker in log below; adjust compose or host bootstrap.

## Log

| Date | Host | Result | Notes |
|------|------|--------|-------|
| 2026-07-26 | Mac + Docker Desktop | N/A for AirPlay | Stack OK; no iPhone discovery (see README limitations) |
| | Pi | | |

## Beta sign-off

[AGENT_START_HERE.md](../AGENT_START_HERE.md) · [specs/p49-preprod-deployment.md](../specs/p49-preprod-deployment.md)

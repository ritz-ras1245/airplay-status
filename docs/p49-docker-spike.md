# P49 Docker spike — pass/fail record

**Status:** SCAFFOLD template — fill in during Path A spike on RPi4.

**Plan:** [p49-beta-remote-deploy.md](./p49-beta-remote-deploy.md)  
**Compose:** [deploy/docker/](../deploy/docker/)

## Goal

Validate Docker **host network** on Pi for AirPlay 2 discovery and iPhone multi-speaker (HomePods + AirPlay Status).

## Pass criteria

- [ ] iPhone discovers receiver on LAN
- [ ] AP2 multi-room: real speakers + AirPlay Status in one group
- [ ] Metadata pipe reaches Node dashboard within ~5s
- [ ] `GET /api/version` shows `deployPhase=p49`

## Fail criteria (→ Path B bare metal)

After **~1 day** effort:

- iPhone cannot discover receiver, **or**
- AP2 multi-room fails with host-network compose, **or**
- nqptp UDP 319/320 cannot be satisfied in compose layout

## Spike log

| Date | Attempt | Result | Notes |
|------|---------|--------|-------|
| | | | |

## Decision

- [ ] **Path A accepted** — document run steps in `deploy/docker/README.md`
- [ ] **Path B** — use `deploy/rpi/install.sh` (see [deploy/rpi/README.md](../deploy/rpi/README.md))

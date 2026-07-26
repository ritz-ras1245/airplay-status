# Cloud Cursor PR Standard

**Status:** Active — apply to every spec marked **Cloud-PR ready**

Use this checklist when authoring a phase spec so a Cursor Cloud agent can implement end-to-end and open a PR **without human-in-the-loop during coding**. Human steps belong only in the PR body under **Manual setup & test** (post-merge or pre-merge approval gate).

## Agent entry point

For Cloud agents picking up a prepared feature branch, read **[AGENT_START_HERE.md](../AGENT_START_HERE.md)** at the repo root first. It contains the canonical pickup prompt and workflow for the active phase.

When authoring a new Cloud-PR-ready phase, add or update `AGENT_START_HERE.md` on the feature branch with that phase’s prompt and locked defaults.

## Agent pickup prompt (canonical)

```
Pickup and analyse <SPEC_PATH> (e.g. specs/p6-echo-show.md).
Take it from end to end to a PR.

In the PR body, add a checklist of manual steps to hook up external services
(Alexa, AWS, DNS, devices, etc.) and test manually before approving and merging.

Follow specs/cloud-cursor-pr-standard.md.
Do not commit secrets. Do not force-push.
```

Shorthand for humans starting a Cloud agent: *“Checkout `<branch>`, read `AGENT_START_HERE.md`, execute.”*

## Spec author requirements

Every Cloud-PR-ready spec MUST include these sections (P6 is the reference implementation):

| Section | Purpose |
|---------|---------|
| **Status / Depends on** | Phase ordering |
| **Goal** | One paragraph outcome |
| **Architecture** | Diagram + data flow; what runs where |
| **Repository split** | If multi-repo: which files in which repo, link strategy |
| **Decisions (locked)** | Defaults an agent must not re-litigate |
| **Open decisions** | Explicit `DECISION REQUIRED` blocks — agent stops and asks if unset |
| **Configuration** | Env vars, `.env.example` keys, no secret values |
| **File structure** | Exact paths to create/modify |
| **Implementation steps** | Numbered, ordered, verifiable |
| **Automated tests** | What runs in CI without hardware/cloud accounts |
| **Acceptance criteria** | `[ ]` items tagged `(automated)`, `(manual)`, or `(device)` |
| **Out of scope** | Prevents scope creep |
| **PR body template** | Copy-paste manual checklist for the implementer |

## Agent implementation rules

1. **Branch:** `feat/<phase>-<short-name>` from current default branch.
2. **Scope:** Only files listed in the spec (+ obvious wiring). No drive-by refactors.
3. **Secrets:** Never commit. Extend `.env.example` with empty placeholders only.
4. **Tests:** Add or extend tests called out in the spec. If the repo has no test runner yet, add the minimal one the spec defines.
5. **Docs:** Update `AGENTS.md` phase table and any integration README listed in the spec.
6. **Manual-only work:** Document in PR checklist — do not stub fake credentials or skip documenting AWS/Alexa steps.
7. **Multi-repo specs:** One PR per repo, cross-linked. Prefer monorepo when spec says so (e.g. P6).

## PR body template (required)

```markdown
## Summary
- …

## Automated verification
- [ ] … (commands run in cloud / CI)

## Manual setup & test (complete before merge)
- [ ] …
- [ ] …

## Spec
- specs/<phase>.md
```

## What Cloud agents cannot do (document, don’t fake)

- Amazon Developer account login, skill certification, LWA consent
- Physical Echo Show / Tidbyt / eInk hardware
- Router DNS / split-horizon changes on home network
- Issuing real API tokens or storing them in repo

## Definition of done (Cloud PR)

- [ ] All **Decisions (locked)** implemented as written
- [ ] All `(automated)` acceptance criteria pass locally in cloud sandbox
- [ ] `.env.example` updated; no secrets in diff
- [ ] PR body includes **Manual setup & test** checklist copied from spec
- [ ] `AGENTS.md` phase row updated

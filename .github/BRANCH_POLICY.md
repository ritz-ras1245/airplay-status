# Branch policy

**`main` is protected.** All work happens on named branches. **`main` receives merges only.**

## Branch naming (required)

```
{action}/{user}/{description}
```

| Segment | Examples | Notes |
|---------|----------|-------|
| **action** | `feat`, `fix`, `doc`, `chore`, `refactor`, `test`, `ci`, `spec`, `hotfix` | Lowercase |
| **user** | `ritz-ras1245`, `cursor`, `dependabot` | GitHub login, bot, or tool name |
| **description** | `add-airplay2-config`, `update-rule-standards` | kebab-case, concise |

**Examples**

- `feat/ritz-ras1245/add-multi-room-docs`
- `doc/cursor/update-rule-standards`
- `fix/cursor/session-end-clear-state`

**Exceptions** (semver patch lines per RVS):

- `release/1.x`, `release/2.x`, …

Enforced on GitHub (ruleset) and locally (`.githooks/pre-commit` blocks commits on `main`).

---

## Who merges how

| Actor | Work on | Merge to `main` |
|-------|---------|-----------------|
| **`ritz-ras1245`** (owner) | Named branch only | **No PR** — local merge + push (GitHub bypass) |
| **Bots, agents, other humans** | Named branch only | **Pull request required** |

Nobody commits directly on `main` locally — the pre-commit hook rejects it.

---

## Owner workflow (no PR)

```bash
git checkout main && git pull
git checkout -b feat/ritz-ras1245/my-change
# edit, commit
git checkout main && git pull
git merge feat/ritz-ras1245/my-change
git push origin main
git push origin --delete feat/ritz-ras1245/my-change  # optional cleanup
```

---

## Everyone else (PR required)

```bash
git checkout -b feat/cursor/my-change
git push -u origin HEAD
gh pr create --base main
# merge via GitHub UI or gh pr merge after review
```

---

## Setup (once per clone)

```bash
./bin/setup-git-hooks.sh
```

---

Enforced locally (`.githooks/`) and in CI (`.github/workflows/branch-policy.yml`). GitHub ruleset API for branch names is not available on this plan — naming is validated on push/PR instead.

---

## Cursor Cloud Agents — branch prefix

Cloud Agents auto-create a branch **before** the agent reads repo rules. The default `cursor/<slug>` **fails** CI (missing `{action}/` segment).

Configure **Branch prefix** once (account-level, not in this repo):

| Where | Path |
|-------|------|
| Cursor editor | **Settings → Cloud Agents → Branch prefix** |
| Web dashboard | [cursor.com/dashboard/cloud-agents#my-defaults](https://cursor.com/dashboard/cloud-agents#my-defaults) |

**Recommended default:** `feat/cursor` (no trailing slash). Cursor adds `/` + slug → `feat/cursor/my-change` ✓

| Task type | Set prefix to |
|-----------|---------------|
| Features (default) | `feat/cursor` |
| Documentation | `doc/cursor` |
| Bug fixes | `fix/cursor` |

The prefix is **static** — it cannot switch between `feat/` and `fix/` per task automatically ([Cursor forum](https://forum.cursor.com/t/cloud-agent-custom-branch-prefix-feat-fix-instead-of-cursor-and-commit-author-attribution/163698)). Change it in settings before launching a doc/fix agent, or start the agent on an existing compliant branch instead.

Repo rule: [`.cursor/rules/branch-policy.mdc`](../.cursor/rules/branch-policy.mdc)

| Ruleset | Target | Rules |
|---------|--------|-------|
| **Protect main** | `main` | Require PR; block force-push & deletion; **`ritz-ras1245` bypass** (merge without PR) |
| **Branch naming** | non-`main` | CI + local hooks — `{action}/{user}/{description}` or `release/N.x` |

Global release semver rules: `~/.cursor/rules/release-and-versioning.mdc`.

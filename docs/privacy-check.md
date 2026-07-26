# Privacy check (pre-push)

Before every `git push`, `.githooks/pre-push` runs `./bin/check-tracked-privacy.sh`.

## Blocks (strict mode — default)

- Secrets and API tokens
- Absolute paths (`/Users/...`, `/home/...`)
- Tilde paths (`~/workspace/...`, `~/Documents/...`)
- Tracked `.env`, `config/paths.json`

## Repo overrides

| File | Purpose |
|------|---------|
| `.privacy-check-mode` | `strict` (default) or `secrets-only` (private standards docs only) |
| `.privacy-check-allow` | Paths allowed to mention patterns (one per line) |
| `.privacy-check-must-ignore` | Extra paths that must never be tracked |

Global rule: `~/.cursor/rules/no-personal-info.mdc`

Full doc: private `engineering-standards` repo → `docs/privacy-check.md`

#!/usr/bin/env bash
# Point this clone at repo-managed git hooks (blocks commits on main).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/pre-push 2>/dev/null || true
chmod +x bin/check-tracked-privacy.sh 2>/dev/null || true

echo "Git hooks: core.hooksPath=.githooks"
echo "  pre-commit — blocks commits on main"
echo "  pre-push   — branch name + privacy check (tracked files)"
echo "Policy: .github/BRANCH_POLICY.md"
echo "Privacy: docs/privacy-check.md (or ~/.cursor/rules/no-personal-info.mdc)"

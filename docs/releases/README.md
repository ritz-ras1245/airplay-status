# Release records (airplay-status)

Per-ship YAML files for each semver (e.g. `1.0.0.yaml`). Schema matches **CanonicalReleaseRecord** in global RVS (Cursor rule `~/.cursor/rules/release-and-versioning.mdc` §3).

**When to add:** first **P100** prod ship and every patch (`1.0.1`, …).

**Future use:** GitHub Releases, Jira Fix Version, and ClickUp `Release` field should reference the same values from the record — no new strings at sync time.

## Template

```yaml
project: airplay-status
releaseLine: 1
semver: "1.0.0"
phaseGate: P100
phaseReadiness: P99
gitTag: "v1.0.0"
gitCommit: "abc1234"
branch: release/1.x
deployPhase: p100
githubRelease: "v1.0.0"
jiraFixVersion: "airplay-status-1.0.0"
clickupRelease: "1.0.0"
releasedAt: "2026-07-26"
```

Filename: `{semver}.yaml` (no `v` prefix).

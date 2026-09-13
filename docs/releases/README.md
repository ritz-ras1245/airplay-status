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

## Annotated release tags (P49 artifacts)

Tarball name is `airplay-status-<tag>-linux-aarch64.tar.gz`. **Use annotated tags** (not lightweight) so `git describe` and `./bin/p49-build-release.sh` pick a real message + tagger.

Repo habit matches the template above: `v` + semver (`v1.0.0` at P100). Pre-P100 we are **`0.y.z`** (now `0.1.0`).

```bash
# Named artifact matching package.json
git tag -a v0.1.0 -m "airplay-status 0.1.0

P49 linux/arm64 release artifact.
Build: ./bin/p49-build-release.sh
Push:  ./bin/p49-push-release.sh rasohoni@pi.home.arpa
"

git push origin v0.1.0
./bin/p49-build-release.sh          # uses the annotated tag when HEAD matches
```

Rebuilds without bumping semver:

```bash
git tag -a v0.1.0-p49.1 -m "airplay-status 0.1.0 — P49 artifact rebuild 1"
./bin/p49-build-release.sh --tag v0.1.0-p49.1
```

Untagged HEAD builds `v<semver>-<shortsha>` (e.g. `v0.1.0-abc1234`) so local iterates stay identifiable.

Lightweight `git tag v0.1.0` (no `-a`) is **not** the habit — `git describe` and release records expect annotated tags.

CI: push of `v*` or `p49-*` annotated tags can build the same tarball (`.github/workflows/p49-build-release.yml`).

# Issue #144 — selected GSC property scope v3

- Worktree: `/Users/tomaszboloz/.codex/worktrees/task144-gsc-selection/seomi`
- Base ref: `2f727833eaef531d48569042d970c0ed3849b986`
- v3 source correction: exact URL-prefix identities preserve pathname slash semantics, so `/blog` and `/blog/` are distinct properties. Removed the unnecessary `exactTestProperty` alias; `exactProperty` is the sole adapter flag.
- No commit, push, release, version, workflow, GitHub, credential, or Cargo changes.

## Canonical v3 validation

All commands used the Python `fcntl` wrapper and the shared `/tmp/seomi-gemini-validation.lock`; cwd was the task worktree.

| Result | Evidence | Status |
|---|---|---|
| Targeted Vitest | `locked-targeted-v3-vitest.log`: 8 files, 36 tests | PASS |
| TypeScript | `locked-tsc-v3.log` | PASS |
| Lint | `locked-lint-v3.log` | PASS |
| LOC | `locked-loc-v3.log`: 4320 files, 0 violations | PASS |
| Version | `locked-version-v3.log`: 0.4.41 synchronized | PASS |
| Diff | `locked-diff-v3.log` | PASS |

The preceding v2 full-suite run was also lock-protected and passed 1378 files / 11371 tests, but it predates the slash-semantics correction and is retained only as historical evidence. Full v3 was not claimed.

## Artifacts

- Combined v3 patch (tracked plus untracked): `/tmp/seomi-gemini-20261024-1553/task144-gsc-selection-v3.patch`
- Combined patch SHA-256: `59c1d4b48e237623be5eed9906ff12c4aa39d70a61c431504f842f66ab233543`
- v3 manifest: `/tmp/seomi-gemini-20261024-1553/task144-gsc-selection-v3.manifest.json`
- v3 validation logs: `/tmp/seomi-gemini-20261024-1553/task144-gsc-logs-v2-team/`
- Prior v1/v2 artifacts remain preserved.

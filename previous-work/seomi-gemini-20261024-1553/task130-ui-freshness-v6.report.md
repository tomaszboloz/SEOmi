# Issue #130 UI freshness v6

Worktree: `/Users/tomaszboloz/.codex/worktrees/task130-ui-freshness/seomi`
Base HEAD: `2f727833eaef531d48569042d970c0ed3849b986`

## v6 corrections

- Added the shared `isCompletedCrawlRun` evidence guard: task verification and selected UI baselines now require a non-cancelled, non-timed-out run with a valid `completedAt`.
- Added `isSelectedCompletedCrawl` so LinksWorkspace score baselines are null unless the displayed pages are the selected completed run's exact page snapshot.
- Updated completed-crawl test fixtures with valid completion timestamps while retaining intentional unknown/invalid freshness cases.
- Added mounted regressions for timed-out, cancelled and invalid-completion runs: CTA baselines stay null, manual verification stays implemented, and metric history stays empty.
- Added a positive automatic-verification regression proving a completed crawl records a real score delta.

## Validation

- Focused Vitest under `/tmp/seomi-gemini-validation.lock` via macOS `lockf`: PASS, 6 files / 50 tests.
- Full Vitest under the same lock: PASS, 1,378 files / 11,394 tests.
- `rtk npx tsc --noEmit`: PASS.
- `rtk npm run lint`: PASS.
- `rtk npm run check:loc`: PASS, 0 violations at limit 150.
- `rtk npm run version:check`: PASS, version 0.4.41 synchronized.
- `rtk git diff --check`: PASS.

Validation used a temporary symlink to existing `release-next/seomi/node_modules`; it was removed after validation. No dependency installation, auth/cache access, commit, push, version, release, workflow, CMS mutation, or automatic deployment was performed.

## Frozen artifacts

- Aggregate patch: `task130-ui-freshness-v6.patch`, SHA-256 `567aaa7dc3951cbbc913e9b83b69e88fae616ca495d16b0ad05e80054bdaab0a`.
- Per-file SHA-256 values and untracked-file patch hashes are in `task130-ui-freshness-v6.manifest.json`.
- v5 evidence files remain untouched.

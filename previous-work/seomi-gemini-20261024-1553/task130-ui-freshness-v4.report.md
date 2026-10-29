# Issue #130 UI freshness v4

Worktree: `/Users/tomaszboloz/.codex/worktrees/task130-ui-freshness/seomi`
Base HEAD: `2f727833eaef531d48569042d970c0ed3849b986`

## v4 correction

`AddTaskButton` now dispatches a project-scoped `seomi:optimization-tasks-storage` event after a successful `writeTasks`. The mounted `OptimizationTaskTracker` subscribes to that event and reloads only the affected project, so sibling producer cards refresh the tracker without a global store or remount. Failed writes do not call `onAdded`; the CTA success status resets on project/task changes.

The existing v2/v3 producer scope remains unchanged: `add-link`, validated `redirect-301`/`remove-410`, and evidence-backed `remove-noindex`. `ProtectionPanel` remains advisory.

## Tests and validation

- `tests/task130UiFlowV3.test.tsx`: 6 tests, including the real mounted `LinksWorkspace` empty → CTA → planned → implemented flow, idempotence, project isolation, callback-on-success and status reset.
- `tests/task130UiFreshnessMounted.test.tsx`: six mounted freshness cases adapted from `auditor-task130-flow.test.tsx`; prior v3 freshness evidence preserved.
- Target Vitest under `/tmp/seomi-gemini-validation.lock` via macOS `lockf`: PASS, 11 files / 75 tests.
- Full Vitest under the same lock: PASS, 1,378 files / 11,385 tests.
- `rtk npx tsc --noEmit`: PASS.
- `rtk npm run lint`: PASS.
- `rtk npm run check:loc`: PASS, 0 violations at limit 150.
- `rtk npm run version:check`: PASS, version 0.4.41 synchronized.
- `rtk git diff --check`: PASS.

Validation used a temporary symlink to existing `release-next/seomi/node_modules`; it was removed after validation. No dependency installation, auth/cache access, commit, push, version, release, workflow, CMS mutation, or automatic deployment was performed.

## Frozen artifacts

- Aggregate patch: `task130-ui-freshness-v4.patch`, SHA-256 `bf4ab0371ca707a2fcd6614e8d5bf033452a4bb50d6e066bae1325871922ee66`.
- Per-untracked-test patches and per-file SHA-256 values are in `task130-ui-freshness-v4.manifest.json`.
- v2 and v3 evidence files remain untouched.

# Issue #130 UI freshness v3

Worktree: `/Users/tomaszboloz/.codex/worktrees/task130-ui-freshness/seomi`
Base HEAD: `2f727833eaef531d48569042d970c0ed3849b986`

## Implemented

- Added planned `add-link` CTA to measured internal-link opportunities. It stores the source URL, target URL, SPRS module and the real current SPRS baseline when available; unavailable crawl evidence remains `null`.
- Added planned `redirect-301` and `remove-410` CTAs to validated recommendation-bus deployment rules. The CTA only persists a task; it does not deploy, delete, or mutate CMS content.
- Added planned `remove-noindex` CTA only for indexability conflicts backed by crawl evidence (`pillar-noindex`, `noindex-with-traffic`, or `sitemap-noindex`). `ProtectionPanel` remains advisory/business-confirmed.
- Preserved v2 freshness guards, project-scoped storage, task idempotence and HelpTip/12-locale infrastructure.
- Added `tests/task130UiFlowV3.test.tsx` with mounted CTA regressions for all five task kinds, persisted fields, unavailable baseline and project isolation/idempotence.
- Added `tests/task130UiFreshnessMounted.test.tsx`, adapted from `auditor-task130-flow.test.tsx`, covering six mounted freshness cases (including the two invalid/incomplete completion cases).

## Validation

- `rtk npx tsc --noEmit`: PASS.
- `rtk npm run lint`: PASS.
- `rtk npm run check:loc`: PASS (`0` violations, limit `150`).
- `rtk npm run version:check`: PASS (`0.4.41` synchronized).
- `rtk git diff --check`: PASS.
- Target Vitest under `/tmp/seomi-gemini-validation.lock` via macOS `lockf`: PASS, 11 files / 73 tests.
- Full Vitest under the same lock: PASS, 1,378 files / 11,383 tests.
- Validation used a temporary symlink to existing `release-next/seomi/node_modules`; it was removed after validation. No installation, auth, or cache mutation was performed.

## Boundaries

- No commit, push, version, release, workflow, CMS mutation, or automatic deployment was performed.
- Existing v2 dirty changes were retained; this report does not replace v2 evidence.

Artifacts:

- `task130-ui-freshness-v3.patch` SHA-256: `098245ed1d72ea955735bdcc9ca7462ac9ee976ded754c3138510858e999cde8`
- `task130-ui-freshness-v3-cta.patch` SHA-256: `93a5fbd1cf544b7c41437dc0a5583ce362503fd4aaa35baf7fa98b656c3e246f`
- `task130-ui-freshness-v3-mounted.patch` SHA-256: `42047c6447f89e35a965799f02d0f3564b526e27ed9124b88595fd7de872e345`

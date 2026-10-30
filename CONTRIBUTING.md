# Contributing to SEOmi

## Before you start
- Search existing issues. Open one for non-trivial work and wait for triage.
- Triage is read-only: a maintainer labels, reproduces and scopes the issue. Triage does not change code or settings.
- Reproduce bugs on a current build. State the version or commit SHA.
- Report vulnerabilities privately through GitHub Security Advisories, not public issues.

## Definition of ready
An issue is ready when it has a problem statement, scope, out-of-scope list and acceptance criteria.

## Definition of done
- Behavior and error-path tests for every changed path.
- No new warnings.
- No code or test file over 150 physical lines. Run `npm run check:loc`.
- CI thresholds unchanged: Rust 95%, frontend and MCP 98%. The 100% target is measured separately, for a pinned SHA.
- UI changes cover all 12 languages and keyboard access.
- Evidence is tied to the exact head SHA. A local commit is not a deployment.

## Pull requests
Fill in the PR template. Link the issue with `Fixes #N`. Do not bump versions or edit release notes unless the PR is a release PR.

Review routing follows `.github/CODEOWNERS`. The repository has one maintainer, so required approvals stay at 0 until a second independent maintainer agrees to review.

## GitHub Actions
Pin every `uses:` reference to a full 40-character commit SHA with a `# vX.Y.Z` comment. `tests/ciWorkflowPinsAll.test.ts` fails on tags, branches or short SHAs.

## Code of Conduct
Not yet published. The owner chooses the text and the enforcement contact.

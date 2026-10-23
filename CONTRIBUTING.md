# Contributing to SEOmi

## Before you start
- Search existing issues. Open one for non-trivial work and wait for triage.
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

## Code of Conduct
Not yet published. The owner chooses the text and the enforcement contact.

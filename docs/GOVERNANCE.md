# Governance register

## CodeQL alert 34 (issue #103)
Rule `js/incomplete-multi-character-sanitization`, `src/services/siteFocusBenchmark/rewriteBrief.ts` line 23. API state read on 2026-10-23: `fixed`. Remaining steps: confirm the fix on the exact main SHA with a fresh scan, record it in plan #77. No rule disabling, `paths-ignore` or threshold change. Clear Dependabot and secret-scanning alerts at audit time are not a guarantee. Secret-scanning extras (non-provider patterns, validity checks) are not claimed as enabled; the owner verifies availability and licence.

## Actions pinning and release gate (issue #102)
- Done: all `actions/*` references pinned to full commit SHAs with version comments; `.github/dependabot.yml` added (github-actions, npm root and `mcp-server`, cargo).
- Open: enable `sha_pinning_required` only after every workflow is validated by a run. Release must depend on green required checks for the exact SHA (push plus `workflow_run`/dispatch, fork trust, double runs). Manifest, checksums, updater signatures, SBOM and attestations need correct permissions/OIDC. Environment reviewers and trusted publishing need evaluation first.

## Account boundary (issue #101)
The repo is under a personal account. Teams, org 2FA/SSO/SCIM, independent required review and ISO/SOC2 do not follow from repo settings. Required approvals stay below blocking the sole maintainer. No Code of Conduct is published: text and enforcement contact are the owner's choice.

# Governance register

Control register for issue #100. Each row says what is enforced by files in this repository and which guard test checks it. Settings that need repository admin rights are listed separately as open steps; a file in this repo does not turn them on.

## CodeQL alert 34 (issue #103)
Rule `js/incomplete-multi-character-sanitization`, `src/services/siteFocusBenchmark/rewriteBrief.ts` line 23. API state read on 2026-10-23: `fixed`. Remaining steps: confirm the fix on the exact main SHA with a fresh scan, record it in plan #77. No rule disabling, `paths-ignore` or threshold change. Clear Dependabot and secret-scanning alerts at audit time are not a guarantee. Secret-scanning extras (non-provider patterns, validity checks) are not claimed as enabled; the owner verifies availability and licence.

## File-level controls (issues #101, #102)
| Control | Files | Guard |
| --- | --- | --- |
| Every `uses:` in every workflow is a full commit SHA with a `# vX.Y.Z` comment; each workflow has a top-level read-only token | `.github/workflows/*.yml` | `tests/ciWorkflowPinsAll.test.ts`, `tests/ciActionPins.test.ts` |
| Dependabot for github-actions, npm (root, `mcp-server`) and cargo, weekly, limited and grouped; Tauri major bumps excluded so JS and Rust move together in a release PR | `.github/dependabot.yml` | `tests/githubDependabotGovernance.test.ts` |
| Release runs only after a green push CI run for the exact branch SHA (`workflow_run` then dispatch with `expected_sha`); fork runs and advanced branches are skipped | `.github/workflows/release-after-ci.yml`, `.github/workflows/release.yml` | `tests/releaseScheduling.test.ts`, `tests/releaseCiGate*.test.ts` |
| Release checks required check runs and main CodeQL for the exact SHA before publishing one draft | `scripts/release-ci-gate*.mjs`, `scripts/release-codeql-main.mjs` | `tests/releaseCiGate*.test.ts`, `tests/releaseMainCodeql*.test.ts` |
| Inventory, `SHA256SUMS.txt`, CycloneDX SBOMs and `actions/attest-build-provenance` bound to the release SHA and remote asset digests before the draft is published | `.github/workflows/release.yml`, `scripts/release-ci-gate-provenance*.mjs` | `tests/releaseCiGateProvenance*.test.ts`, `tests/ciActionPins.test.ts` |
| Issue forms (version/SHA, environment, reproduction, scope, secret-free evidence), blank issues off, vulnerabilities routed to private advisories | `.github/ISSUE_TEMPLATE/*`, `SECURITY.md` | `tests/githubCommunityFiles.test.ts` |
| PR template (linked issue, paths, tested head SHA, risks, no release promise), CONTRIBUTING (DOR/DOD, MAX150, Rust 95 / frontend+MCP 98) | `.github/PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md` | `tests/githubCommunityFiles.test.ts` |
| CODEOWNERS lists only the owner, catch-all first, only existing paths | `.github/CODEOWNERS` | `tests/githubCommunityFiles.test.ts` |
| Code of Conduct: unmodified Contributor Covenant 2.1, enforcement contact is the private reporting link from `SECURITY.md`, linked from CONTRIBUTING (default decision, #101) | `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md` | `tests/githubCodeOfConduct.test.ts` |
| Release profile keeps `panic = "unwind"` so objc2 can catch the WebKit exception raised when a reload cancels a protocol task; both desktop E2E profiles run a real Foundation exception probe (macOS Intel failure in run 40987852299, #90) | `src-tauri/Cargo.toml`, `src-tauri/examples/desktop_e2e_assets.rs`, `src-tauri/examples/desktop_e2e_exceptions.rs` | `tests/releaseProfileUnwind.test.ts` |

## Remaining manual admin steps
These need repository admin settings or an owner decision. They stay open until someone reads the setting back after the change.
- [ ] Turn on `sha_pinning_required` for Actions after one full green run of `test.yml` and `release.yml` on main with the current pins.
- [ ] Decide on a release `environment` with required reviewers, then reference it from the publish job in `release.yml`. An environment that no job uses does not protect a release.
- [ ] Watch the first real OIDC attestation run on a published release and verify it with `gh attestation verify`.
- [ ] Raise required approvals to 1 only after a second independent maintainer agrees to review. Until then the sole maintainer must not be blocked.
- [ ] Code of Conduct: Contributor Covenant 2.1 is published as a default decision with the `SECURITY.md` contact. The owner confirms or replaces the text and contact; a dedicated conduct e-mail address is not invented here.
- [ ] Secret-scanning non-provider patterns and validity checks: confirm plan availability and enable in settings.
- [ ] After merge, read the community profile and confirm GitHub picks up the forms, CODEOWNERS and CONTRIBUTING.

## Account boundary (issue #101)
The repo is under a personal account. Teams, org 2FA/SSO/SCIM, independent required review and ISO/SOC2 do not follow from repo settings. Required approvals stay below blocking the sole maintainer.

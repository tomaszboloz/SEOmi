# Owner-only steps (issues #100, #101, #102)

Everything that can live in the repo is already tracked: CODEOWNERS, issue and PR forms, CONTRIBUTING, CODE_OF_CONDUCT,
SECURITY, Dependabot, SHA-pinned workflows, exact-SHA release gate and attestations (see `docs/GOVERNANCE.md`).
The steps below need repository admin rights. Run them as the owner, then run the read-back command and paste its
output into the closing comment of the issue. `tests/ownerStepsDoc.test.ts` keeps this file complete.

Replace `OWNER/REPO` with `tomaszboloz/SEOmi`.

## S1 sha_pinning_required (#102)
Precondition: one green `test.yml` and `release.yml` run on main with the current pins.
- Do: `gh api -X PUT repos/OWNER/REPO/actions/permissions -F enabled=true -f allowed_actions=selected -F sha_pinning_required=true`
- Read back: `gh api repos/OWNER/REPO/actions/permissions -q .sha_pinning_required` must print `true`.

## S2 release environment with reviewers (#102)
- Do: `gh api -X PUT repos/OWNER/REPO/environments/release -F 'reviewers[][type]=User' -F 'reviewers[][id]=<owner user id>'`
- Then add `environment: release` to the publish job in `.github/workflows/release.yml` in a PR (an unused environment protects nothing).
- Read back: `gh api repos/OWNER/REPO/environments/release -q .protection_rules`.

## S3 first attestation (#102)
- Do: after the first published release, `gh attestation verify <downloaded installer> --repo OWNER/REPO`.
- Read back: command exits 0 and lists the `release.yml` workflow as signer.

## S4 required approvals (#101)
Keep 0 while there is one maintainer. After a second maintainer agrees to review:
- Do: `gh api -X PATCH repos/OWNER/REPO/branches/main/protection/required_pull_request_reviews -F required_approving_review_count=1`
- Read back: `gh api repos/OWNER/REPO/branches/main/protection -q .required_pull_request_reviews.required_approving_review_count`.

## S5 Code of Conduct contact (#101)
Contributor Covenant 2.1 with the `SECURITY.md` channel is the accepted default. 
- Do: to change it, edit `CODE_OF_CONDUCT.md` in a PR.
- Read back: `npx vitest run tests/githubCodeOfConduct.test.ts` passes (contact still points at a private channel).

## S6 secret scanning extras (#100)
- Do: Settings > Code security > Secret scanning: enable non-provider patterns and validity checks if the plan offers them.
- Read back: `gh api repos/OWNER/REPO -q .security_and_analysis`.

## S7 community profile (#101)
- Read back after merge: `gh api repos/OWNER/REPO/community/profile -q .health_percentage` and confirm forms, CODEOWNERS and CONTRIBUTING are listed.

## S8 CodeQL alert (#103)
- Read back: `gh api repos/OWNER/REPO/code-scanning/alerts?state=open -q length`; triage any alert in the Security tab. Do not dismiss without a reason.

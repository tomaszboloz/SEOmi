# SEOmi release qualification checklist — `f2f7bf64`

Audit scope: read-only qualification after patch `f2f7bf64d48f893f1165806bddea5f9a3fed569a`, workflow run `40225052875`.

## Current state at audit time

- Run `40225052875` was still `in_progress`; the five jobs had not reached a terminal state. No new failure is claimed from this snapshot.
- PR #209 targets `release/0.4.9` and has head `f2f7bf64d48f893f1165806bddea5f9a3fed569a`. GitHub reported that `release/0.4.9` is not branch-protected (`404 Branch not protected`).
- PR #176 targets `main` and has head `5f4ea414123fce4fa2dd54c3b0ed4057cda96776`.

## Branch protection and ruleset gates

- [ ] Do not treat PR #209 as protected by `release/0.4.9`; obtain the required review/check evidence explicitly before merge.
- [ ] For `main`, require strict/current-head success for all ten configured checks:
  1. Rust Backend Unit & Security Tests
  2. Frontend TypeScript, i18n & Vitest
  3. Desktop platform smoke (windows-latest)
  4. Dependency Vulnerability Scan & SBOM
  5. Desktop platform smoke (macos-15-intel)
  6. Rust production coverage measurement
  7. Frontend and MCP coverage (98% follow-up)
  8. Rust production coverage (95% follow-up)
  9. Analyze (javascript-typescript)
  10. Analyze (actions)
- [ ] Confirm the checks are for the exact release SHA, are not skipped, and satisfy strict required-check semantics.
- [ ] Confirm main protection remains configured with stale-review dismissal, admin enforcement, conversation resolution, no force-push/deletion, zero required approving reviews, and signatures disabled.
- [ ] Preserve the active tag ruleset `25347738` (`Release tags — prevent rewriting and deletion`) for `refs/tags/v*`; deletion and non-fast-forward are blocked and there are no bypass actors.

## Run and coverage PASS criteria

- [ ] Wait for all jobs in run `40225052875` to finish; record a terminal result, not an in-progress snapshot.
- [ ] Verify the Rust unit/security, frontend/i18n/Vitest, Windows smoke, macOS Intel smoke, and dependency/SBOM jobs pass on the exact SHA.
- [ ] Verify both required coverage jobs execute (not skipped) and publish artifacts for the exact SHA:
  - Rust production coverage meets the configured 95% threshold.
  - Frontend/MCP coverage meets the configured 98% follow-up threshold.
- [ ] Treat the prior native measurement only as supporting, stale evidence: `29433/29537` lines (`99.6479%`), `3592/3634` functions (`98.8442%`), and `5761/5794` branches (`99.4304%`), threshold 95 passed. It was a local macOS arm64 development-baseline measurement, not current-SHA CI proof.
- [ ] Use the current Rust coverage artifact as the release decision. The old result had 104 uncovered lines, 42 functions, and 33 branches, including platform-specific/rare paths.

## Release workflow qualification

- [ ] Confirm `release-preflight` reads `package.json`, resolves `v<version>`, and emits `publish`, `tag`, `ready`, and `release_id`.
- [ ] For a tag push, require the tag to equal `v<package.version>` and publish only after exact-SHA CI and signing readiness pass.
- [ ] For a branch push (`main` or `release/**`), confirm an existing version tag yields `publish=false`; an absent tag may create the shared draft only after exact-SHA CI and signing readiness pass.
- [ ] Confirm the duplicate-v0.4.40 guard: an existing version tag prevents a second publication, and exact tag/ref checks prevent publishing another SHA under the version.
- [ ] Confirm one shared draft release is used by the matrix:
  - macOS arm64 (`macos-15`, `aarch64-apple-darwin`)
  - macOS Intel (`macos-15-intel`, `x86_64-apple-darwin`)
  - Windows (`windows-latest`)
- [ ] Each platform build must verify updater signatures and upload its platform manifest.
- [ ] `publish-release` must recheck exact-SHA CI, verify that the tag points to the release SHA, consolidate manifests into one `latest.json`, generate Node/Rust CycloneDX SBOMs, prepare provenance/checksums, attest `SHA256SUMS.txt`, validate assets, and publish the shared draft.
- [ ] After publication, verify the final tag still points to the exact release SHA.
- [ ] Verify exactly three platform outputs and one consolidated `latest.json`; reject duplicate or cross-SHA assets.

## Signing inventory (names only)

- Repository Actions secret inventory contained `TAURI_SIGNING_PRIVATE_KEY` (updated `2026-10-01T16:18:00Z`).
- Workflow references are `GITHUB_TOKEN`, `TAURI_SIGNING_PRIVATE_KEY`, and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- [ ] Resolve the name-level discrepancy: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` was referenced by the workflow but absent from the repository-level secret inventory. Do not infer its value or whether the key requires a password.

## Post-PASS merge/release sequence

1. [ ] Capture terminal PASS evidence for run `40225052875` and all ten main required checks, including both coverage artifacts.
2. [ ] Confirm PR #209's unprotected base is handled by explicit review/check evidence; do not rely on branch-protection enforcement there.
3. [ ] Confirm the exact release SHA, package version, absent/expected tag state, and signing-secret readiness.
4. [ ] Allow preflight to create/find the single shared draft; verify the three platform matrix outputs and updater manifests.
5. [ ] Verify consolidated `latest.json`, SBOMs, checksums, provenance/attestation, asset completeness, and exact tag-to-SHA identity.
6. [ ] Publish only after every item above is PASS; then perform the workflow's final tag and asset verification.

## Qualification conclusion

At the time of this audit the release was **not yet qualifiable as PASS**, solely because run `40225052875` remained in progress. The workflow design contains the required exact-SHA, shared-draft, duplicate-version, manifest, SBOM, checksum, provenance, and final-tag gates. The historical native coverage result is encouraging but must not substitute for the current Rust 95% artifact.

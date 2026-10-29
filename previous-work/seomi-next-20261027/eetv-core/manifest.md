# EETV core handoff — 2026-10-27

Worktree: `/Users/tomaszboloz/.codex/worktrees/eetv-core-050/seomi`
Base: `70a562c48674b6add386874756f43fc53b9bc1d6`

## Implemented

- EETV profile v2 (`eetv-5-layer-v2`) with schema, sameAs, author, citation and transparency layers.
- Explicit `profileVersion`, `profileId`, and per-layer observed/declared/verified/unknown coverage. Missing evidence stays absent/unknown; no zero-fill migration.
- YMYL policy is an explicit heuristic (health/finance/legal applicability and a documented 0.45 gate), not a Google-algorithm claim.
- Author alignment accepts explicit bio/description, credentials and knowsAbout. A jobTitle alone does not establish competence; UI keeps unavailable alignment as `n/a`.
- History preserves legacy v1 snapshots unchanged and stores v2 metadata. Cross-profile history is not used for score deltas or monitoring alerts.
- Crawl UI exposes the fifth layer; the shared PDF DTO carries profile, coverage and sameAs data. Static labels were added in all 12 locales.
- Added targeted profile/history regression tests.
- Added completed-crawl integration: `persistCompletedTrustRun` writes the shared EETV history only for complete, non-empty runs and sends a trust-drop monitoring event only for comparable profiles.
- Added actual registry-evidence input contract (`TrustOptions.profileEvidence`) and reconciliation DTO; supplied verified evidence is consumed by the producer rather than left as a future placeholder.
- Empty reports now omit unavailable schema/transparency layer scores and expose `unknown: 100`; TrustHero meters omit `aria-valuenow` for noData.
- TrustHero and Rust PDF now render profile id/version and observed/declared/verified/unknown coverage from the same summary DTO, with native labels in all 12 locales.
- Added a real execution integration test covering `startSiteCrawl` → durable `saveCrawlRuns` → EETV history → comparable trust alert.

## Verification

- `rtk npm run build` — PASS (TypeScript + Vite).
- `rtk npm run lint` — PASS.
- `rtk npm run check:loc` — PASS, no files over 150 physical LOC.
- `rtk npm run test -- --run tests/eeatTrustEngine1.test.ts tests/eeatTrustEngine2.test.ts tests/eeatTrustEngine3.test.ts tests/eeatTrustProfile2.test.ts tests/eeatTrustCompletion.test.ts` — PASS (5 files, 30 tests; shared lock).
- `rtk cargo test --manifest-path src-tauri/Cargo.toml --lib commands::pdf_report::crawl_report::tests_trust` — PASS (5 tests).
- `rtk cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings` — PASS.
- `rtk git diff --check` — PASS.
- Both targeted test commands were rerun through `/tmp/seomi-gemini-20261024-1553/locked-validation.py` — PASS (shared validation lock).
- Final shared-lock frontend acceptance: 7 files, 41 tests — PASS.
- Final shared-lock PDF Rust acceptance: 5 tests — PASS; clippy — PASS.
- Final shared-lock TypeScript check — PASS.

The old jobTitle-only expectation was corrected as a fixture-contract issue: the positive off-topic case now has explicit description evidence, while a separate negative case asserts unknown rather than a numeric zero.

## Scope boundary

No commit, push, GitHub mutation, version/release/workflow/install/auth-store change was made. Existing trust-evidence (#87/#88), AIO core and UI worktrees remain separate. Full coordinated suites and remote CI were not run here.

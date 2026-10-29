# #139 Programmatic SEO Quality Governor — Codex3

Worktree: `/Users/tomaszboloz/.codex/worktrees/governor-next/seomi` (managed, `origin/main`)

## Implemented

- Native Rust crawler now emits bounded DOM tag/depth signatures, explicitly declared template variables, and explicit TAS subtopic IDs. Evidence is omitted when the body is truncated/read-failed; nothing is inferred from URL or lexical graph cluster IDs.
- Crawl TS contract/types carry the three fields through to the Signals adapter.
- Template clustering deduplicates repeated canonical URLs, splits by DOM signature, retains the true URL count, and exposes a TAS representative projection (one page per explicit subtopic).
- Information gain is marked unavailable for heavily sampled excerpts; unavailable DOM/variables are visible provenance, and recommendations are read-only proposals requiring approval. HTTP error pages are excluded from quality events.
- Signals accepts an optional AuthorityReport mapping and otherwise consumes only explicit page TAS IDs; the lexical `clusterId` is never used as TAS identity.
- The production `SemanticWorkspacePanels` caller now computes the TAS report from real crawl pages plus the persisted project taxonomy and passes it into Signals. Missing taxonomy remains an honest empty coverage state. The direct Signals adapter stays side-effect free.
- Added runtime/regression tests and four new keys in all 12 locales.

## Verification

- Targeted governor/contracts/signals/native-wire/i18n suite: PASS (10 files, 1419 tests), including the unchanged reviewed 120-contract fingerprint and an additive-field contract test.
- Targeted Rust producer test through the shared lock: PASS (`cargo test template_signature`: 2 passed, 2468 filtered).
- `tsc --noEmit`: PASS.
- `npm run lint`: PASS.
- `npm run check:loc`: PASS (`0` violations, max 150 physical lines).
- `cargo fmt -- --check`: PASS.
- `git diff --check`: PASS.
- The earlier `mountPanelsAdapters.test.tsx` failure was reproduced only after a side-effectful TAS import in the #139 caller, then fixed by moving the real TAS producer to `SemanticWorkspacePanels`; pristine D7 (`d7e923c76554a7ef4904d1e42c58a23929b2ae60`) and the patched worktree now both pass 6/6.

## Boundaries

No commit, push, GitHub message, release/version/workflow change, or production/live claim was made. Existing parallel worktrees were not modified. This is not a release or final #139 acceptance claim.

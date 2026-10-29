# AIO-R 0.5 core evidence

Scope: local engine/contracts only in `aio-core-050`; no release, commit, push, version bump, workflow, UI rewrite, or Gemini worktree changes.

## Accepted implementation evidence

- `chunkSectionsAioR` uses sentence spans, target 180, max 250, overlap budget 30, UTF-16 offsets, and an explicit oversized-sentence flag.
- `scoreChunk` uses `.40 selfContainment + .35 SPO + .25 AnswerFirst`; page scoring uses `100 * (.80 meanChunk + .20 extractability)`.
- Self-containment inspects the first two sentences, records dangling/deictic/no-entity reasons and spans, and does not mark an explicit anchor as dangling.
- SPO DTO keeps subject, predicate/relation, object, negation, numeric/unit evidence, and heuristic quality `1/.7/.3`; no dependency-model claim is made.
- Extractability records its normalization rule and checks table header evidence, instruction-bound ordered lists, concise list items, definition lists, and outline.
- `AioProfile` and PDF/history DTOs persist profile identity/config hash; legacy 300-token AEO profile remains separate. Existing snapshots are retained and are not silently recomputed.
- Crawl completion now persists `aio_profile` in the stored `SiteCrawlResult`; monitoring compares only completed crawls with matching profile identity and skips missing/mismatched profiles.
- `useAioReadiness` exposes only profile-compatible trend history; `crawlAioSummary` marks legacy-unversioned/mismatched profiles and PDF AIO payloads include `profile` plus `profile_status`.
- SPO page density uses the active profile target `1.2`; too-long diagnostics use the active AIO-R cap `250` rather than the legacy 300-token constant.
- Extractability requires explicit table-header/list-instruction/item-count evidence; whitespace-only sections are no-content and decimal values such as `2.5` remain one sentence.
- A deterministic synthetic threshold harness (`aio-alert-threshold-synthetic-2026-10-27`) covers inclusive 10-point boundary, below-threshold, improvement, and unavailable cases; emitted AIO alert evidence carries this version. It reports its synthetic-only limitation and is not production calibration.
- Supported language status is `supported` for EN/PL, `uncertain` for the other ten known rule sets, and `unsupported` for unknown input; unsupported pages remain scored with partial status rather than being converted to zero.
- Unsupported-language pages expose `unknownReasons`; numeric structural/lexical signals remain partial observations, while absent core anchors are explicitly `unknown` and do not receive a zero penalty.

## Validation

- `npx --no-install vitest run tests/aio*.test.ts tests/coverage100DomainAio.test.tsx tests/coverage100UtilityHooksAio.test.tsx tests/crawlerReadiness*.test.ts tests/scoreDropHooks.test.ts`: 14 files, 129 tests passed.
- `npx --no-install vitest run tests/aioReadinessAioR050.test.ts tests/aioReadinessEngine.test.ts tests/aioReadinessText.test.ts`: 3 files, 24 tests passed.
- `npx --no-install tsc --noEmit`: passed.
- `npm run lint -- --no-warn-ignored`: passed.
- `npm run check:loc`: `{"limit":150,"files":4352,"violations":[]}`.
- `git diff --check`: passed.

All validations were run serially through `/tmp/seomi-gemini-20261024-1553/locked-validation.py` where applicable.

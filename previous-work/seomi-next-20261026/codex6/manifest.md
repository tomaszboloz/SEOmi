# Codex6 crawler acceptance patch manifest

- Date: 2026-10-26 (Europe/Warsaw)
- Base: `origin/main` at `d7e923c7` (`v0.4.42`)
- Managed worktree: `/Users/tomaszboloz/.codex/worktrees/crawler-acceptance-next/seomi`
- Selected live issue: [#131](https://github.com/tomaszboloz/SEOmi/issues/131)
- Live issue comments: #131, #127 and #128 currently have no GitHub comments (`[]` from the live REST API).
- No commit, push, GitHub mutation, version bump, workflow change, install, auth action, or heavy/frozen gate was run.

## Read-only gap audit

| Issue requirement | Current-main production caller | Current UI | Tests/evidence | Gap |
| --- | --- | --- | --- | --- |
| #131: detect thin Next/Nuxt/bundler shell, expose additive `is_js_shell_suspected`, warn in UI, and optionally render/parse payload | `src-tauri/src/commands/site_crawler/js_shell.rs:4-49` detects payload markers or a thin app-root/bundle pair; `page_content.rs:118-149` calls it; `CrawledPageFocus` is flattened into `CrawledPageSummary` | Before this patch, the TS `CrawledPageSummary` contract omitted the field and `CrawlPageEvidenceDetails` did not surface it; no automatic renderer/payload parser is wired | Native fixture tests in `src-tauri/src/commands/site_crawler/js_shell_tests.rs` cover Next, Nuxt, bundles, rich pages and non-HTML; no frontend warning test existed | **Selected:** contract and evidence warning were missing. Automatic render/JSON parsing remains a separate open part of #131. |
| #127: richer `semantic_sections` plus localized before/after surgical rewrite, fact gate, and SFS-derived forecast | `CrawledPageFocus.rag_sections` is produced by `focus_terms.rs`/`rag_sections.rs`; `AioPassageCard` calls the existing rewrite path and mounts `CopilotPatcherPanel`; `copilotPatcher/run.ts` gates facts and keeps proposals pending | `CopilotPatcherPanel` shows Before/After and approval/copy states | `tests/copilotPatcherUi.test.tsx` covers page context and before/after approval; crawler RAG tests cover existing fields | **Partial:** `RagSection` has heading/level/paragraphs/table/list counts but no `first_sentence`, section `word_count` or section `terms`; no SFS forecast is attached to a patch; the old passage rewrite remains alongside the patcher. |
| #128: quarantine-safe donor, H2/H3 location, ready HTML/Markdown snippet and solver-derived SPR delta, top 10 | `LinksWorkspace` filters pages through the recommendation bus; `findInternalLinkOpportunities` uses 2xx/indexability/body/terms/semantic-link evidence and excludes known edges | `InternalLinkOpportunitiesPanel` displays directed source/target candidates, shared terms and weighted-Jaccard heuristic; no location/snippet/SPRS delta | `tests/internalLinkOpportunities.test.ts` covers evidence bounds, aliases, inflections and limits; `tests/internalLinkPanelUiContracts.test.tsx` covers display/search/partial evidence | **Partial:** report has no donor section, snippets or solver delta, caps at 500 rather than top 10, and UI labels the score as a heuristic. |

## Implemented minimal complete slice (#131)

1. Added optional additive `is_js_shell_suspected?: boolean | null` to `src/types/crawl/page.ts:90`, preserving absent/unknown legacy data.
2. Added a warning in `CrawlPageEvidenceDetails` only for the explicit `true` value (`src/components/Domain/crawlResults/pageTable/CrawlPageEvidenceDetails.tsx:71-75`); `false`, `null` and absent values stay silent.
3. Added translated `crawl.ui.jsShellWarning` to all 12 locale files.
4. Added the frontend regression test in `tests/crawlPageEvidenceDetailsBranches.test.tsx:68-73`.

## Verification

- RED before source fix: `vitest run tests/crawlPageEvidenceDetailsBranches.test.tsx --reporter=dot` — 1 failed, 8 passed; expected `crawl.ui.jsShellWarning`, but the evidence panel had no warning.
- GREEN: same targeted command — 1 file, 9/9 tests passed.
- Locale/related regression: `vitest run tests/crawlPageEvidenceDetailsBranches.test.tsx tests/i18n.test.ts --reporter=dot` — 2 files, 1394/1394 tests passed.
- TypeScript: `tsc --noEmit` passed with no diagnostics.
- Touched-code LOC: `node scripts/check-max-loc.mjs src/components/Domain/crawlResults/pageTable/CrawlPageEvidenceDetails.tsx src/types/crawl/page.ts tests/crawlPageEvidenceDetailsBranches.test.tsx` — 3 files, no violations over 150 physical lines.
- `git diff --check` passed.
- Locale JSON parse and key check passed for `ar,de,en,es,fr,it,ja,ko,pl,pt,ru,zh`.

## Explicit boundary

This worktree contains only the #131 contract/UI warning slice. It does not claim that an HTTP crawl automatically reruns in browser-rendered mode or parses `__NEXT_DATA__`/`__NUXT__`; that remains an open follow-up in issue #131. No files owned by #137, #138, #139 or #143 were touched.

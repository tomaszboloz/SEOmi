# Ownership and collision map

## This patch owns

- #64 UI and rewrite boundary: `src/components/Domain/crawlResults/aio/AioPassageCard.tsx`, `CrawlAioTab.tsx`, `src/services/aioReadiness/rewrite.ts` (sanitizer/provider boundary only), `rewriteReview.ts`, and lifecycle tests.
- #66 composition/export boundary: `src/services/schemaGenerator/composition.ts`, `schemaGenerator.ts`, `eeatTrust/jsonLd.ts` (safe text serialization), `TrustJsonLdGenerator.tsx`, `CrawlTrustTab.tsx`, `SchemaGraphBuilder.tsx`, and schema tests.
- New AIO review/conflict strings in all 12 locale JSON files.

## Explicit collision boundaries

- `aio_core_resume` owns core AIO DTOs, chunking, scoring, offsets and report contracts. This patch does not edit `types.ts`, `chunking.ts`, `chunkScore.ts`, `page.ts`, or report formulas. If upstream changes `AioChunk`, re-check the optional `startOffset/endOffset` UI read and `passageRevision` input.
- `trust_evidence_resume` owns sameAs/identifier/citation evidence (`eeatTrust/graph.ts`, `authors.ts`, `identifiers.ts`, `citations.ts`). This patch only consumes observed nodes and does not change evidence classification or verification state.
- EETV #65/#109 core/report ownership is untouched. The composer preserves observed nodes and reports scalar conflicts; it never resolves identities silently.
- No CMS writer, project persistence, credentials, version, release, commit, push, or workflow files are included.

## Integration notes

- Apply the aggregate patch from a clean matching base; do not cherry-pick individual files over concurrent owner changes without reviewing `rewrite.ts` and `schemaGenerator.ts`.
- The current worktree is frozen. Auditor-requested defects require explicit unfreeze notification before edits.

Aggregate patch SHA256: `20db1d23d027fb60ffac90d8baeaa24fc19dbb7e472d59fe1663941c8abcb9db`.

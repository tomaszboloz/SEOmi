# AI & Trust 0.5.0 integration acceptance

This integration is a development candidate. It does not complete milestone 3 or confirm a public 0.5.0 release. The application version remains 0.4.43 until the release acceptance is complete. Milestone 4 (0.6.0) follows 0.5.0 acceptance and publication.

## Integrated behavior

| Area | Implemented behavior | Evidence boundary |
| --- | --- | --- |
| #63 AIO | Versioned 250/180/30 windows, UTF-16 offsets, bounded oversized sentences, decimal-preserving SPO, active score formula, explicit partial/unknown states | Heuristic language analysis; no Google citation or factual verification claim |
| #64 Rewrite | Active core profile for before/after, preservation checks, project/run/revision guards, cancel, manual approval/copy/export | Suggestions do not publish or overwrite the crawl baseline |
| #65 EETV | Five-layer profile, explicit coverage, jobTitle-only remains unknown, comparable history, crawl-completion monitoring integration | Missing evidence remains unavailable; declared expertise is not verified competence |
| #66 JSON-LD | Existing graph composition, IDs/conflicts, escaped text at the real export boundary | Raw object values remain intact; serialized script text is escaped |
| #87 Identity | ORCID/QID syntax, native bounded registry transport and per-hop HTTPS allowlist, explicit fetched/verified/mismatch/unavailable states | A successful fetch or a similar name does not verify identity; reviewer/publisher reconciliation acceptance remains open |
| #88 Citations | DOI/PMID/PMCID spans and same/adjacent-sentence associations, separate exists/reachable/topical/supportsClaim states, UI/PDF evidence | Association is not entailment or manual sourceChecked; full reference scoring-policy acceptance remains open |
| #108/#109 Monitoring | Profile-aware comparisons, missing-data guards, synthetic threshold evaluation and completion integration tests | Synthetic fixtures are not real-world calibration or production observation |
| #137 Dependency | Project budget/reservations, cache scope/TTL, YMYL gates before return/cache, reviewed CMS provenance, honest cloud CLI/privacy and unknown costs | Production embedding/batch transport is not claimed; compatible vectors and batch selection remain opt-in utilities |

## PDF provenance

The PDF identifies the profile that actually computed the displayed AIO scores. A stored profile is separate historical provenance. Missing or incompatible historical profiles produce a localized recalculation warning and are not presented as comparable historical scores. Historical input records are not relabeled or mutated.

Trust PDF output includes profile/coverage and citation evidence. Locale smoke tests prove mounting/key resolution; they do not establish independent linguistic review.

## Local verification at integration checkpoint

The combined source passed 48 targeted Vitest files / 391 tests, TypeScript, ESLint, MAX150, version synchronization and diff checks on Node 24.19.0. Full source-frozen frontend/MCP coverage, Rust/PDF suites, independent review, Windows/macOS debug/release runtime and signed artifacts remain required for release. Results must be associated with their measured commit; a targeted pass is not a global 100% claim.

Rust 95%, frontend/MCP 98%, MAX150 and branch protection are unchanged. All 12 locales contain the new labels. Stable dependency patches were updated; TypeScript 7 is excluded because the current ESLint peer contract requires TypeScript below 6.1.

## Release boundary

Keep #63, #64, #65, #66, #87, #88, #108 and #109 open until their full acceptance criteria and shared runtime/export evidence are complete. Track integration evidence in the PR and #77. Do not infer milestone completion, merge approval, published installers, updater signatures or provenance from this document.

# Semantic scoring defaults (#67, #71)

Decisions delegated to the maintainer on 2026-11-01. Each default is deterministic and local; models are optional.

## IGOS (#67)
- Entities: capitalised multi-word spans plus subject-predicate-object subjects, stem-normalised (`src/services/igos/entities.ts`). Always on.
- Optional Ollama entities: set a label model in the project's embedding settings (`labelModel`). Model entities are merged with the heuristic ones and the report lists `ollama-entities`. If the call fails the heuristic result is used and `ollama-entities-unavailable` is listed.
- Thresholds .48 (on-topic) and .82 (echo) are accepted for the local lexical vectors. They were not calibrated on a specific Ollama model; a semantic provider run is labelled with its provider and model so runs are never compared across models.

## SPRS (#71)
- Edge weight W = PDOM x max(.05, simPage) x max(.05, simContext). The .05 floor is accepted (GEM-71-D01).
- simPage: lexical weighted Jaccard. With an optional embedding set (`buildSprsInput(graph, embeddings)`), the page-vector cosine is averaged in; if only vectors are known the clipped cosine stands alone. Unknown stays unknown.
- simContext: lexical cosine of the +-15 word context plus anchor against the target's semantic terms.
- Tolerance min(1e-6, 1% of 1/n), max 150 iterations. The legacy solver profile (1e-12, 200) stays the default of `calculatePageRank`.
- Reproducible benchmark: `npm run bench:sprs` (50k pages, 2M edges). Reference run: 4.8 s, about 108 MB, 5 iterations (Mac arm64, Node 24). Other hardware: rerun and compare, no fixed budget is enforced.

## Link graph URL identity (#70 GEM-70-05)
Accepted decision: canonical URLs are NOT aliases. A canonical tag can point to a different page, so a link to a canonical target that was not crawled stays an unresolved target (reported in `skippedLinks.unresolvedTargets`). Only a crawled page's requested URL and its `final_url` (redirect result) identify that page. Pinned by `tests/semanticGraphCanonicalPolicy.test.ts`.

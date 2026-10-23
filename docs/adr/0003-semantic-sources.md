# ADR 0003: Shared semantic sources (embeddings/Ollama, SERP quality)

Status: Proposed. Issue #86. Extends existing owners; no second Ollama or SERP stack.

## Owners
`embeddings/registry.ts`, `ollama.ts`, `ollamaTransport.ts`, `ollamaChat.ts`, `embeddingClustering.ts`, `embeddings/hybridSerp.ts`, `serpImport/contracts.ts`, `freeSerp`, `publicFeedTransport`.

## Embedding provider contract
Model descriptor: ID, version, dimensions, normalization, languages, tokenizer, batch size, corpus/IDF, weights. Modes are named: local-hash, TF-IDF, neural, hybrid. `embedding-serp` is a separate scoring layer; provider `hybrid` (vectors) is not scoringMode `embedding-serp`. Different spaces block cosine; they never yield a random 0.

Batch, timeout, cancel, concurrency and budget are explicit. A heuristic fallback carries its own label, profile and lower confidence. Ollama stays optional. Similarity thresholds are calibrated per model (decision GEM-86-D02, owner #83).

## SERP snapshot
Fields: query, engine/provider, country, location, language, device, captured and retrieved time, organic rank, requested and final canonical URL, actual K. Duplicates and ranks are normalized. Fewer than 5/10/20 results are handled per module.

Free Bing RSS is partial coverage and never labeled Google TOP10. Three results are not a TOP10. PAA is not a label for any question. Google TOP K, PAA, KG and Suggest have separate capabilities. Block, 429, outage, robots or cancel gives honest partial or unavailable, never invented metrics. Full Google/PAA/Images exist only if a real provider is available (GEM-86-D01).

## Cache and secrets
Competitor content and embeddings are fetched once and shared via ADR 0002, keeping query-specific context. Keys and auth stay in the existing native transports, never in WebView, logs or reports.

## Extra sources
Backlink and media sources get their own provider, cost and capability. No paid API or model install is forced. Missing permission or model is `unavailable`.

## Verification
Ollama missing, offline, wrong model, timeout, cancel, stale response. Dimension mismatch, NaN, zero vectors, different fitted corpus. SERP duplicates, canonical, real K, market mismatch, unknown metadata. Bing partial never enters a full Google score. Cache reuse and invalidation, secret redaction.

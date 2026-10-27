# Semantic Suite test and acceptance matrix

Issue #90. Plan only. Nothing here is a result. Status values are PASS, FAIL or NOT_TESTED, recorded separately, each tied to an exact main SHA. No "72/72" or 100% claim without evidence.

## Rules
- Every GEM-* item has expected behavior and a test, or a written manual protocol.
- Decision items (D-items) are settled before the matching formula is accepted.
- Fixtures: small, hand-computed, independent of the implementation. Cover TRS, SFS, TAS, AIO, IGOS, EETV, SSAS, PageRank, HSS, PRI, TBVA, delta.
- Properties: deterministic, in range, probabilities sum correctly, no NaN, invariant to order and dedup. Monotonicity only where the contract demands it.
- Thresholds unchanged: Rust 95%, frontend/MCP 98%, MAX 150 physical LOC. Measured 100% (lines, functions, branches) is a separate run pinned to SHA, platform and source scope.
- No masking of stderr, i18next or jsdom duplicate keys. No skip or retry as a flake fix. Local mocks do not replace platform CI.

## Matrix
| Requirement | Reuse owner | Adapter/migration | Test | CI/artifact | Result |
|---|---|---|---|---|---|
| PageRank, graph | `semanticGraph/pageRank.ts` | weights only | semanticGraphPageRank, GraphEvidencePanel | frontend job | NOT_TESTED |
| GSC cannibalization | `gscTracker/cannibalization.ts` | evidence merge | gscCannibalization, semanticAudit | frontend job | NOT_TESTED |
| Embedding and SERP ownership | `embeddings/*` | ADR 0003 | embeddingClustering, hybridEmbeddingIntegration, embeddingSerpOwnership | frontend job | NOT_TESTED |
| TOP 10 gap | `targetPhraseAudit` | snapshot | targetPhraseAudit | frontend job | NOT_TESTED |
| Schema | `schemaGenerator`, native schema graph | shared @id policy | schemaGenerator, Rust schema tests | frontend + Rust | NOT_TESTED |
| Briefs, citations | `briefDocument`, `citationEvidence` | ADR 0002 | briefDocument, citationEvidence | frontend job | NOT_TESTED |
| Scheduler, history | `schedules`, `monitoringAlerts` | artifact kinds | single delivery on retry | frontend + Rust | NOT_TESTED |
| Contracts | envelope | ADR 0002 | Rust -> TS -> MCP/PDF round trip | all jobs | NOT_TESTED |
| 360 items (#91-#99) | various | per issue | unknown vs 0, currency/window, log gaps and spoofed UA, OCR confidence, media caps, causal placebo, control contamination, hreflang asymmetry | per issue | NOT_TESTED |

Cross-cutting: old snapshots, partial data, project A/B, restart/cancel/retry, no double crawl, embed or delivery, immutable baseline.

## UI and PDF
12 languages, keyboard and ARIA, Unicode/RTL, narrow windows. PDF checked by text extraction and by rendered pages.

## Commands (confirm from `package.json`, workflows and `src-tauri/Cargo.toml` at the target SHA)
`npm run check:loc`, frontend and MCP test and coverage scripts, `cargo test --manifest-path src-tauri/Cargo.toml`. macOS and Windows IPC/MCP smoke, and a real-provider check only within authorized scope.

## Release evidence (future)
Release only after: green checks for the current SHA, one version source, release notes, macOS/Windows smoke, installers, updater signatures, checksums and SBOM. Credit @RafalSzy. Nothing is released now. A plan does not guarantee enterprise compliance, 100% parity or error-free runtime (GEM-90-D01).

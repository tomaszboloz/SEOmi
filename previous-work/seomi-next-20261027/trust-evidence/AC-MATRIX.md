# SEOmi trust evidence #87/#88 — local evidence

Scope: `/Users/tomaszboloz/.codex/worktrees/trust-evidence-050/seomi`, base `70a562c48674b6add386874756f43fc53b9bc1d6`.

| Acceptance area | Implemented path | Evidence |
|---|---|---|
| ORCID checksum, Q-ID, host/path and suffix-spoofing | `src/services/eeatTrust/identifiers.ts`, `registry.ts` | existing identifier suite + `tests/trustEvidenceContracts.test.ts` |
| declared vs syntax-valid vs fetched/verified/mismatch/unavailable | `types.ts`, `authors.ts`, `build.ts`, `registry.ts` | registry contract tests; default report remains declared/syntax-only |
| bounded registry transport | `registry.ts`, native `fetch_registry_profile` IPC | WebView never direct-fetches; HTTPS host/path allowlist, native DNS-resolved public-IP SSRF guard, safe redirects, 4s timeout, 512KiB body, 3 redirects, TTL/request budget |
| DOI/PMID/PMCID and source spans | `src/services/citationEvidence/claims.ts` | DOI/PMID extraction, UTF-16 offsets, same/adjacent sentence mapping |
| source exists/reachable/topical/supports claim | `claims.ts`, `eeatTrust/citations.ts` | fields remain separate; association does not imply entailment |
| manual sourceChecked boundary | `claims.ts` | only an explicit source catalog `sourceChecked:true` can set it |
| existing trust UI caller | `TrustEntities.tsx`, `TrustSignals.tsx` | identity detail and claim evidence rendered from TrustReport |
| existing crawl PDF caller | `summary.ts`, `trust_tables.rs`, `sec_trust.rs` | compact claim evidence table passed through `downloadCrawlPdf` |
| all 12 translations | `src/i18n/locales/{ar,de,en,es,fr,it,ja,ko,pl,pt,ru,zh}.json` | identity/claim and PDF labels added in every locale |

## Verification

- `rtk tsc --noEmit`: pass.
- `rtk npm run build`: pass (Vite production build).
- `rtk npm run lint`: pass, zero warnings.
- `rtk npm run check:loc`: pass, 0 violations / 150 LOC limit.
- Frontend targeted: 52 existing trust/citation tests pass; 4 new contract tests pass.
- `rtk proxy cargo fmt --all -- --check`: pass.
- Rust `cargo check` and `crawl_report::tests_trust` pass with `CARGO_TARGET_DIR=/Volumes/Kingston/www/seomi-target-trust050` (external target; no internal target created).
- Native command tests `commands::http_client::tests`: 6 passed, including ORCID/QID path, HTTPS, suffix-spoofing and homepage rejection.
- `rtk git diff --check`: pass.

`nativeRegistryFetcher` calls the registered native command; fetched evidence stays `fetched` unless an explicit matcher is supplied, and name similarity is never a verifier. No credentials, profile facts, external verification claims, version/tag/release/push or GitHub mutation were performed. No commit is included; parent orchestrator owns integration/commit.

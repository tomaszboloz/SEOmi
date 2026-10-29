## Problem and result

Integrates the AI & Trust candidate for 0.5.0 and fixes incomplete GSC opportunity browsing. The GSC table now uses every query returned by the current report, independently of the 250-row history retention limit, with 20/50/100-row pages, sorting, a literal Unicode-aware text filter and keyboard-accessible views. Project hydration and property/date/filter checks prevent stale report data from crossing scopes.

AI & Trust changes include profile-aware AIO scoring/rewrite comparison, native list/table metadata, five-layer EETV, bounded native registry and citation evidence, safe JSON-LD export, and YMYL/budget/cache/CMS controls. Unavailable evidence remains distinct from observed zero in the UI, PDF, history and monitoring. Registry fetching does not establish identity, and citation association does not establish claim support.

## Linked work

Refs #63, #64, #65, #66, #87, #88, #108, #109, dependency #137 and GSC #222. Full milestone criteria remain open. This draft must not auto-close them or be treated as a completed 0.5.0 release.

## Validation

Source frozen at `658031c633a17128d9d14586dc9ac1ac01a7f5ed`, including current main `11537f9001aca326c8e64387defab1c7f47120bf`.

- GSC/session/localization regression suite: **57 files / 1,772 tests PASS**.
- AI/Trust regression suite: **23 files / 1,524 tests PASS**.
- TypeScript, ESLint, MAX150, version synchronization and diff checks: **PASS**.
- All 12 GSC locales have matching keys/placeholders; existing English copies in the touched panel were translated.
- Browser verification with 301 synthetic queries: filtering query 300, full-set sorting and page 4/4 (row 301) PASS. No private report data was published.
- Full frontend coverage at the unchanged 98% thresholds, MCP coverage, native Rust tests/clippy and production frontend build are running for the frozen SHA. Remote CI must also pass for that exact source.

The earlier `d4a2bad` full baseline failed and remains historical failure evidence; it is not relabeled as a passing coverage run. The repaired CMS fixture is already on main through #220.

## Remaining acceptance and release

- [x] Preserve Rust95%, frontend/MCP98%, MAX150 and existing protection/security gates.
- [ ] Full coordinated coverage and remote checks for the frozen source.
- [ ] Windows/macOS debug/release runtime acceptance and native PDF/registry acceptance.
- [ ] Remaining identity reconciliation, reference citation policy, real-world calibration and complete milestone criteria.

Legacy scores retain their computing profile and provenance. No automatic CMS publication is added. Embedding/batch transport is not claimed by the economy utility paths. Three compatible npm patch updates are included; TypeScript 7 remains incompatible with the current ESLint peer range below 6.1.

Application metadata remains **0.4.43**, now publicly released independently of this draft. Publish **0.5.0** only after all eight milestone issues and platform/security/provenance gates are accepted; **0.6.0** follows that publication. No auto-merge is enabled for this draft.

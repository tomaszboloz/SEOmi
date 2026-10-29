## Problem and result

Integrates the first combined AI & Trust 0.5.0 candidate: profile-aware AIO chunking/scoring and monitoring, guarded rewrite review with the active core algorithm, five-layer EETV and history, native registry/citation evidence, safe JSON-LD composition/export, and the YMYL/budget/cache/CMS controls required by these flows.

Historical and current scores are separated by explicit profiles. PDF recalculations disclose the computing profile and historical provenance. Unknown evidence is kept separate from observed zero, registry fetching does not verify identity, and citation association does not prove claim support. Cloud CLI calls remain cloud for budget/privacy reporting.

## Linked issue

Refs #63, #64, #65, #66, #87, #88, #108, #109 and dependency #137. The full criteria remain open; this draft must not auto-close them or be treated as the 0.5.0 release.

## Changed paths

Existing AIO/EETV/monitoring/AI services, their crawl UI and native PDF sections, native bounded registry IPC, project economy controls, all 12 locales and behavior/regression tests. Three compatible npm patch updates are included. TypeScript 7 is held because the current ESLint peer contract requires TypeScript below 6.1.

## Tests

For source commit `d4a2bad34ede8b4776f380d2ef08b006a9b08822`:

- Combined targeted Vitest: **48 files / 391 tests PASS**.
- TypeScript, ESLint, MAX150, synchronized application metadata and diff checks: **PASS**.
- Node 24.19.0; tests use the installed updated dependency lock.
- Full source-frozen frontend/MCP coverage and native Rust/PDF/clippy checks are running; results will be recorded for their exact SHA.
- The CMS HTTP fixture change is also in #220 and passed 30 repeated native suite runs independently.

- [x] No code/test file over 150 physical lines.
- [x] CI thresholds unchanged: Rust95%, frontend/MCP98%.
- [ ] Full coordinated suites, remote CI and Windows/macOS debug/release acceptance.
- [ ] Native PDF/registry acceptance and independent review follow-ups.

## Migrations and risks

Legacy score records remain distinguishable from the current profile. No automatic CMS publication is added. The draft remains blocked on review follow-ups for citation unknown flags, identity reconciliation and registry/cache/history provenance, plus complete milestone acceptance. Synthetic threshold fixtures are not real-world calibration. Reviewer/publisher identity reconciliation and the full reference citation scoring policy are not declared complete. Embedding/batch transports are not claimed by the economy utility paths.

## Release

Application metadata remains 0.4.43. Publish 0.5.0 only after all eight milestone issues and shared release/platform/security/provenance gates are accepted; 0.6.0 follows that publication. This draft has no auto-merge authorization and does not confirm published installers or a release.

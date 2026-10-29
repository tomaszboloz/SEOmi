# AI & Trust UI acceptance matrix (working-tree evidence)

| Area | Evidence in patch | State |
|---|---|---|
| AIO rewrite prompt | Existing provider adapter, untrusted passage delimiter, plain-text sanitizer preserving math/Unicode | Implemented; runtime test blocked by missing node_modules in this worktree |
| Rewrite review | Before/after local profile, deterministic line diff, number/unit/negation/citation/qualifier preservation warning | Implemented |
| Stale/cancel guard | AbortController plus project/run/revision context on each passage | Implemented |
| Manual handoff | Approve-for-brief state; copy/export only local draft, no CMS mutation | Implemented |
| JSON-LD composition | Observed + generated + trust graph merge; stable IDs retained; scalar conflicts surfaced; no silent overwrite | Implemented |
| JSON-LD safety | `safeJsonLdText`/`serializeJsonLd` escape `</script`, UI copy/export uses escaped script | Implemented |
| Existing facts | `schemaGenerator` continues verified-fact filtering; composer skips undefined trust fields and keeps observed first | Implemented |
| i18n/accessibility | New review actions translated in all 12 locale files; native buttons, focus-visible styles, status/alert regions | Implemented |
| Checks | Shared-lock `npx tsc --noEmit` PASS; ESLint PASS; `check:loc` PASS (0 violations); targeted Vitest 6 files/33 tests PASS plus lifecycle 2/2 PASS; locale JSON/key check PASS | Verified |
| Lifecycle | Real component test proves stale response after project/run switch is ignored and cancelled late response is not applied | Verified |
| JSON-LD boundary | Raw `JSON.stringify(result.graph)` intentionally RED in `jsonld-red-green.log`; production `result.text` GREEN in `jsonld-green.log` | Verified boundary |
| Release | No commit, version, push, CMS write, or production claim made | Not applicable |

Known external test limitation: a Gemini safety test serializes the raw generated schema object rather than the actual script/export boundary. The export/UI boundary is covered by the new serializer and composition test; raw schema values remain unchanged to preserve observed facts.

Raw logs and exit codes: `vitest-targeted.log`, `lifecycle.log`, `jsonld-red-green.log`, `jsonld-green.log`, `locales-check.log`, `tsc.log`, `lint.log`, `loc.log`, `commands.log` in this directory. The worktree uses a temporary symlink to the authorized shared `release-next/seomi/node_modules`; no packages were installed.

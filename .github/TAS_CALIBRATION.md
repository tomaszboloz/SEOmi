# Topical Authority Score: calibration defaults

Status: defaults chosen under the owner delegation of 2026-11-01 (issues #57 to #62, #83, #99, #110).
They are calibrated on the repository fixtures (`tests/authorityFixtures.ts`, `tests/authorityBoundaries.test.ts`,
`tests/authorityThresholdEdges.test.ts`, `tests/authorityCannibalIntent.test.ts`), not on live market data.
Change a value only together with the test that pins it.

| Item | Default | Where |
| --- | --- | --- |
| TAS weights (TCR, CDES, SILC, CVFF) | .35 / .30 / .25 / .10 | `topicalAuthority/score.ts` |
| SFS multiplier | `0.7 + 0.3 * SFS / 100` | `topicalAuthority/score.ts` |
| Sub-topic coverage cosine (partial, full) | 0.60 / 0.78 | `topicalAuthority/coverage.ts` |
| Reference page relevance (TRS) | 60 | `topicalAuthority/coverage.ts` |
| Same-intent cannibalization | cosine 0.88 and H1 Jaccard 0.5 | `topicalAuthority/cannibal.ts` |
| Same sub-topic cannibalization | cosine 0.60 on fully covered topics | `topicalAuthority/cannibal.ts` |
| Pre-publish overlap | cosine 0.85 | `topicalAuthority/cannibal.ts` |
| Fresh content | modified within 365 days | `topicalAuthority/freshness.ts` |
| Pillar decay alert | pillar page older than 365 days and the market uses entities it lacks | `topicalAuthorityMonitoring/alerts.ts` |
| Competitor radar | competitor gains 25 coverage points | `topicalAuthorityMonitoring/alerts.ts` |
| Scheduled reference refresh | opt-in, 1 success per 7 days, 4 attempts per 30 days, retry backoff 1 h doubling to 24 h, stop after 3 failures until the cooldown ends | `topicalAuthorityMonitoring/refreshPolicy.ts` |
| Entity recognition | `lexical` (focus terms only). `heuristic` adds local name detection. `ollama` also asks a local model; failure adds nothing | `topicalAuthority/ner.ts`, `topicalAuthorityReference/ollamaEntities.ts` |

## Decisions

- Cannibalization groups only pages whose vocabulary and headline intent both agree. Same vocabulary with a different H1, and the same H1 with unrelated vocabulary, never group.
- Entity recognition never downloads a model. The heuristic detects capitalised names, acronyms and letter-digit codes, so it adds little for scripts without letter case (Japanese, Chinese, Arabic); the lexical focus terms stay the main source there.
- Information gain in CDES is a local lexical measure. TAS does not import IGOS, so the chain taxonomy, features, CDES, TAS has no cycle with IGOS.
- Historical TAS scores keep the scoring profile they were computed with. A profile change breaks the TAS line instead of rewriting stored points.
- Menu and sidebar/footer links come from the crawler zone and never count as content links. The report states how many links carry each placement or no placement data.
- Programmatic SEO templates (5 or more pages with the same slug stem and cosine of at least 0.90) collapse to their strongest page.
- Pillar decay and the competitor radar run after every completed crawl, including native scheduled crawls imported at app start, and share one alert per run id, so opening the tab afterwards never notifies a second time.

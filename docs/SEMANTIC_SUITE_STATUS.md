# Semantic Suite and Execution Card status

Status map for epics #77 (Semantic SEO Suite) and #124 (prescriptive execution engine). Snapshot of 2026-10-30 against main `8fc5537d` (0.7.0). "Open" means the issue has not been accepted, not that no code exists. Issue state comes from GitHub; code locations come from this tree. This file is not acceptance evidence: acceptance stays with #90 and `docs/TEST_ACCEPTANCE_MATRIX.md`. No 72/72 or 100% claim.

## Epic #124: Execution Card
Every recommendation becomes a card with four sections: (1) diagnosis and reason, (2) location, (3) before/after artifact, (4) deployment and verification. Each event has an owner, SLA, priority and expected effect.

| Card part | Issue | State | Code |
| --- | --- | --- | --- |
| Shared recommendation bus, URL quarantine | #125 | closed | `src/services/recommendationBus/` |
| Indexability and canonical gate | #132 | closed | `src/services/indexabilityGate/` |
| H2 sections and Surgical Rewriter before/after | #127 | open (separate track) | `src/services/surgicalRewriter/` |
| Link Injector: donor, H2 section, sentence with `<a>` | #128 | closed | `src/services/linkInjector/` |
| Deployment artifacts 301/410 and merging blueprint | #129 | closed | `src/services/deployArtifacts/` |
| Closed-Loop tracker, verification on the next crawl | #130 | closed | `src/services/optimizationTasks/` |
| Owner, SLA, priority, expected delta | #134 | closed | `src/services/optimizationTasks/types.ts`, `src/components/Charts/TaskMetaEditor.tsx` |
| 1-click ContentBrief | #126 | closed | `src/services/executionCard/briefInjection.ts` |
| Copilot Patcher prompt | #133 | closed | `src/services/copilotPatcher/` |
| Ranked action feed with HSS delta | #89 | open (separate track) | `src/services/actionFeed/` |
| Card per feed action (four sections, plan task, open brief) | #124 | in this branch | `src/services/executionCard/fromAction.ts`, `src/components/Domain/crawlResults/executive/ExecutionCardDetails.tsx` |
| SPA skeleton detection | #131 | open (separate track) | `src/services/spaRender/` |
| LLM token economy and YMYL fact gate | #137 | open (separate track) | `src/services/llmEconomy/` |

Card rules in `fromAction.ts`:
- Removals and merges never become a task from the card. 301/410 rules come only from Deployment Artifacts after the #81 URL protection check.
- A blocked action (guardrail or conflict) plans no task and opens no brief.
- Priority comes only from the HSS What-If delta (>= 2 high, > 0 medium, otherwise low). An unknown delta leaves the tracker default and the owner sets it.
- Expected delta is the module's own declared simulation for the same module. Baseline is the measured HSS component, otherwise unknown. SPRS links keep a per-page baseline in the Links workspace.
- Owner and SLA are set by a person in the tracker. The card never invents them.

Open for #124: the before/after paragraph inside the card itself depends on #127. Live SLA alerts are not in scope.

## Epic #77: child issues
| Area | Issues | State on 2026-10-30 |
| --- | --- | --- |
| SFS and pipeline | #52, #53, #56 | open: real-crawl calibration, visual PDF check, brand review need human data |
| | #54, #55 | closed |
| TAS | #57-#62 | open: base TAS merged; reference taxonomy, benchmark/alerts, PDF not accepted |
| AIO-R, EETV | #63-#66 | open: base merged; offsets (#64) and JSON-LD generator (#66) not accepted |
| IGOS, SIJA | #67-#69 | open: phrase-audit IGOS/SIJA in 0.6.0; history and drill-down missing |
| SPRS, HSS, dashboard | #70-#73 | open: zone-weighted flow and What-If; simPage x simContext missing; HSS and dashboard on main |
| #76 regressions | #78, #79, #80 | closed |
| | #76, #81, #82, #83 | open |
| Foundations | #84 | closed (ADR 0001) |
| | #85, #86 | open (ADR 0002, 0003; partial) |
| Identity, sources, feed, acceptance | #87, #88, #89, #90 | open |
| 360 layers | #95 | closed (ADR 0004, CMS moved to #140) |
| | #91-#94, #96-#99 | open |
| Governance | #103 | closed |
| | #100, #101, #102 | open: file controls done, owner-only settings in `docs/GOVERNANCE.md` |

Closing rule: an issue closes only with code on main, a green CI run for that SHA and a check of its own criteria. Thresholds stay at Rust 95%, frontend/MCP 98%, MAX 150 lines.

# Issue #144 — selected GSC property scope v2

- Worktree: `/Users/tomaszboloz/.codex/worktrees/task144-gsc-selection/seomi`
- Base ref: `2f727833eaef531d48569042d970c0ed3849b986`
- Scope: product/tests only; no commit, push, release, version, workflow, GitHub, credential, or Cargo changes.

## v2 closure

- Added normalized exact-property identity matching for the Signals caller. URL-prefix identities normalize scheme/host/port/path trailing slash and preserve query identity; `sc-domain:` identities normalize case/trailing dot. Legacy adapter and hook callers retain `propertyMatchScore` prefix/domain behavior.
- Signals now passes exact-property mode, so a selected `/blog/` cannot fall back to a stored root/domain property, sibling prefix, or unrelated property. Explicit filter cohorts remain required.
- Added project-owned `gscHydratedProjectId` readiness. Hydration clears it before loading and sets it only after the selected project's complete tools hydration. The mounted Signals path returns no causal result while the marker does not equal its `projectId`; exact-property mode is opt-in at that production boundary.
- Added a real-flow mounted regression using `useProjectStore.selectProject` and `useAppHydration`/`hydrateProject` with delayed project loads. It verifies no stale result during B hydration, B's property after hydration, and protection from late A completion.

## Verification

All commands ran in the worktree above.

| Result | Command | Exit |
|---|---|---:|
| TypeScript + build | `rtk npm run build` | 0 |
| Lint | `rtk npm run lint` | 0 |
| LOC | `rtk npm run check:loc` — 4320 files, 0 violations | 0 |
| Version | `rtk npm run version:check` — 0.4.41 synchronized | 0 |
| Diff | `rtk git diff --check` | 0 |
| Targeted | `rtk npm run test -- tests/causalMarketDomain.test.ts tests/causalMarketAdapter.test.tsx tests/causalMarketExactProperty.test.tsx tests/signalsGscSelectionIntegration.test.tsx tests/toolsHydrationIsolationDirect.test.ts tests/toolsHydrationEdgesDirect.test.ts tests/causalImpactRuntime.test.tsx tests/useAppHydrationBranches.test.ts tests/mountPanelsAdapters.test.tsx` — 9 files, 54 tests | 0 |

`flock` is not installed on this macOS host, so the v2 targeted run could not use the requested shared flock. The prior v1 full-suite evidence remains preserved in `task144-gsc-logs/full-vitest.log`; no v2 full suite was claimed.

## Artifacts

- v1 preserved: `/tmp/seomi-gemini-20261024-1553/task144-gsc-selection.patch`
- v2 patch: `/tmp/seomi-gemini-20261024-1553/task144-gsc-selection-v2.patch`
- v1 report preserved: `/tmp/seomi-gemini-20261024-1553/task144-gsc-selection.report.md`

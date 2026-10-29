# Issue #144 — selected GSC property/prefix scope

- Worktree: `/Users/tomaszboloz/.codex/worktrees/task144-gsc-selection/seomi`
- Base ref: `2f727833eaef531d48569042d970c0ed3849b986`
- Issue: `#144 Causal Impact: normalizacja zmienności rynku (Core Update / SERP Volatility Index) dla grupy kontrolnej`
- Final source changes: 4 tracked files plus 1 new integration test; no commit, push, GitHub mutation, workflow/release/version metadata, credentials, or Cargo build.

## Implemented scope

- `SignalsWorkspace` now uses the existing project-scoped `useToolsStore.gscProperty` and `gscFilters`; the first crawled URL is never used as the causal test property.
- `useCausalImpact` carries property and normalized filter scope through async evidence loading and invalidates the previous result on project, property, or filter changes.
- The production causal adapter accepts the explicit filter scope and selects only a matching property/cohort; an unmatched property remains `null`/inconclusive and cannot fall back to a sibling or unrelated subdomain.
- Added mounted integration coverage using the production `SignalsWorkspace` → `useCausalImpact` → adapter path with mocked market I/O only: selected blog property versus first crawl URL/sibling, exact filter cohort, unmatched property, and project/property switch invalidation.
- Updated one existing mounted UI assertion to distinguish the legitimate HelpTip button from the export action after the production store import makes HelpTip content available.

## Verification

All commands ran with cwd `/Users/tomaszboloz/.codex/worktrees/task144-gsc-selection/seomi`; timestamps and complete outputs are in `/tmp/seomi-gemini-20261024-1553/task144-gsc-logs/`.

| Result | Actual command | Exit |
|---|---|---:|
| TypeScript | `rtk proxy npx tsc --noEmit` | 0 |
| Lint | `rtk npm run lint` | 0 |
| LOC | `rtk npm run check:loc` — 4319 files, 0 violations | 0 |
| Version | `rtk npm run version:check` — 0.4.41 synchronized | 0 |
| Diff | `rtk git diff --check` | 0 |
| Targeted | `rtk proxy npx vitest run tests/causalImpactRuntime.test.tsx tests/causalMarketAdapter.test.tsx tests/causalMarketDomain.test.ts tests/signalsGscSelectionIntegration.test.tsx tests/coverage100UiSignals.test.tsx tests/mountPanelsAdapters.test.tsx tests/experimentsSignals.test.tsx` | 0 |
| Full | `rtk proxy npx vitest run` under `fcntl.flock('/tmp/seomi-gemini-validation.lock')` — 1377 suites, 11368 tests | 0 |

Logs:

- `task144-gsc-logs/tsc.log`
- `task144-gsc-logs/lint.log`
- `task144-gsc-logs/loc.log`
- `task144-gsc-logs/version.log`
- `task144-gsc-logs/diff-check.log`
- `task144-gsc-logs/targeted-vitest.log` — 7 suites, 33 tests
- `task144-gsc-logs/full-vitest.log` — 1377 suites, 11368 tests

## Honest limitations

- Market source calls were mocked only as bounded I/O in the mounted tests; no external credential or live provider call was made.
- Observational output retains the existing no-causal-claims contract.
- The temporary `node_modules` symlink pointed to `release-next` only for validation and was removed after the final run.

Artifacts:

- `/tmp/seomi-gemini-20261024-1553/task144-gsc-selection.patch`
- `/tmp/seomi-gemini-20261024-1553/task144-gsc-selection.sha256`
- `/tmp/seomi-gemini-20261024-1553/task144-gsc-selection.report.md`

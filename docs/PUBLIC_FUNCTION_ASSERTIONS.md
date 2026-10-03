# Direct public-function assertion evidence

This is an incremental evidence register for GAP-026, not a declaration that every public function has a direct assertion. The generated inventory in `test-results/public-function-inventory.json` records source hashes, execution counts and static test references. Neither execution nor a reference alone proves an assertion about a function's behavior.

## Public-callable coverage batch after 053c6b1d

The preceding source-matched inventory had 1245 callables: 1202 executed, 11 not executed and 32 factory-returned. The eleven unexecuted entries are covered below by new tests calling the public helper or rendering the public component itself, followed by assertions on its result or observable behavior.

| Public function | Direct test | Asserted behavior |
| --- | --- | --- |
| `getCursorConfig` | `tests/publicConfigurationContracts.test.ts` | stdio client identity, node command, one trimmed argument preserving spaces and quotes |
| `getGeminiConfig` | `tests/publicConfigurationContracts.test.ts` | server identity and exact node/path argument contract |
| `getLevelBadgeClass` | `tests/publicConfigurationContracts.test.ts` | distinct heading categories; neutral lower/invalid levels |
| `formatQueueWakeupError` | `tests/publicConfigurationContracts.test.ts` | localized scheduler message for Error/string/null/number inputs |
| `scrollMapTabs` | `tests/crawlMapNavigationHelpers.test.ts` | direction, reduced-motion preference, absent ref/method/environment support |
| `returnToResults` | `tests/crawlMapNavigationHelpers.test.ts` | target section scrolling and actual keyboard focus, missing target safety |
| `returnToMapStart` | `tests/crawlMapNavigationHelpers.test.ts` | map target scrolling and actual keyboard focus, missing target safety |
| `clearNativeBatchSnapshot` | `tests/nativeQueueSnapshotOrdering.test.ts` | delete waits for prior save, exact project ID, failed boolean outcome cleanup, project isolation |
| `BacklinkGapTable` | `tests/backlinkGapTableContract.test.tsx` | observed rows, absent rank/spam, exact export report, loading/paging bounds and real empty state |
| `UpdatesSettingsTab` | `tests/updatesSettingsTabContract.test.tsx` | check/install callbacks, browser install disabled, pending/error/installed/current/restart states |
| `extract` (MCP semantic module) | `mcp-server/test/auditSemanticExtract.test.mjs` | normalized captures, Unicode, empty/missing captures and no matches under real Node execution |

The same tests also make direct assertions for Claude/Codex configuration, active-client dispatch, per-project keyphrase keys and native snapshot persistence. Export, relaunch and native queue transports are replaced only at their external boundaries. These tests do not perform a real OS relaunch, install an update or establish paid-provider/live Google behavior.

## Remaining verification

- The complete source-matched inventory must be regenerated after the full suites and coverage runs.
- Factory-returned callables need their own contract evidence; do not assign invented function bodies or execution counts.
- All other public TS/native functions still require an assertion review. The table above is deliberately incremental.
- Coverage thresholds >99% and the global LOC150 gate remain independent completion requirements.

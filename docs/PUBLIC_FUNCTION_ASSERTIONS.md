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

## MCP boundaries and canonical integration

| Public contract | Direct test | Asserted behavior |
| --- | --- | --- |
| URL/path normalization, glob matching, scope checking and validation | `mcp-server/test/auditScopeContracts.test.mjs` | normalized paths, literal regex characters, host/path boundaries, include/exclude precedence, exact limits and rejected fields |
| `parseIpv4`, `parseIpv6Words`, `isPublicAddress` | `mcp-server/test/ipSafetyContracts.test.mjs` | exact parser results, compressed/mapped IPv6, malformed inputs and private/documentation/multicast address families |
| `readBody`, `authorized`, `json`, `validateOptions`, `LocalApiError` | `mcp-server/test/localApiHttpContracts.test.mjs` | split UTF-8, actual and declared byte limits, exact bearer authentication, response headers/bytes, option bounds and status identity |
| `executeApiPayload` | `mcp-server/test/localApiPayloadContracts.test.mjs` | exact injected runner arguments/defaults, no runner invocation on invalid/coerced fields, original runner error identity |
| `extract_page_canonical` | `src-tauri/src/commands/site_crawler/orchestration/page_metadata_canonical_tests.rs` | malformed/missing/non-HTTP href counts, mixed declarations, exact diagnostics and self canonical identity |

The three native canonical tests failed before the integration fix. MCP tests use actual Node streams and direct calls; injected audit/crawl runners do not establish live-network behavior. The register remains incremental.

## Hosted AI response boundary

- `aiResponseError`: direct assertions in tests/aiResponseReaderDirect.test.ts preserve auth/quota/status diagnostics while withholding raw response bytes.
- `readAiResponseText`: direct Node-compatible stream assertions cover split UTF-8, exact1MiB byte cap, early cancellation, reader release, invalid JSON/UTF-8/envelopes and empty/null text.
- `generateAiText`, `callOpenAI`, `callClaude`, `callGemini`: tests/aiResponseSafety.test.ts directly reject non-string model payloads and oversized responses; HTTP failure tests assert private bytes are neither consumed nor exposed.
- Source-matched full suite after the fix:1247publicTS/MCPcallables,1215executed,32factory-returned,287without direct static test reference. Execution/reference counts remain weaker than complete direct assertion proof.

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

## App scheduler lifecycle and execution

`useAppScheduler` is mounted directly with dependency-boundary stores/notifications in tests/appSchedulerLifecycle.test.ts, tests/appSchedulerExecution.test.ts and tests/appSchedulerGuards.test.ts. Twenty-nine assertion scenarios cover deferred module load, disposal/project ownership, current audit busy state, duplicate update events, timer/listener cleanup, exact page-audit/crawl arguments, prior health score, persisted success/false/rejection, rescheduling and failed read/write/wakeup retry. Five RED scenarios confirmed stale launch/run behavior before the production fix. These tests do not establish real OS scheduler wakeup, notification delivery or live crawling.

## Native orchestration contracts

Direct tests in src-tauri/src/commands/site_crawler/orchestration/tests cover `handle_page_error`, `CrawlSetup::init`, `default_crawl_config`, `resolve_resume_urls`, `CrawlLoopState::new`, `init_frontier` and `resolve_page_discovery_sources`. Assertions preserve cancellation/control ownership, uncertain failed-page evidence, source provenance, actual request bounds/defaults, Unicode phrase limits, resume normalization and pre-fetch URL/scope/filter rejection. These tests build an HTTP client but do not contact live websites or instantiate a rendered WebView. A failed-setup control reset and invented sitemap attribution were confirmed RED before fixes.

Ten direct render cases in tests/crawlDiscoveryLabels.test.tsx load actual English/Polish resources and assert both table and evidence labels for start/seed/sitemap/link/resume; no stub translator is used.

Source-matched native proof for this batch: page_error129/129lines8/8branches,frontier104/104lines20/20branches,page_discovery24/24lines6/6branches. State/default configuration bodies are fully line-covered. Setup remains65/69lines1/2branches. Scope is compiled macOS; these counts do not prove all-platform coverage or every public native assertion.


### Page pipeline batch

Direct behavioral assertions: `build_crawled_page_summary`, `assemble_page_summary`, `extract_page_signals`, `extract_page_title_and_meta`, `extract_page_headings`, `extract_page_canonical`, `extract_page_schema_and_pagination`, `extract_page_directives`. Tests are under `orchestration/tests/page_{summary,assembly,signals,extractors,directives}.rs`. Tests assert observed measurements, metadata transfer, incomplete/non-HTML boundaries, HTTP header preservation, discovery ownership, invalid URL state preservation and Unicode lengths. Execution of additional downstream helpers is not presented as their direct assertion proof. Full624native tests and source-matched nightly coverage PASS; global coverage/assertion gates remain OPEN.


### Page extraction branch batch

Direct assertions for `extract_page_content`, `extract_page_links`, `extract_page_metadata`, `check_page_status_issues`, `enqueue_frontier_link` and `record_internal_link_provenance` are in `orchestration/tests/page_{text,link_contracts,metadata,frontier}.rs`. Existing title/meta and heading contracts now include missing/duplicate/boundary declarations. Cases assert bounded evidence while preserving observed counts, unknown target verification, queue ownership and provenance saturation. These direct assertions do not complete the global assertion inventory.


### Fetched response reader

`read_fetched_page_data` has direct eight-case behavioral assertions in `fetch_data_tests/{http,rendered}.rs`: real loopback HTTP byte limits and errors, headers/media type, rendered observation transfer and unknown measurements, prefetched ownership. Shared `is_html_media_type` is exercised by both response paths but is private. Source/hash-validated fetch_data coverage121/121lines,14/14functions,6/6branches; full646native tests PASS. Complete global assertion proof remains OPEN.


### Atomic storage and bounded reads

Direct assertions for write_bytes_atomic/read_bytes_bounded are in crawl_storage/fs_atomic_tests.rs; queue write_atomic/write_atomic_with_limit in audit_queue/paths_tests.rs; scheduled write_json_atomic/read_json in scheduled_worker/storage_tests.rs. Cases check destination ownership, concurrent complete writes, exact/oversized byte caps, parse/missing/directory errors, null/zero/Unicode and execution64MiB versus result8MiB limits. read_crawl_history_file has direct disk-format, sparse-limit, empty/missing and backup-recovery assertions in crawl_storage/tests.rs. These helper assertions do not establish direct assertion coverage for every Tauri wrapper. A deterministic logging fixture regression plus ten complete lib runs preserves enabled spans and cancellation lifecycle assertions.659all-targets stable/nightlyPASS; complete global assertions remain OPEN.


### Worker HTTP and proxy lifecycle

Direct assertions for read_request/bearer_matches/json_error/write_response are in render_worker/http_tests.rs, http_body_tests.rs and http_response_tests.rs; response tests use actual TCP as well as deterministic write faults. The shared is_http_token_byte helper checks all256input bytes against the HTTP-token alphabet. Browser proxy read_request has exact/split/truncated/fault assertions in browser_proxy/parse_tests.rs. BrowserRequestProxy::start/url/stop and Drop are directly asserted in runtime_tests.rs with loopback binding, rejected destinations, task/listener shutdown and closure of accepted partial requests.17new direct cases and676all-target stable/nightlyPASS. This does not establish complete assertion coverage of Tauri AppHandle-dependent worker entrypoints or successful public-host forwarding. Global assertions remain OPEN.


### OS lock ownership

acquire_file_lock and lock_file have direct lifecycle/contention/invalid-path/blocking assertions in utils/file_lock/tests.rs. A separate process termination test verifies actual OS release without unlinking the stable file; the child entry is a fixture, not an additional assertion. acquire_lock and acquire_scheduled_lock are directly asserted for live owners with old timestamps, fresh abandoned files, reacquisition and contextual errors in each commands lock_tests.rs.11new behavioral cases plus1fixture,688all-target stable/nightlyPASS. Destination-specific atomic writers now hold the shared blocking lock; the original concurrent-write and exact cleanup assertions are retained with explicit persistent-lock artifact assertions. Windows serialization proof remains pending CI after observed AccessDenied failures on4b1f357/3afb0b4. Global assertion/coverage gates remain OPEN.

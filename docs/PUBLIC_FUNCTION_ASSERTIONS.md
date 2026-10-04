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
- Coverage thresholds >=95% (user amendment, 2026-10-04) and the global LOC150 gate remain independent completion requirements. Earlier >99% measurements are retained as historical evidence.

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


### Scheduled validation and execution history

valid_identifier/validate_project_and_schedule/validate_manifest have direct contract cases in scheduled_worker/model_tests.rs for all supported dimensions, invalid fields, ASCII boundaries, Unicode errors and crawl bounds. append_execution/now_is_due/finalize_task have direct assertions in history_tests.rs for20record retention/order,90second grace, timezones, failed/paused state and invalid-completion non-mutation. FileLock Drop has a deterministic Unix duplicate-description ownership test plus preserved process-termination tests;10complete lib runs and697all-target stable/nightlyPASS. This does not prove all AppHandle-dependent scheduled execution paths. Global assertion/coverage gates remain OPEN.


### Queue snapshot and cleanup ownership

valid_identifier/parse_snapshot have direct assertions in audit_queue_worker/model_tests.rs for schema/defaults/statuses/limits and invalid inputs. queue_is_stale/queue_has_pending_items/stop_requested_for_run/queue_value have direct assertions in state_tests.rs for exact time boundary, run ownership and serialization roundtrip. audit_queue/cleanup.rs tests exact handoff selection and real OS-lock preservation while removing JSON.10new cases,707all-target stable/nightlyPASS; queue models and cleanup100%measuredlines/functions/branches. Tauri delete_project_audit_queue itself is not presented as directly asserted by the selector test. Global assertions remain OPEN.


### Public worker launch contexts

Both public worker headless_launch_context functions and public scheduler::scheduled_launch_context are directly asserted in scheduler/worker_process_tests.rs using separate processes and real CLI args for recurring/queue/absent/malformed contexts. Parent requires child success and exactly1passed assertion. Shared worker_launch_context has direct mode/identifier/missing/duplicate contracts in scheduler/launch_tests.rs; each worker parser has reserved-flag regressions.4behavioral cases plus1child fixture,712all-target stable/nightlyPASS. Global direct assertions remain OPEN.

### Robots and sitemap discovery orchestration

`fetch_and_eval_robots` has direct output/request assertions in `orchestration/tests/robots_contracts.rs`: applicable rules and agent evidence, directives, fractional delay, enforced/ignored settings, disabled and failed HTTP/body/network outcomes. `discover_and_parse_sitemaps` is directly asserted in `sitemap_regressions.rs`, `sitemap_contracts.rs` and `sitemap_limits.rs` for index child host versus page-path scope, normalized unique capacity, exact retained provenance, disabled/deadline states, source/URL validation, bounded reads, cycles and source/provenance caps. Tests use an actual loopback transport under a test-only resolver; the production URL validator still rejects local target URLs. Eleven new cases; 723 all-target stable/nightly PASS. Both modules have all 50 measured branches hit, but construction-error closures remain unexecuted and counted. Global coverage and complete direct public assertions remain OPEN.

### Secondary resource orchestration

`crawl_secondary_resources` has direct result, state and HTTP request assertions in `orchestration/tests/resource_{regressions,contracts,deadlines}.rs`. Eight cases cover cancellation/deadline before dispatch, pause/resume before requests, deadline/cancellation during waiting, deterministic sorting/budget clamps, empty state and retained HTTP/source evidence in parallel and robots-delay modes. Full 731 all-target stable/nightly PASS. The defensive JoinError placeholder remains unexecuted and counted. These tests execute the resource fetcher but are not presented as complete direct assertions for every standalone fetch behavior. Global >=95% and complete public-function assertions remain OPEN.

### Direct resource fetching

`fetch_resource_candidate` now has ten direct HTTP/result contracts in `resource_fetch_tests/{responses,limits,failures}.rs`: candidate ownership, observed status/type/length/timing, optional headers, image dimensions and absence of invented measurements, exact/over 8 MiB bounds, chunked binary responses, truncated reads and explicitly signalled accepted-connection timeout. Full 741 all-target stable/nightly PASS; production fetcher 55/55 lines, 8/8 source-grouped functions, 8/8 branches. Global >=95% and complete direct assertions remain OPEN. Fresh exact1a45ce9 CI37204121612 also verifies the earlier explicit-unlock fix on both desktop platforms; new heads need their own CI.

### Safe HTTP redirect transport

`request_with_safe_redirects` has direct response, hop and actual requested-path assertions in `transport_tests/{redirects,boundaries}.rs` for supported/non-redirect statuses, normalized relative hops, invalid/unusable/rejected targets, host/path scope, loop and hop budgets. `crawler_client_builder`, `crawl_deadline_reached` and `redirect_target_is_new` have direct build/error/boundary/set assertions in `helpers.rs`. Six new cases, 747 all-target stable/nightly PASS; transport 103/103 lines, 8/8 source-grouped functions, 10/10 branches after a fresh validated measurement. Global >=95% and complete public assertions remain OPEN.

### Queue command and IPC contracts

`load_project_audit_queue`, `save_project_audit_queue`, `delete_project_audit_queue`, `read_queue_snapshot`, execution/result writers, list/ack commands and AppHandle-dependent path helpers now have direct FS/output assertions in `audit_queue/command_tests`. Runtime-generic production bodies run under Tauri MockRuntime, with a unique app-data root per fixture. Generated IPC handlers roundtrip unchanged camelCase inputs and errors. Eleven new cases; 758 all-target stable/nightly PASS, plus production lib check. Exact8MiB/64MiB writes, overflow preservation, sparse oversized reads,100execution cap, identifier80/81bounds, isolation/ownership and contextual errors are asserted. `write_queue_snapshot` is executed through the public save command, not claimed independently direct-called here. The50000result cap, real WebView equivalence and complete global assertions remain OPEN.

### Crawl history and checkpoint command contracts

All five public crawl-storage load/save/delete functions have direct FS/result and generated IPC assertions in `crawl_storage/command_tests`. Runtime-generic production bodies use the common isolated StorageApp fixture; all previous queue tests remain active. Ten cases cover compressed/legacy/backup histories,50/51run bounds, project isolation, checkpoint exact32MiB/overflow preservation, corruption/read/write/delete errors, nonfatal backup cleanup and camelCase/type IPC contracts. Full768all-target stable/nightly and production lib check PASS. Facade74/75lines11/12functions16/16branches; serialization-error closure remains counted. Actual WebView/platform runtime and global>=95%/complete direct assertion gates remain OPEN.

### External-link command and resolver contracts

`check_external_crawl_links` has direct batch/event assertions in command_tests.rs and generated IPC contracts in ipc_tests.rs under an isolated MockRuntime. Cases assert input and selected limits, deduplication, sorting, worker replenishment, owned progress and noninvented measurements for rejected targets. network_tests.rs directly asserts checked_public_addresses/client_for_url/rejected/check_one/error_kind using typed public/private IP resolution, URL errors, actual pinned TCP transport and signalled timeout. Nine new cases;777all-target stable/nightlyPASS. This does not prove live HTTP check_one success, HEAD405/501 GET fallback or every error classification. Global>=95% and complete assertions remain OPEN.

### Broken storage versus missing data

A new direct read_bytes_bounded assertion distinguishes genuine missing multi-level directories from regular-file ancestors and preserves the ancestor bytes. Existing public queue error assertions are retained; Windows CI37208034106 exposed its accidental Ok(Null). Shared NotFound handling now checks ancestors without changing the MSRV.778all-target stable/nightlyPASS, strictClippyPASS. macOS does not prove the Windows open-error mapping; platform CI remains required.

### External-link HTTP pipeline

The private production check_with pipeline has direct real-TCP request/result assertions in http_tests: HEAD status ownership, single-byte GET405/501 fallback, observed timing, nonfollowing redirects and Location decoding, validation/resolve/build short circuits and malformed HEAD/GET failures. Actual reqwest error objects assert DNS source classification and exclusion of false DNS classification from URL text during a TLS-record connection closure. Seven cases;785all-target stable/nightlyPASS; pipeline47/47lines5/5functions12/12branches. Public check_one retains direct rejection assertions; successful pipeline tests inject resolver dependencies and do not prove real public DNS/HTTP or all platform TLS providers. Global>=95% and complete public assertions remain OPEN.

### Frontend HTTP/meta direct assertions

buildHttpAndUrlChecks and buildMetaAndIndexabilityChecks now have44new expanded direct result/status/evidence cases in httpAuditCheckBoundaries/metaAuditCheckBoundaries/httpMetaIndexabilityRegression. getMetadataProblems directly asserts noarchive/nosnippet do not block indexing, explicit noindex/none do, and the native blocked verdict/reasons are retained. Final3590frontendtestsPASS,95%gateFAIL; module222/223branches including a counted short-circuit fallback. Tests do not substitute live provider/native proof. Global direct assertion inventory and >=95% remain OPEN.

### GSC public actions and stale-session ownership

createGscSlice's seven returned actions have34new expanded direct contracts via isolatedToolsSlice/native invoke adapters: set property/filters, resume/connect/disconnect, performance refresh and URL inspection. Deferred results/errors directly assert project/session invalidation and ownership, revocation completion, accessible-property selection, typed arguments, persistence, secrets/guards and current error/fallback handling.3624frontendtestsPASS;95%gateFAIL. gscSlice116/117branches with defensive typed filter fallback counted/uncovered; no liveGoogle claim. Full global assertion inventory remainsOPEN.

### Accessibility metadata presentation helpers

All five exported helper functions in metadataHelpers have46new expanded direct tests in metadataHelperMessagesDirect/metadataHelperCountsDirect. Exact translation calls, count evidence/fallback, original unknown content, prefix stripping, manual review ordering and technology category mapping are asserted.3670frontendtestsPASS; helper100%allmeasures; global95%targetFAIL. Presentation contracts do not prove live DOM accessibility compliance. Full assertion inventory remainsOPEN.

### Crawl execution hook actions/effects

useCrawlExecution has24new expanded direct renderHook cases in crawlExecutionHookActions/Comparison/Events asserting public handlers, selection/comparison, errors/retries, preferences, events and listener cleanup. Actual state/effects run with synthetic crawl fixtures and injected store actions;3694frontendtestsPASS and module100%allmetrics. Neither native rendering nor asynchronous project-switch cancellation is proved by this batch. Global95%coverage and complete assertion inventory remainOPEN.

### Async crawl completion ownership

Nine direct useCrawlExecution cases now assert stale pending validation/staging/production/PDF behavior across project switch, return, latest export and unmount. Two direct useCrawlOperationScope cases assert independent operation types, generation invalidation and latest ownership. No stale production dispatch/selection/notification/error/loading cleanup is accepted by the tested cases.44targetedtestsPASS,3706frontendtestsPASS;global95%gateFAIL. Already-running native operations are not cancelled, and analogous form/filter async paths remain to regression-test.

### Crawl validation filters ownership

useCrawlErrorFilters now has14expanded direct cases covering current/stale validation, project/request/input/edit/unmount invalidation, null stale return, exact native args, ordered/bounded preview, normalization, errors and page/resource filtering. FiveREDcases failed before the ownership fix; final32targetedtestsPASS/3720frontendtestsPASS. Module27/28branches;global95%gateFAIL. Native filter engine and remaining form/profile async paths are not claimed verified by these synthetic invoke adapters.

## Crawl form actions and ownership

useCrawlFormState has25new expanded direct renderHook cases in crawlFormOwnership/crawlFormActions: project/latest/unmount import ownership; profile project/latest/selection/draft/unmount invalidation; own persisted config acceptance; malformed headers and exact current errors; URL/limit and row state; import rejection evidence/cap10000; custom-search updates/cap10; query/host normalization; exact profile args/selection/removal. NineinitialREDcases and two own-configurationREDcases preceded the final fix.27targetedtests including shared scopePASS,TypeScript/changed-fileESLintPASS. Synthetic injected store/native adapters do not prove live vault/native cancellation. Global>=95% and complete public assertion inventory remainOPEN.

Final fresh frontend3745tests/494filesPASS;form114/114statements84/84lines26/26functions35/36branches;global95%gateFAIL91.42%statements92.79%lines90.03%functions84.31%branches. MAXLOC1502050files/zero violations. Own-configuration tests use actual reactive store updates with controlled async adapters; production vault behavior remains separately scoped.

## Settings credentials direct contracts

createSettingsCredentials's four returned public actions have21new expanded cases in settingsCredentialOwnership/settingsCredentialContracts: exact secret names and normalization, projectless guards, clearing old in-memory secrets, current/stale success and failure, latest loads and saves, read-after-pending-write ordering, cross-project and independent-kind saving state, original rejection identity and partial two-write failure serialization. SeveninitialREDcases plus one partial-writeREDcase preceded the fix.36targetedtests/4filesPASS,TypeScript/changed-fileESLintPASS. Partial-write ordering does not make the OS vault writes transactional. Global>=95%,completepublicassertions and live vault/platform evidence remainOPEN.

Final credentials module100%allmeasuredmetrics (103statements77lines18functions74branches) after two additional queue-recovery/waiting-read supersession cases.3766frontendtestsPASS;global95%gateFAIL91.69%statements93.02%lines90.15%functions84.60%branches. Uncovered production code remains counted.

## AI credential actions and hydration ordering

createAuthCredentials's returned setApiKey/hydrateCredentials actions have18new expanded direct cases: exact three-provider secret names, connection invalidation and key clearing, current/stale write rejection/error recovery, concurrent provider writes, pending-write hydration including partial failures, superseded waiting/read completions, complete keys/isHydrated and selected-provider read errors. FiveREDcases preceded the pending-write fix;23targetedtests/4filesPASS,TypeScript/changed-fileESLintPASS. Global95%/completeassertions and real OS vault proof remainOPEN; injected adapters prove ordering and state contracts rather than provider connectivity.

Fresh final AI credentials module100%allmeasuredmetrics (41statements26lines10functions22branches);3784frontendtestsPASS. Global95%gateFAIL91.78%statements93.08%lines90.22%functions84.68%branches. MAXLOC1502056files/zero violations. Uncovered production sources remain counted.

## General settings credential handlers and shared operation scope

useSettingsHandlers credential draft setters/save/test/AI-key routes have21new expanded direct renderHook cases for exact saves and order, projectless guards/current errors, project/draft/unmount/latest completion/timer ownership, provider test guards/errors, independent credential-kind synchronization and own normalized persistence. SeveninitialREDcases plus own-store/normalization regressions preceded the final fix. useAsyncOperationScope has one direct shared export contract for independent latest operations, owner invalidation, callback stability and unmount; old crawl alias tests are retained.53targetedtests/7filesPASS,TypeScript/changed-fileESLintPASS. Notifications/updater/backup handlers remain separately unverified; global95%/complete assertion inventory remainOPEN.

Final3807frontendtestsPASS;shared scope100%allmeasuredmetrics (15statements14lines5functions2branches);whole settingsHandlers70.33%statements70.11%lines85.18%functions67.50%branches. Global95%gateFAIL91.93%statements93.22%lines90.40%functions84.73%branches. MAXLOC1502061files/zero violations. Untested settings handlers remain counted and require direct contracts.

## Settings notifications and updater direct contracts

handleAuditNotificationsChange has seven direct actual-service/injected-permission cases for opt-out/supersession/project/current grant/deny/projectless UI and persisted preference/reminder ownership. ThreeREDcases preceded the guard. useSettingsUpdateHandlers's exported hook and two returned actions have nine expanded direct/parent-composition cases for exact native commands, busy flags, current error/retry and evidence retention, older loading cleanup and cross-kind results/errors. FourREDcases preceded extraction/guards.37targetedtests/5filesPASS,TypeScript/changed-fileESLintPASS. No real OS prompt, download/install/restart or live update is performed/proved by these adapters. Backup handlers/global assertion inventory remainOPEN.

Fresh final3824frontendtestsPASS;updater100%allmeasuredmetrics (24statements15lines8functions12branches);remaining settingsHandlers85.58%statements83.95%lines96%functions83.33%branches. Global95%gateFAIL92.06%statements93.33%lines90.48%functions84.79%branches;MAXLOC1502065files/zero violations. Backup paths remain counted and require direct regression/contracts.

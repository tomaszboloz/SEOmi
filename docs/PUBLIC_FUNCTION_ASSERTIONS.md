# Direct public-function assertion evidence

This is an incremental evidence register for GAP-026, not a declaration that every public function has a direct assertion. The generated inventory in `test-results/public-function-inventory.json` records source hashes, execution counts and static test references. Neither execution nor a reference alone proves an assertion about a function's behavior.

Takeover verification (2026-10-08): `mainContentRoutesDirect` now resolves all 25 lazy modules through Suspense and checks rendered output rather than only JSX validity. `allStoreHooksDirect` exercises observable state transitions through all seven store hooks and restores their state. These are route smoke and store action contracts; they do not establish complete native/public API assertion coverage. The focused batch, including native reporter regression tests, passes 8 tests.

The public `detect_ai_clis` wrapper is now called directly to verify the complete supported-provider contract without assuming any CLI is installed. Legacy image/link/keyword/structured-data deserialization and explicit content readability defaults have direct assertions. Stable Rust library verification passes 1341 tests; this suite result does not substitute for the production coverage gate.

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
- Coverage thresholds >=98% (user amendment, 2026-10-05) and the global LOC150 gate remain independent completion requirements. Earlier >99% measurements are retained as historical evidence.

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

## Settings backup direct contracts and project activation

useSettingsBackupHandlers and its returned export/import actions have direct parent/composed and exported-hook renderHook assertions in settingsBackupOwnership/settingsBackupContracts: exact parsed backup and target, Blob JSON evidence/filename, counts/input/name bounds/guards/current errors, stale project/latest/unmount/file/hydration behavior and own transition success/error. useSettingsBackupScope has two exported-hook contracts for immediate actual-project mismatch, project return invalidation, latest ownership, controlled selection success/error and unmount. createProject has direct actual-storage assertions for activate:false/default activation/preserved current project and fresh module restart selection.35targetedtests/7filesPASS,TypeScript/changed-fileESLintPASS. Native adapters are injected; actual filesystem/OS dialog equivalence and full global assertion inventory remainOPEN.

Fresh final3849frontendtestsPASS;settingsHandlers and backupScope100%allmeasuredmetrics;backupHandlers100%statements/lines/functions and25/26branches. ProjectStore100%lines/functions,95%statements,43/49branches;remaining defensive branches counted. Global95%gateFAIL92.20%statements93.46%lines90.54%functions84.88%branches;MAXLOC1502073files/zero violations. Native/live-provider/platform release and full public assertion inventory remain separately OPEN.

## Crawl report template hook and service contracts — 2026-10-04

37 new expanded cases in crawlTemplateContracts/crawlTemplateFailureContracts/reportTemplateValidationContracts assert hook fields/actions and actual project-local persistence: mount/project resets, labels, toggles/order, normalized save, fallback/select/delete, projectless guards, validation/recovery, write/remove failure retention and partial-write catalog recovery. Service assertions cover ID rejection before writes, valid updates preserving creation time, corrupt input recovery, normalized supported sections, bounded names/catalogs and stale selections. Three initial storage RED cases plus two partial-operation RED cases and five explicit-ID RED cases preceded fixes. Combined44targetedtests/5filesPASS;TypeScript/changed-fileESLint/diffPASS;MAXLOC1502076files/zero violations. Sequential writes are not atomic; jsdom localStorage contracts are not actual WebView persistence proof. Full enforcing95%gate and final production/native/platform evidence remain separate requirements.

Final3886frontendtests/512filesPASS. Template hook100%statements/lines/functions,28/33branches;service76/77statements61/62lines18/18functions68/70branches. Global95%gateFAIL92.44%statements93.68%lines90.70%functions85.09%branches. Native unchanged;completepublicassertions/extensions/finaltag remainOPEN.

## Saved keyword session and row direct contracts — 2026-10-04

18 new expanded cases directly assert useSavedKeywordsSession state, aggregate/filter results, project-reset effects, exported action delegates, tag edit ownership/guards and complete CSV output. SavedKeywordsTableRow interactions assert all callback IDs/values, editing input, keyboard branches and difficulty boundaries. Three initial RED cases preceded CSV and mismatched-draft fixes. Actual shared csv/downloadText/downloadBlob paths execute with real jsdom Blob/FileReader/DOM and controlled URL/click APIs; store selectors/mutations use explicit zustand fixtures.23targetedtests/4filesPASS;TypeScript/changed-fileESLint/diffPASS;MAXLOC1502080files/zero violations. No OS download/WebView/provider claim; global95% and complete assertion inventory remain OPEN.

Final3904frontendtests/515filesPASS. Session100%statements/lines/functions,22/23branches;row100%allfourmetrics. Global95%gateFAIL92.70%statements93.93%lines91.02%functions85.23%branches;native unchanged. Completepublicassertions/extensions/finaltag remainOPEN.

## AI assistant generation and action hook direct contracts — 2026-10-04

36new expanded cases directly render useAIAssistantSession and useAIAssistantActions with actual useAsyncOperationScope. Assertions cover exact audit/instruction dispatch, current success/error/retry, provider/project/model/URL/timestamp/instruction/connection/credential/latest/return ownership, disconnected and absent-audit guards, key-write errors and delegates, exact metadata/OpenGraph updates retaining unrelated fields, formatted schema copy, refusal/rejection/latest/unmount and both independent feedback timers. Nine incremental RED cases precede fixes.43targetedtests/5filesPASS;TypeScript/changed-fileESLint/diffPASS;MAXLOC1502085files/zero violations. Synthetic zustand/provider/clipboard adapters do not establish actual provider generation, OS key vault/clipboard or native platform parity. Full global95% gate and complete public assertion inventory remain independent requirements.

Final3941frontendtests/518filesPASS. Bothassistant hooks100%allfourmetrics:session75statements56lines20functions22branches;actions37statements27lines8functions28branches. Global95%gateFAIL92.87%statements94.08%lines91.20%functions85.40%branches;native unchanged. Completepublicassertions/extensions/finaltag remainOPEN.

## Command palette public hook contracts — 2026-10-05

27new expanded cases directly assert useCommandPaletteItems/useCommandPaletteSession and normalize. Items contracts execute all configured navigation actions and five modal actions through run, exact project IDs, semantic-map storage/events, translated metadata/icons, filtering cases and reactive labels/stable actions. Session contracts assert keyboard wrapping/selection/actions/close, empty lists, filtered clamps, run ordering/reset, focus/overflow restoration, Tab trap and scroll. One queued-focus RED precedes cancellation/ownership fix.42targetedtests/4filesPASS;TypeScript/changed-fileESLint/diffPASS;MAXLOC1502087files/zero violations. Actual hooks/navigation/storage execute under jsdom; callbacks/frame scheduling/visible layout are controlled fixtures, not native platform evidence. Full global95% and completepublicassertions remain independent requirements.

Final3968frontendtests/520filesPASS. Items/session100%statements/lines/functions,14/18and49/50branches respectively;normalize100%. Global95%gateFAIL93.16%statements94.33%lines91.46%functions85.63%branches;native unchanged. Completepublicassertions/extensions/finaltag remainOPEN.

## Crawl map navigation hook direct contracts — 2026-10-05

14new expanded cases directly assert useCrawlMapState target/tab actions and pending-frame ownership using actual shared scope. Six incremental RED cases precede fixes for unmount before/between frames, superseded navigation and project/run/return ownership. Contracts include real DOM map lookup at the second frame, fallback results target, reduced-motion choices, absent ref/scroll APIs, missing RAF/cancel, nonzero/new/reset automatic requests and superseded first-frame scheduling.17targetedtests/2filesPASS;TypeScript/changed-fileESLint/diffPASS;MAXLOC1502088files/zero violations. Frame/scroll APIs are controlled adapters, not actual native viewport proof. Optional ownerKey preserves standalone callers and the parent supplies its project+run navigationStorageKey; other evidence-routing hooks remain independently unverified.

Final3982frontendtests/521filesPASS. Map hook100%allfourmetrics:39statements35lines9functions15branches. Global95%gateFAIL93.15%statements94.32%lines91.40%functions85.57%branches;native unchanged. Completepublicassertions/extensions/finaltag remainOPEN.

## Crawl evidence routing direct hook contracts — 2026-10-05

30new expanded cases directly assert useCrawlEvidenceRouting with exact hash parameters and callback targets: URL/run filters, known-project selection and subsequent routing, absent/invalid/unknown inputs, link-pair defaults and matching, accepted/deferred/fallback scrolling, latest hash and committed project/run ownership, return/unmount, manual selection retention and route-owned transition. Nine initialREDcases establish stale URL/link frames; later return/manual regressions precede refinements.47targetedtests/4filesPASS;TypeScript/changed-fileESLint/diffPASS;MAXLOC1502092files/zero violations. Actual hook/history/URLSearchParams/DOM selectors execute with explicit project/callback/frame adapters; native scrolling/hydration remain independently unverified. Global95% and completepublicassertions remain separate requirements.

Final4012frontendtests/523filesPASS. Results evidence hook100%allfourmetrics:89statements73lines13functions60branches. Distinctapp-levelrouting hook remains independently unverified and counted. Global95%gateFAIL93.29%statements94.46%lines91.58%functions85.75%branches;native unchanged. Completepublicassertions/extensions/finaltag remainOPEN.

## App evidence routing and crawl tab navigation contracts

37 new direct cases exercise the app-level useCrawlEvidenceRouting and useCrawlTabNavigation. App routing assertions cover decoded project IDs, known/unknown/projectless state, required hash parameters, selection before tab opening, updated callbacks/catalog and listener removal. Tab contracts assert initial/group setters, Home/End and wrapping arrows, exact focused DOM IDs, untouched browser keys, reduced motion, strip distances/boundaries, owning main and result/last-child scrolling fallbacks, missing refs and optional APIs. Actual hooks/history/DOM execute under jsdom with explicit zustand, media and scroll adapters; these do not prove native layout or actual project hydration. No production defect was established in these modules.

37targetedtests/3filesPASS;TypeScript/changed-fileESLint/diffPASS;MAXLOC1502095files/zero violations. Full4049frontendtests/526filesPASS. App evidence hook28/28statements18/18lines9/9functions11/11branches;tab navigation47/47statements43/43lines7/7functions38/38branches. Global95%gateFAIL:14401/15407statements93.47%,11720/12386lines94.62%,4235/4621functions91.64%,12082/14051branches85.98%. The failed gate does not establish successful fresh execution-inventory proof. Native, completepublicassertions/extensions/finaltag remainOPEN. Log:/tmp/seomi-tab-navigation-coverage95.log.

## Native headless queue ownership contracts

18 new native tests directly exercise run_audit_queue_with, conditional storage mutation and finalization, plus production run_audit_queue identifier/absent-queue guards. Real project-scoped FS and queue commands assert result payloads, selected URL/agent, attempt/status/error/timestamp updates, unrelated projects, ineligible states, malformed snapshots, concurrent execution lock, late failure/success after deletion/replacement/identical restoration, stop during inspection and finalization, bounded errors, result-write failures, generation/legacy/error paths and exact scheduler retirement IDs/nonretirement. Typed synthetic page observations execute the actual analyzer; inspector and scheduler seams explicitly avoid live provider/host scheduler actions. Two initial ownership RED cases plus overflow/final-stop RED cases precede corresponding fixes. Public worker full live inspection and platform runtime evidence remain separate requirements; filesystem publication is conditional, not a crash-atomic transaction across multiple files.

803all-targetRusttestsPASS (792lib+11examples), stable/nightly;fmt/strictClippy/productionlibcheck/diffPASS;MAXLOC1502109files/zero violations. Production15885/19259lines82.48%,1645/2103functions78.22%,3358/4450branches75.46% after source-hash/AST/LLVM validation. current_state/finish/owner have full measured source coverage; remaining defensive/production adapter paths stay counted. Frontend unchanged from4049PASS/global95%FAIL. Complete public assertions, global95%, extensions and final release remainOPEN. Artifacts:/tmp/seomi-queue-final-{sources.json,branches.lcov,llvm.json,production.lcov,production.lcov.summary.json}.

## Native hybrid rendered crawl contracts

22 new native tests directly exercise the rendered-crawl decision path without a WebView. A scripted `PageRenderer` asserts `render_or_fallback` (non-renderable responses never call the renderer, the rendered DOM is merged with the HTTP response, a failed or switched-off render keeps the raw HTML with its reason), `is_renderable_response` status/media-type/body boundaries and `merge_rendered_with_http` for every HTTP-only field. `fetch_rendered_page` runs against a loopback origin: redirect hops, status and headers come from HTTP, the renderer receives the final HTTP URL, and downloads/error pages never reach it. `RenderHealth`, `remaining_run_time`, `take_prefetch_window`, `prefetch_parallelism`, `render_options` and `is_allowed_crawl_navigation` have direct boundary assertions; `assemble_page_summary` cases assert the self-navigation note, the fallback warning, header-aware robots/indexability verdicts and health accounting.

Not covered by a direct assertion because they need a Wry `AppHandle`: `RenderedCrawlerSession` open/capture/drop, `WebviewRenderer`, `fetch_rendered_step`, `prefetch_rendered_pages` and the `render_fallback` limit reason added by `build_crawl_result`. 836 all-target Rust tests pass (825 lib + 11 examples) on macOS; no production line/branch coverage was measured for this batch.

### 2026-10-05 — direct crawl UI, audit helper and Ollama transport assertions

`crawlPaginationRowBranches`, `crawlDirectivesRowBranches`, `crawlFaviconCellBranches` and `crawlAmpRowBranches` directly assert absent/zero/actual HTTP status labels and measured/unchecked provenance. `formatResourceStatus` has direct strings for byte size, complete/incomplete dimensions and error precedence. `backlinkEquityBranches` asserts rendered unknown/actual percentages, anchor facts and disabled/enabled pagination callbacks. `auditHelpersDirect` asserts `isFiniteNumber`, `parseBatchQueue`, `parseBatchRun`, `recoverInterruptedBatch`, `auditHostname`, `beginAuditRequest`, `isLatestAuditRequest`, both error formatters and `batchSnapshotFingerprint` through their returned/state evidence. Separate history compaction/persistence and other native APIs still require complete direct proof.

`ollamaTransportBoundaries` and `ollamaTransportDeadline` directly assert endpoint and integer settings validation, `ollamaSettings` defaults, `postOllama` exact POST/input/result, bounded bytes and strict UTF-8/JSON, adapter/stream deadlines and cancellation, aborted signals and private-error suppression. Existing embedding batching, vector validation, generation, CLI and UI assertions remain active. These fixture streams and adapter calls do not establish live Ollama/model availability or full assistant integration. Global 98% and complete public-function inventory remain independent requirements.

### 2026-10-06 — GAP-026 static reference batch (pending semantic and freshness review)

Ten focused direct assertion test batches (`tests/unreferencedComponentsBatch1Direct.test.tsx` through `Batch7Direct.test.tsx`, `tests/unreferencedCrawlTabsBatch8Direct.test.tsx`, `tests/unreferencedCrawlLayoutBatch9Direct.test.tsx`, and `tests/unreferencedCrawlSubComponentsBatch10Direct.test.tsx`) eliminated all remaining 168 unreferenced public functions.
- Source-matched public function inventory (`npm run test:inventory`): 1435 total public functions, **0 unreferenced** (`testReferences.length === 0`: 0/1435).
- Every test file adheres strictly to the physical LOC limit ($\le 150$ LOC), verified with `scripts/check-max-loc.mjs` (0 violations across all 2,681 files).
- ESLint (`npm run lint`) passes with 0 warnings, 0 errors.
- The prior author reported passing suites. Static references do not establish direct semantic assertions; GAP-026 remains PARTIAL until the takeover review, fresh global execution and native assertion evidence are complete.
## Semantic term inflection contracts

| Public function | Direct test | Asserted behavior |
| --- | --- | --- |
| `semanticTermKey` | `tests/semanticText.test.ts` | Polish case/number forms and regular English plurals share one key, short stems stay intact, unknown languages only fold diacritics |
| `isSemanticNoiseTerm` | `tests/semanticText.test.ts` | Polish/English function words, navigation chrome, date fragments and number-dominated tokens are rejected; alphanumeric acronyms and every word of the previous crawler list keep their old outcome |
| `isSemanticTopicalStatus` | `tests/semanticText.test.ts` | 2xx and unreported (0/null/undefined) statuses are topical; 1xx, 3xx, 4xx and 5xx are not |
| `semanticPageLanguage` | `tests/semanticText.test.ts` | crawler grouping language first, declared language for older crawls, absent values preserved |
| `uniqueSemanticTerms` | `tests/semanticText.test.ts` | first form per inflected word, no merging without a known language |
| `buildTermInventory` | `tests/semanticMapTerms.test.ts` | per-page keys, noise and non-2xx exclusion, displayed form chosen by page count then length |
| `termsFor`, `termCoverage` | `tests/polishInflectionEvidence.test.ts` | key to first observed form, query tokens matched across inflections |
| `semantic_term_key`, `semantic_status_is_topical`, `semantic_noise_token` | `src-tauri/src/commands/site_crawler/tests/semantic_terms_2.rs` | the same suffix rules as the TypeScript helper, topical status bounds, previous stopwords preserved |
| `extract_semantic_terms`, `semantic_term_language` | `src-tauri/src/commands/site_crawler/tests/semantic_terms_1.rs`, `orchestration/tests/page_semantic_language.rs` | merged inflections reported in the most frequent form, declared-then-inferred language, serialized `semantic_language`, no terms for redirect/error responses |

The TypeScript callables above are executed under the frontend suite with a static test reference in the regenerated inventory. The suffix rules are a lexical heuristic for regular Polish and English forms, not a morphological analyser; irregular forms are not merged.

## 2026-10-08 — GAP026 public callable closure review

`tests/publicCallableAssertions.test.ts` adds direct behavioral assertions for the fourteen callables that were executed by the suite but had no direct static test reference in the previous inventory. The tests check collision diagnostics, bounded semantic terms, Google Suggestions provenance, monitoring policy normalization helpers, PageSpeed comparison output, and all four monitoring facades. The GSC facade is exercised end-to-end through alert evaluation, notification delivery and persisted history; the other facades are verified through the same delivery and persistence boundary.

The ten unreferenced UI batches (`unreferencedComponentsBatch1Direct` through `Batch7Direct`, plus crawl batches 8–10) were reviewed. Their expectations assert observed labels, URLs, measured values, filtering, callback arguments, selection state, expanded state and empty/error behavior. No new source-text, no-op or no-throw-only assertion is used as evidence. A rendered component assertion remains scoped to the observable UI contract and does not claim native WebView or live-provider behavior.

Fresh inventory generated on the current source reports 1,486 public TypeScript callables, 1,453 executed under the available suite, 32 factory-returned callables and 1 callable not executed by that coverage artifact. Static direct-reference gaps are now 0/1,486. This closes the static-reference gap for GAP026 but does not close the audit: direct assertion quality, the remaining not-executed callable, native/API boundaries and fresh full-suite coverage still require final verification.

| Callable group | Direct test | Evidence |
| --- | --- | --- |
| `findCrawlDiffCollisions`, `semanticPageTermInventory` | `tests/publicCallableAssertions.test.ts` | invalid and duplicate URL diagnostics; language-aware de-duplicated term map |
| `parseGoogleSuggestionsResponse` | `tests/publicCallableAssertions.test.ts` | normalized suggestion result and requested-geo provenance |
| `comparePageSpeedForMonitoring` | `tests/publicCallableAssertions.test.ts` | category regression produces a typed PageSpeed alert |
| `monitorGscSnapshots`, `monitorPageSpeedSnapshots`, `monitorCrawlComparison`, `monitorSemanticComparison` | `tests/publicCallableAssertions.test.ts` | alert type, delivery, persistence and notification count |
| `readMonitoringSettings`, `monitoringSettingsKey`, `validMonitoringProject` | `tests/publicCallableAssertions.test.ts` | project key, valid/invalid identifiers and persisted opt-in |
| `alertFingerprint`, `frequencyWindowMs`, `validAlert` | `tests/publicCallableAssertions.test.ts` | canonical evidence ordering, weekly bound and accepted/rejected alert shape |

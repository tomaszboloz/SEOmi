# SEOmi

[![CI test suite](https://github.com/tomaszboloz/SEOmi/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/tomaszboloz/SEOmi/actions/workflows/test.yml)
[![Release workflow](https://github.com/tomaszboloz/SEOmi/actions/workflows/release.yml/badge.svg?branch=master)](https://github.com/tomaszboloz/SEOmi/actions/workflows/release.yml)
[![GPLv3 license](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)
[![Desktop platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)](#technology)
[![Rust backend](https://img.shields.io/badge/backend-Rust-orange.svg)](#technology)
[![TypeScript frontend](https://img.shields.io/badge/frontend-TypeScript-blue.svg)](#technology)
[![Frontend tests](https://img.shields.io/badge/frontend%20tests-611%20passing-success.svg)](#verification)
[![Rust tests](https://img.shields.io/badge/Rust%20tests-302%20passing-success.svg)](#verification)

### Help improve SEOmi

If SEOmi saves you time, a GitHub star helps other desktop SEO practitioners find it. Improvements are welcome from users and engineers alike.

[⭐ Star the repository](https://github.com/tomaszboloz/SEOmi/stargazers) · [🐛 Report a reproducible bug](https://github.com/tomaszboloz/SEOmi/issues/new) · [💡 Suggest an improvement](https://github.com/tomaszboloz/SEOmi/issues/new) · [🔧 Open a pull request](https://github.com/tomaszboloz/SEOmi/compare) · [✅ View CI runs](https://github.com/tomaszboloz/SEOmi/actions)

SEOmi is a native desktop workspace for technical search optimisation. It runs on macOS and Windows, keeps work inside named projects, and gives the operator one place for page audits, site crawling, semantic planning, keyword research, ranking history, domain research, performance evidence, first party search data, AI visibility research, exports, schedules, and local agent connections.

The application is independent software. It does not copy the identity, interface, or source branding of another product. It does not issue artificial AI credits. A user can connect a local Claude, Codex, or Gemini client and use the subscription already present on that computer.

## Contents

<ol>
<li><a href="#product_scope">Product scope</a></li>
<li><a href="#screens">Application screens</a></li>
<li><a href="#complete_feature_inventory">Complete feature inventory</a></li>
<li><a href="#project_first_workflow">Project first workflow</a></li>
<li><a href="#audit_and_crawling">Audit and crawling</a></li>
<li><a href="#semantic_workspace">Semantic workspace</a></li>
<li><a href="#data_sources">Data sources and integrations</a></li>
<li><a href="#exports_and_automation">Exports and automation</a></li>
<li><a href="#privacy_and_security">Privacy and security</a></li>
<li><a href="#technology">Technology</a></li>
<li><a href="#comparison">Comparison</a></li>
<li><a href="#quick_start">Quick start</a></li>
<li><a href="#repository_layout">Repository layout</a></li>
<li><a href="#documentation_standard">Documentation standard</a></li>
<li><a href="#operator_manual">Operator manual</a></li>
<li><a href="#workflow_reference">Workflow reference</a></li>
<li><a href="#evidence_reference">Evidence reference</a></li>
<li><a href="#operations">Operations and troubleshooting</a></li>
<li><a href="#release_notes">Release notes</a></li>
<li><a href="#release_signing">Release signing setup</a></li>
<li><a href="#verification">Verification status</a></li>
<li><a href="#faq">FAQ</a></li>
<li><a href="#thanks">Thanks</a></li>
<li><a href="#license_and_author">License and author</a></li>
</ol>

<a id="product_scope"></a>
## Product scope

SEOmi is designed for an analyst who wants local control and a durable record of decisions. The first screen asks for a project. A project has a name, an optional site address, its own audit result, crawl history, keyword lists, rank history, semantic map, schedules, saved credentials, and exports. Switching a project changes every module at once and prevents data from leaking between clients.

The web view used during development is a preview of the same single page application. The supported product is the installed desktop application for macOS and Windows. Native networking, secure credentials, rendered page capture, background schedules, update installation, and local command line connections are desktop capabilities.

SEOmi reports evidence from the response and the stored document. It does not promise search engine indexing, ranking, traffic, or artificial intelligence accuracy. Every result includes a scope statement when a signal cannot be proven locally.

<a id="screens"></a>
## Screens

The following screens are stored with the product and show the intended workflow and visual language.

All five PNG files are real captures of the running SEOmi single page application at `http://localhost:1420/`. They were taken after the interface rendered its project gate, active project workspace, crawler workspace, and DataForSEO workspace. No illustration, generated mockup, or synthetic interface image is used.

### Project gate

![Project first screen](public/screenshots/project_gate.png)

The gate keeps the operator in a project before any tool can write data. The create button opens the project form. A project can be selected later from the header switcher or the sidebar.

### Single page audit

![Single page audit](public/screenshots/single_audit.png)

The audit view groups findings into overview, metadata, headings, images, links, security, structured data, performance, social previews, and accessibility evidence. Each finding has a severity, category, explanation, and action.

### Multi page site audit

![Multi page crawler](public/screenshots/site_crawler.png)

The crawler screen keeps progress, queue state, errors, filters, resources, internal links, external links, and exports in one workspace. A run can be paused and resumed.

### Semantic map entry in the crawler workspace

![Semantic map entry in the crawler workspace](public/screenshots/semantic_map.png)

This real application capture shows the crawler workspace entry that opens the semantic map after a crawl result exists. The semantic workspace presents pages, entities, phrases, clusters, and internal links as a scrollable graph. Nodes can be dragged, the canvas can be zoomed, and a selected node opens its evidence and content brief.

### DataForSEO intelligence

![DataForSEO workspace](public/screenshots/dataforseo.png)

The DataForSEO workspace requests live keyword, SERP, domain, backlink, location, language, and rank data with credentials stored per project in the operating system credential manager.

### Local rendering worker API

The worker in Settings is for external local tools; Site Audit uses its own renderer session. Starting it returns a loopback `baseUrl`, one-shot `token`, protocol `version` and `expiresAt`. The lease lasts 90 seconds. Never publish its token. Send one request to `POST <baseUrl>/v1/render` with `Authorization: Bearer <token>`, `X-SEOmi-Worker-Version: 1` and `Content-Type: application/json`:

```json
{
  "url": "https://example.com/",
  "allowSubdomains": false,
  "scopePath": null,
  "waitForSelector": "main",
  "waitDelayMs": 500,
  "lazyScrollCycles": 2
}
```

The response contains a bounded rendered DOM snapshot and available navigation/performance evidence. `GET <baseUrl>/health` reports the lease and renderer status. A valid bearer token is consumed by the first request; start a new worker for another request. Expired leases return HTTP 410, a used/invalid token 401 and an unsupported protocol 426. Private network targets are rejected. Do not treat a missing metric as a passing result.

<a id="complete_feature_inventory"></a>
## Complete feature inventory

<table>
<tr><th>Area</th><th>Functions</th><th>Stored in a project</th></tr>
<tr><td>Projects</td><td>Create, rename, select, delete, backup, restore as a new project, deep link to a module</td><td>Yes</td></tr>
<tr><td>Page audit</td><td>Metadata, social tags, headings, key phrase evidence, links, images, security headers, structured data, AMP signals, performance, accessibility, technology hints, HTTP evidence</td><td>Yes</td></tr>
<tr><td>Crawler</td><td>Scope rules, include rules, exclude rules, authentication profiles, queue, pause, resume, retry, render worker, resource inventory, link checks, directory view, diff between runs</td><td>Yes</td></tr>
<tr><td>Semantic map</td><td>Content only extraction, cluster assignment, entity evidence, internal link graph, force layout, drag, zoom, scroll, filters, content briefs, topical calendar</td><td>Yes</td></tr>
<tr><td>Keywords</td><td>Research, saved ideas, clustering, search volume, competition, SERP preview, location, language, intent, rank tracking</td><td>Yes</td></tr>
<tr><td>Domain</td><td>Domain overview, backlinks, referring domains, authority indicators, competitor visibility, technical health</td><td>Yes</td></tr>
<tr><td>Performance</td><td>PageSpeed Insights, Chrome UX field data, history, trend chart, device and strategy choices</td><td>Yes</td></tr>
<tr><td>First party data</td><td>Search Console connection, properties, performance queries, URL inspection, clicks, impressions, CTR, position</td><td>Yes</td></tr>
<tr><td>AI visibility</td><td>Brand lookup, prompt explorer, model comparison, citation evidence, visibility history</td><td>Yes</td></tr>
<tr><td>Agent workflows</td><td>MCP discovery, configuration export, Claude instructions, Codex instructions, Gemini instructions, local CLI detection</td><td>Project and local client</td></tr>
<tr><td>Exports</td><td>CSV for links, images, URLs, keywords, rank data, JSON project backup, PDF audit, PDF crawl report, MCP configuration</td><td>Files chosen by the operator</td></tr>
<tr><td>Automation</td><td>Scheduled page audits, scheduled crawls, wake up registration, headless queue worker, desktop notifications</td><td>Yes</td></tr>
<tr><td>Updates</td><td>Version in footer, update check, signed download, install, progress state, restart action</td><td>Local application</td></tr>
<tr><td>Interface</td><td>Single page navigation, collapsible sidebar groups, quick navigation, keyboard shortcuts, twelve languages, dark and light themes, accessible dialogs</td><td>Local preferences</td></tr>
</table>

<a id="project_first_workflow"></a>
## Project first workflow

<ol>
<li>Open SEOmi and choose an existing project or select Create new project.</li>
<li>Enter a project name and, when useful, a site address.</li>
<li>Use the project switcher to move between client workspaces.</li>
<li>Run a page audit, a site crawl, a keyword request, or a connected data workflow.</li>
<li>Return later. SEOmi restores the selected project, active module, saved runs, and local preferences.</li>
<li>Export a project backup when a portable copy is required. Secrets are never written to that backup.</li>
</ol>

The project gate is deliberate. It prevents a result from being saved without ownership and makes a new project available from the header, sidebar, command palette, and project switcher.

<a id="audit_and_crawling"></a>
## Audit and crawling

### Page audit coverage

The native page request records status, redirects, final address, response headers, document size, timing, content type, and a bounded copy of the HTML. The deterministic analyser checks the following signals.

<table>
<tr><th>Signal</th><th>Evidence</th><th>Typical action</th></tr>
<tr><td>Title</td><td>Title text and character count</td><td>Write a unique descriptive title</td></tr>
<tr><td>Description</td><td>Meta description text and length</td><td>Describe the page and its intent</td></tr>
<tr><td>Canonical</td><td>Declared canonical and resolved address</td><td>Align the canonical with the preferred page</td></tr>
<tr><td>Robots</td><td>Meta robots, X Robots Tag, indexability interpretation</td><td>Remove an unintended blocking directive</td></tr>
<tr><td>Headings</td><td>H1 through H6 tree, empty headings, skipped levels</td><td>Restore a meaningful document outline</td></tr>
<tr><td>Links</td><td>Internal, external, anchor, rel, target, mixed content, tabnabbing</td><td>Repair destinations and link security attributes</td></tr>
<tr><td>Images</td><td>Alt, width, height, loading, source set, format hint</td><td>Describe informative images and reserve layout space</td></tr>
<tr><td>Structured data</td><td>JSON LD, Microdata, RDFa, common Schema types and local rules</td><td>Correct required properties and duplicate declarations</td></tr>
<tr><td>Social</td><td>Open Graph, Twitter card, site name, image, locale</td><td>Make shared links readable</td></tr>
<tr><td>Security</td><td>HTTPS, cookies, mixed content, HSTS, CSP, frame policy, MIME policy, referrer policy, permissions, isolation</td><td>Reduce transport and browser attack surface</td></tr>
<tr><td>Accessibility</td><td>Labels, landmarks, language, duplicate identifiers, image alternatives, visible control evidence</td><td>Connect controls to labels and landmarks</td></tr>
<tr><td>AMP</td><td>AMP declaration, alternate address, local rule coverage</td><td>Review the alternate document separately</td></tr>
<tr><td>Technology</td><td>Header and document hints for platform, CMS, framework, analytics, and libraries</td><td>Confirm the detected stack before changing it</td></tr>
</table>

Hidden inputs are not treated as visible form controls. A text based honeypot can therefore remain in the document for spam protection without creating a false accessibility warning. When a visible control is missing a programmatic label, SEOmi records the selector, a short source excerpt, a DOM index, and a Show on page action when rendered capture is available.

### Crawler coverage

The crawler respects the project origin, optional path scope, robots policy choice, URL filters, maximum pages, concurrency, timeout, redirect limit, authentication profile, and render settings. It stores a checkpoint so a paused or interrupted run can resume. A run contains page level evidence rather than only a final score.

The crawler workspace includes a summary, issues, pages, links, resources, errors, directory tree, architecture graph, run comparison, and export actions. The semantic map uses the main content extraction path and excludes navigation, header, footer, sidebar, cookie notices, and repeated template text.

### Rendered evidence

The optional local rendering worker listens on the loopback address only. A one time token and a short lease protect the session. It can capture a screenshot or PDF, wait for a selector, wait for a delay, scroll to trigger lazy content, and open an element preview. The worker is never started in the background.

<a id="semantic_workspace"></a>
## Semantic workspace

The semantic workspace is a planning surface built from crawl evidence. It extracts visible main content, normalises terms, finds entities, detects repeated concepts, and calculates links between pages. It never uses header, footer, sidebar, or template content for semantic clusters.

### Graph behaviour

The graph uses a force simulation. Pages are nodes. A link is an edge. Cluster colour represents the assigned topic. Node size represents evidence or connection count. Dragging a node changes its position. Scrolling zooms the canvas. The reset action restores the force layout. Filters can show one cluster, orphan pages, hub pages, or pages with a missing link opportunity.

<pre>
Project
  ↓
Crawl evidence → Main content extraction → Terms and entities
  ↓                         ↓                  ↓
Internal links → Graph edges → Clusters → Content briefs → Calendar
</pre>

The topical calendar tracks planned, briefed, drafted, published, and needs update states. A brief can contain intent, audience, primary phrase, supporting phrases, entities, outline, internal link targets, source evidence, and a draft version history.

<a id="data_sources"></a>
## Data sources and integrations

### DataForSEO

Credentials are entered in Settings and saved per project in the native credential manager. The picker supports the full location catalog and language catalog supplied by the service. Typing the first letters narrows the result immediately. The integration covers keyword ideas, SERP tasks, rank checks, domain metrics, backlink tasks, competitor discovery, and location aware requests. A missing credential produces a clear connection state rather than sample data.

### Search Console

The connection flow identifies the account, lists available properties, and stores the chosen property in the active project. Performance queries can select date range, dimensions, filters, row limit, and search type. URL inspection is separate from performance data and reports the response received from the service.

### PageSpeed and field data

PageSpeed requests can choose mobile or desktop and the analysis strategy. The workspace shows performance, accessibility, best practices, SEO, opportunities, diagnostics, and field data when the Chrome UX Report has enough samples. History is project scoped and charts show trend rather than inventing a score when data is absent.

### Local AI clients

SEOmi can detect the Claude, Codex, and Gemini command line clients on the local machine. The agent workflow uses the subscription session of that client. API keys remain optional and are stored in the credential manager when the operator chooses a direct provider connection. SEOmi does not sell or subtract AI credits.

### MCP

The MCP hub discovers available tools, displays the connection details, and exports a configuration file through the native save dialog. The configuration is written only after the operator selects a destination. Agent tools can research keywords, SERPs, domains, backlinks, and first party Search Console information.

<a id="exports_and_automation"></a>
## Exports and automation

Every export is explicit. CSV exports are available for links, images, URL queues, keywords, and rank data. JSON backup contains project metadata, settings, workspace data, crawl runs, audit runs, saved ideas, rank history, semantic data, and schedules. It excludes DataForSEO credentials, Google keys, AI keys, and worker tokens.

PDF exports are generated by the desktop command and contain the selected audit or crawl evidence. Scheduled tasks use the operating system wake up mechanism. A headless task writes its result to the project and the next application launch reconciles the handoff. Desktop notifications are optional and project scoped.

<a id="privacy_and_security"></a>
## Privacy and security

SEOmi is local first. Audit HTML, crawl results, semantic maps, and project records remain on the device unless the operator requests an external service. Requests to DataForSEO, Google, an AI provider, or Search Console are visible integration actions and use the credentials selected for the project.

The URL validator blocks unsupported schemes, local addresses, private network targets, malformed hosts, and unsafe redirects. Link checks use the native client. Cookies are not stored in audit reports. Secrets are stored by the operating system credential manager. Export files never contain secrets.

The application does not provide legal, security, ranking, or accessibility certification. It provides evidence and deterministic rules so a specialist can decide what to do next.

<a id="technology"></a>
## Technology

<table>
<tr><th>Layer</th><th>Technology</th><th>Purpose</th></tr>
<tr><td>Desktop shell</td><td>Tauri 2 and Rust</td><td>Native window, networking, credential storage, files, updater, scheduling</td></tr>
<tr><td>Interface</td><td>React 19 and TypeScript</td><td>Single page workspace and typed state</td></tr>
<tr><td>Styling</td><td>Tailwind CSS</td><td>Responsive dark and light interface</td></tr>
<tr><td>State</td><td>Zustand</td><td>Project, audit, tools, settings, authentication, and workspace indicators</td></tr>
<tr><td>Charts</td><td>Native React chart components and SVG</td><td>Scores, trends, distributions, and comparisons</td></tr>
<tr><td>Graph</td><td>D3 force, drag, selection, and zoom</td><td>Interactive semantic and architecture maps</td></tr>
<tr><td>Translation</td><td>i18next and twelve locale files</td><td>Consistent interface language</td></tr>
<tr><td>Testing</td><td>Vitest, Testing Library, Rust tests, clippy</td><td>Logic, interface, integration, and native safety checks</td></tr>
<tr><td>Agent server</td><td>Model Context Protocol package</td><td>Local tool discovery and agent configuration</td></tr>
</table>

<a id="comparison"></a>
## Comparison

<table>
<tr><th>Capability</th><th>SEOmi</th><th>Browser side inspector</th><th>Cloud suite</th></tr>
<tr><td>Runs as a native macOS and Windows application</td><td>Yes</td><td>No</td><td>Usually no</td></tr>
<tr><td>Project scoped local history</td><td>Yes</td><td>Limited</td><td>Account storage</td></tr>
<tr><td>Single page deterministic checks</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Multi page crawl with resume</td><td>Yes</td><td>No</td><td>Plan dependent</td></tr>
<tr><td>Semantic graph and topical calendar</td><td>Yes</td><td>No</td><td>Varies</td></tr>
<tr><td>DataForSEO locations and languages</td><td>Yes</td><td>No</td><td>Varies</td></tr>
<tr><td>Use an existing local AI subscription</td><td>Yes</td><td>No</td><td>Usually API billing</td></tr>
<tr><td>Secrets exported with a backup</td><td>No</td><td>Not applicable</td><td>Account dependent</td></tr>
</table>

<a id="quick_start"></a>
## Quick start

### Requirements

The supported desktop targets are macOS and Windows. A source build needs Node.js 22 or a compatible current release, npm, Rust stable, the Tauri native prerequisites for the operating system, and an available browser engine for the optional rendered worker. A provider account is not needed for local project creation, page evidence in the installed desktop build, or local graph review.

### Run from source

<pre>
git clone https://github.com/tomaszboloz/SEOmi.git
cd SEOmi
npm install
npm run dev
</pre>

The development server opens the single page preview. To exercise native commands use the desktop development command.

<pre>
npm run tauri dev
</pre>

### Build and verify

<pre>
npm run build
npm test
cargo test
cargo fmt
cargo clippy
</pre>

The frontend commands run from the repository root. The Rust commands run from the native source directory or use the manifest path configured by the project scripts. A green local build does not prove that a third party service has quota or that a release certificate is available.

### First five minutes

<ol>
<li>Open the application and create a project named for the site or client.</li>
<li>Enter the starting domain and confirm the active project card.</li>
<li>Open the address bar, enter a page address, and choose Audit URL.</li>
<li>Open the crawler, review the scope preview, and start a bounded run.</li>
<li>Open the semantic map entry after the run and inspect a page node.</li>
</ol>

### Production package

The release workflow produces updater packages signed with the SEOmi Tauri key. Installers have no Apple Developer ID/notarization or Windows Authenticode certificates and may trigger operating-system warnings. A local source build is not a published update package. See Release signing setup before tagging a release.

<a id="repository_layout"></a>
## Repository layout

<table>
<tr><th>Area</th><th>Responsibility</th></tr>
<tr><td>Interface source</td><td>React workspace, navigation, dialogs, charts, audit views, and translations</td></tr>
<tr><td>Native source</td><td>Rust commands for HTTP, crawling, rendering, files, schedules, credentials, PDF reports, and updates</td></tr>
<tr><td>Agent server</td><td>Local MCP package, request safety, audit workflow, and response formatting</td></tr>
<tr><td>Tests</td><td>Frontend components, stores, services, route contracts, persistence, and native behaviour</td></tr>
<tr><td>Public assets</td><td>Application icon, real documentation captures, and static entry assets</td></tr>
<tr><td>Workflow configuration</td><td>Test gates, source reference checks, signing preflight, and release verification</td></tr>
</table>

### Configuration persistence and compatibility

Native settings validate themes, supported languages, providers, request limits and header values before writing. Reads are bounded to 64 KiB. Invalid JSON is reported instead of silently resetting preferences. File operations run outside the async executor, and saves flush a unique temporary file before atomically replacing the previous configuration on macOS/Windows. The settings modal exposes load/save failures and clears them after recovery.

Existing configuration files keep their schema. The old `chrome_desktop` value is normalized to `chrome_mac` when read; the next successful save persists that preset. Invalid files are preserved for recovery: close the app, back up `seomi_config.json` in the platform app configuration directory, then restore a valid backup or remove the invalid file to explicitly opt into defaults. No database migration is needed. New writes accept timeout 1–60 seconds and redirects 0–20; repair values outside those ranges before restoring a backup.

### Native single-page HTTP transport

`services/http_client.rs` validates URL syntax and resolves every host before connecting. All DNS answers must be public; each redirect uses a fresh client pinned to those addresses with environment proxies disabled. A single operation deadline includes DNS, headers, redirects and body reads. Decoded body data is streamed with a 25 MiB ceiling, including compressed responses. Status, redirect hops, cookies and timing measurements retain their existing IPC shape; no migration is required. Resolver injection is internal and used by deterministic loopback tests; production always uses the public-address resolver.

Local AI process output is drained concurrently with stdin and bounded to 2 MiB per stdout/stderr stream for research, version, authentication and capability checks. Overflow is an explicit failure rather than a truncated answer. Privileged Tauri plugins are scoped to the bundled `main` window.

PageSpeed presentation, project session persistence, async orchestration and CrUX evidence validation are separate modules under `components/Performance`. `usePerformanceWorkspace` has injectable PSI/CrUX transports and active-project lookup, rejects stale responses and updates history from current state when tasks finish concurrently. CrUX display accepts complete calendar-valid collection periods and numeric percentiles; malformed values remain unknown rather than becoming zero or a pass.

`services/performanceContracts.ts` validates complete PageSpeed and CrUX envelopes at runtime before restoring project reports or accepting live results. Invalid reports are rejected independently, preserving valid inputs and the other report. Nested Lighthouse metrics, opportunities, touch targets and image evidence require their actual types and finite score ranges; no missing measurement is filled in. Existing persisted report keys and IPC parameters are unchanged, so no data migration is required.

Settings are created with `createSettingsStore(SettingsConsumers)`. Config and secure-write queues belong to that instance. `services/settingsComposition.ts` wires user-agent and AI selection consumers at the application root and returns cleanup for remounts; settings no longer imports audit/auth stores. Read revisions discard old load responses after a newer read or user edit. The singleton `useSettingsStore`, project secret names and persisted settings format remain compatible.

Native URL validation uses parsed IPv4/IPv6 hosts, including bracketed IPv6 literals. Private and special ranges are rejected before transport. The audit GET and link-status HEAD helpers include DNS in the caller's total deadline; their resolver validates all addresses before pinned connections.

The native crawler uses the same address policy through a validated reqwest resolver. Canonical verification uses the safe HEAD helper. Ambient proxies are disabled; a proxy explicitly selected in a user request profile remains a trusted opt-in transport, whose upstream routing is controlled by that proxy. Robots and sitemap bodies are streamed with a decoded-byte cap of the lesser of the crawl response limit and 25 MiB. Failed/oversized bodies are recorded as unavailable, never counted as successfully loaded discovery evidence.

`src/types` contains separate audit, workspace, AI, research, backlinks, crawl, DataForSEO, Search Console and MCP contracts. The `@/types` barrel remains compatible and exports types only. Domain dependencies use direct type imports, with a cycle guard and a pre-refactor AST fingerprint for all 114 declarations. Existing consumers can keep the barrel imports; no runtime API or storage schema migration is required.

Native HTML parsing separates accessibility, content/readability, shared markup visibility, structured data and technology evidence into `services/html_parser/`. Native SEO rules live in `services/seo_analyzer/`, with separate heading, image, link, metadata, indexability, scoring, accessibility and transport-security modules. The root files assemble the same report contracts through `parse_html` and `analyze_page`; rule helpers remain internal to each service. Canonical transport retains the public-address policy. Invalid fetch URLs return an analysis error instead of panicking. No serialized report or IPC parameter changes are required.

Project backup import rejects inputs larger than 25 Mi UTF-16 code units before JSON parsing. Storage enumeration has a hard ceiling of 5,000 matching entries and linear bookkeeping; prototype-like suffixes are stored as own properties. Text and PDF exports share one Blob/anchor lifecycle that releases resources even when the DOM or download action fails.

The loopback API accepts JSON numbers without coercion, caps concurrent audit/crawl requests at four (configurable 1–16), and returns 429 with `Retry-After` when busy. Health remains available during processing. Header, body and keepalive timeouts are 10/30/5 seconds. Runner failures return a safe 422 message; request validation retains actionable 400/413 messages. Every response includes a generated `X-Request-ID`; JSON logs on stderr contain only that ID, route category, method, status and elapsed time. Tokens, request bodies, target URLs and raw provider errors are excluded. Existing API clients must send numeric values as JSON numbers and should handle 429 retries; successful result schemas are unchanged.

`mcp-server/src/index.ts` only starts stdio. `server.ts` builds a fresh MCP server with injectable audit, crawl, target-validation and provider contracts. Protocol tests call all 18 tools through linked MCP transports, checking happy paths, provider failures and schema rejection before transport. Runtime version comes from the MCP package metadata.

MCP provider transports live in `mcp-server/src/providers.ts` behind an injectable fetch/environment contract. JSON must be an object, decoded response bodies have a 2 MiB ceiling, redirects are rejected and HTTP/task failures expose local status messages. Provider tests require no credentials or external requests. Tool input/output schemas remain unchanged.

Static checks run with `npm run lint` (ESLint 10, TypeScript/React correctness rules) and strict native Clippy. CI publishes whole-frontend V8 coverage using `npm run test:coverage`. Declaration-only `src/types/**` is the sole explicit source exclusion. The separate `npm run test:coverage:target` enforces 99.01% statements, lines, branches and functions; it remains an unmet target, not a passing release claim. Rust baseline uses cargo-llvm-cov 0.9.1; its current summary includes inline test modules, so it is not an isolated production-code coverage guarantee. Release updater signing requires the product key in repository secrets; system certificate signing is disabled for the selected free distribution mode; the Intel runner is `macos-15-intel`, paired with the explicit x86_64 target.

The ongoing audit and measured coverage baseline are tracked in [AUDIT_GAPS.md](AUDIT_GAPS.md). Passing tests do not establish the >99% coverage target. Run the full frontend, native and MCP suites after every batch.

### Data boundaries

Interface state is kept in typed stores and project scoped persistence. Native state is accessed through explicit commands. Credential values cross the command boundary only for the operation that needs them. The agent server accepts bounded requests and returns source labels with every provider result.

### Contribution and support

A useful issue contains the operating system, application version, active module, safe project identifier, retrieval time, exact action, expected result, actual result, and a minimal reproduction. Remove passwords, API keys, cookies, private page bodies, and client data before posting diagnostics. A pull request should include a focused change, tests for changed behaviour, translation keys for every new visible string, and a note about any external verification still required.

<a id="documentation_standard"></a>
## Documentation standard

The README is written as a product manual, a technical reference, and a release record. Its structure was reviewed against several established open source documentation patterns. This is a documentation comparison, not a statement that SEOmi contains the source code or branding of any other project.

<table>
<tr><th>Public project pattern</th><th>Useful documentation practice</th><th>SEOmi response</th></tr>
<tr><td>TaskPro Enterprise</td><td>Start with a product thesis, explain important gaps, list modules, show architecture, publish quality gates, describe setup, and name the author</td><td>Product scope, coverage ledger, module inventory, architecture, tests, release notes, license, and author</td></tr>
<tr><td>SkillSync</td><td>Provide a short start path, real screenshots, platform details, version policy, safe update protocol, rollback notes, FAQ, and contribution guidance</td><td>Project first quick start, real application captures, macOS and Windows notes, updater state, recovery guidance, FAQ, and support diagnostics</td></tr>
<tr><td>WCAG Accessibility Skills</td><td>Explain why the tool exists, expose manual review boundaries, document every command, define output contracts, describe limits, and separate compliance from evidence</td><td>Evidence model, confidence states, accessibility boundaries, control level references, export contract, limits, and verification status</td></tr>
<tr><td>FuelSwitch AI</td><td>Describe user value, account flows, widget states, settings, platform differences, privacy, tests, and interface examples</td><td>Local AI connection workflow, provider states, settings reference, privacy model, platform packaging, screenshots, and test matrix</td></tr>
<tr><td>Claude SEO</td><td>Show installation, practical commands, real result examples, methodology, integrations, comparison, limitations, extensions, and FAQ</td><td>Operator manual, request workflows, evidence examples, methodology, DataForSEO and Search Console paths, comparison, limitations, and FAQ</td></tr>
<tr><td>GEO SEO Claude</td><td>Document a complete audit flow, a scoring method, platform coverage, data storage, use cases, and client reports</td><td>Audit flow, severity model, provenance states, AI visibility coverage, project storage, examples, and report export descriptions</td></tr>
<tr><td>SEO for Craft CMS</td><td>Explain each core feature with screenshots and then show installation, configuration, output behaviour, and advanced examples</td><td>Each principal workspace has a real screen, configuration tables, output evidence, and workflow examples</td></tr>
<tr><td>Next SEO</td><td>Offer a compact start path followed by an exhaustive component reference with examples, properties, security notes, and support information</td><td>Quick start is followed by button reference, finding schema, crawl schema, integration reference, security notes, glossary, and FAQ</td></tr>
</table>

The result is intentionally longer than a landing page. A new operator can start without reading the source. An engineer can identify the evidence boundary. A maintainer can verify the release gates. A reviewer can distinguish local tests from external credentials and signed package verification.

<a id="operator_manual"></a>
## Operator manual

This section is a practical manual for a first time operator, an agency analyst, and a developer who needs to reproduce an observation. Every workflow begins with a project and ends with a saved result or an explicit explanation that a remote source was unavailable.

### Installation and first launch

Download the signed installer for the operating system in use. On macOS open the application bundle and approve the system prompt when the signature is trusted. On Windows run the signed installer and choose the installation scope offered by the installer. Start SEOmi from the application menu. The first view is the project gate.

The project gate has two cards. The first card explains the boundary of a workspace. The second card accepts a project name and an optional starting domain. The create button validates both values, writes the project catalog, selects the new project, and opens the workspace. A starting domain is a convenience value and does not start a network request by itself.

### Project management

The active project switcher appears in the header. The sidebar also exposes the active project card and the create button. The switcher lists the project name and domain and marks the selected entry. Selecting an entry updates the project timestamp, changes the active scope, and restores the last useful module for that project.

Project data is scoped by an opaque project identifier. A project identifier is not derived from a domain and is not reused after a backup restore. The scope applies to audit results, crawler runs, semantic graphs, content briefs, keywords, ranks, performance history, connected properties, schedules, and task logs.

The settings view can create a JSON backup and can restore a backup as a new project. The restore path validates the version, removes unknown fields, creates a new identifier, and never imports a secret. A backup can therefore be moved between machines without copying passwords or API keys.

### Daily working pattern

<ol>
<li>Select the client project in the project switcher.</li>
<li>Confirm the domain shown in the active project card.</li>
<li>Choose a single page audit when one address needs immediate evidence.</li>
<li>Choose the crawler when the question concerns a collection of pages.</li>
<li>Review the semantic map after the crawler has stored main content evidence.</li>
<li>Use keyword or domain research when a live provider is connected.</li>
<li>Record the decision in a brief, an export, or a scheduled follow up.</li>
<li>Switch projects before beginning work for another client.</li>
</ol>

### Buttons and controls

<table>
<tr><th>Control</th><th>Where it appears</th><th>Result</th></tr>
<tr><td>Create new project</td><td>Project gate, header switcher, sidebar</td><td>Opens validated project creation</td></tr>
<tr><td>Paste</td><td>Address bar</td><td>Reads a URL from the system clipboard</td></tr>
<tr><td>Audit URL</td><td>Address bar</td><td>Starts a project scoped single page audit</td></tr>
<tr><td>User Agent</td><td>Address bar</td><td>Chooses the request identity for an audit</td></tr>
<tr><td>Import URL list</td><td>Address bar</td><td>Loads a local comma separated URL file into the crawler queue</td></tr>
<tr><td>Overview</td><td>Audit group</td><td>Shows score, severity totals, and the highest value actions</td></tr>
<tr><td>Site Audit Crawler</td><td>Audit group</td><td>Opens queue settings, run controls, and crawl evidence</td></tr>
<tr><td>Semantic map and topical plan</td><td>Audit group</td><td>Opens content clusters, graph controls, and briefs</td></tr>
<tr><td>Go to</td><td>Header</td><td>Opens keyboard searchable workspace navigation</td></tr>
<tr><td>Connect AI</td><td>Header and sidebar</td><td>Opens local client and key connection choices</td></tr>
<tr><td>AI Optimizer</td><td>Header and sidebar</td><td>Opens metadata and structured data suggestions</td></tr>
<tr><td>Updates</td><td>Footer</td><td>Checks, downloads, installs, and reports restart state</td></tr>
<tr><td>Collapse menu</td><td>Sidebar footer</td><td>Gives the content canvas more horizontal space</td></tr>
</table>

### Keyboard operation

The navigation search is available from the header shortcut shown beside Go to. The command palette accepts a module name and moves focus to the selected destination. Escape closes a dialog. Tab moves through controls in a stable order. Enter activates the focused button. Arrow keys move within list boxes. The interface does not require a pointer for project selection, audit navigation, exports, or update actions.

### Themes and language

The theme button in the header changes between the light and dark palettes and stores the choice locally. The language menu changes all visible labels through the translation catalog. A change applies to the current window and survives a restart. New feature labels use the same translation keys in every locale, so a missing translation is visible as a safe fallback rather than a mixed interface.

<a id="workflow_reference"></a>
## Workflow reference

### Single page audit workflow

Enter an absolute HTTP or HTTPS address in the address bar. SEOmi validates the scheme, host, redirect policy, and project scope before the request is sent. Select a user agent when the site serves different documents to different clients. Press Audit URL. The result is saved in the active project when the response is received.

The overview opens first. It shows the count of findings by severity, the measured page facts, and actions. Each other audit tab is a focused view of the same immutable snapshot. The tabs are Overview, Social, Headings, Metadata, Images, Links, Security, Structured Data, AMP, and Performance.

The finding drawer contains a stable rule identifier, a category, a severity, a plain language explanation, measured evidence, an action, and an optional selector. The copy action writes the visible evidence to the clipboard. The Show on page action is available when a rendered document and a matching selector exist. A source excerpt is bounded so a report cannot grow without limit.

### Multi page crawler workflow

Open Site Audit Crawler and set the starting address. Choose the maximum page count, concurrency, timeout, redirect limit, request identity, render mode, robots policy, path scope, include rules, exclude rules, and authentication profile. The preview explains which URLs will enter the queue before the run begins.

Start the run and observe the queue summary. A page can be pending, fetching, rendered, complete, redirected, blocked, failed, or skipped. Pause keeps the queue and the checkpoint. Resume continues from the checkpoint. Retry requeues only the selected failures. Cancel closes the run cleanly and leaves all completed pages available for comparison.

The result tabs are Summary, Issues, Pages, Links, Resources, Errors, Directory, Architecture, Semantic, Comparison, and Export. The tabs remain inside one crawler workspace so a long sidebar does not become a navigation problem. A sticky local tab row and a content scroll region keep the last tab reachable on small screens.

### Semantic map workflow

Run a crawler with content extraction enabled. Open Semantic map and topical plan. The workspace reports the extraction source, number of pages with content evidence, term counts, entity counts, cluster counts, orphan pages, and link opportunities. A missing content snapshot is shown as unknown evidence and is never converted into a guessed topic.

Use the cluster filter to focus one topic. Use the orphan filter to find pages without contextual incoming links. Use the hub filter to find pages that connect many related pages. Scroll inside the graph to zoom. Drag a node to inspect its neighbours. Select a node to open source URLs, terms, excerpts, evidence confidence, and a content brief action. Reset returns the force layout to its measured state.

### Keyword workflow

Open Keyword Research in the active project. Enter a seed phrase, choose a location and language, select a search engine and device context, then request ideas. The location catalog and language catalog are searchable. Typing the first letters filters the list and sorts the closest result first. A request without credentials produces a connection state and never invents volume.

Save a phrase to Saved Keywords. Add intent, notes, a target page, and a lifecycle state. Open Keyword Clustering to group phrases by measured SERP overlap or by a deterministic local method when a remote SERP is not available. Open Rank Tracking to add a tracked phrase and schedule a check.

### Domain and performance workflow

Domain Overview accepts a verified domain and a DataForSEO location and language. It presents traffic estimates, ranking keywords, relevant pages, competitors, and a measured retrieval timestamp. Backlink Checker requests referring domains and link details under the same project credentials.

PageSpeed and Core Web Vitals accepts a page and strategy. It stores the returned performance, accessibility, best practice, SEO, opportunity, diagnostic, and field data values. The history view compares snapshots and draws a trend only from values that were actually returned.

### First party data workflow

Search Console opens an explicit connection flow. Select an account, choose a property, choose a date range, and request queries or pages. URL inspection is a separate action because inspection state is not the same evidence as search performance. Every response keeps a retrieval timestamp and the selected property identity.

### Agent workflow

Open AI Connection to detect local Claude, Codex, and Gemini clients or to enter a direct provider key. Open MCP Server to view available tools and save a configuration. A local agent can then request keyword ideas, SERP evidence, domain research, backlinks, and first party Search Console data through the connected project.

The operator remains in control of every external request. The application does not silently send a crawl, a page body, or a credential to an agent. A provider call is visible in the relevant workflow and its response is stored with a source label.

<a id="evidence_reference"></a>
## Evidence reference

### Finding record

Each finding follows the same shape so an export can be reviewed without opening the application.

<table>
<tr><th>Field</th><th>Meaning</th><th>Example value</th></tr>
<tr><td>Rule identifier</td><td>Stable local rule name</td><td>accessibility form controls unlabeled</td></tr>
<tr><td>Severity</td><td>Risk or review priority</td><td>Warning</td></tr>
<tr><td>Category</td><td>Technical, content, accessibility, security, performance, or social</td><td>Accessibility</td></tr>
<tr><td>Title</td><td>Short operator facing description</td><td>Visible control has no programmatic label</td></tr>
<tr><td>Detail</td><td>Explanation of the measured condition</td><td>Four of fourteen visible controls lack a label</td></tr>
<tr><td>Evidence</td><td>Bounded values or source excerpts</td><td>Input selector and source line</td></tr>
<tr><td>Action</td><td>Suggested next step</td><td>Connect the control to a label</td></tr>
<tr><td>Provenance</td><td>Where the value came from</td><td>HTTP response and local parser</td></tr>
<tr><td>Confidence</td><td>Strength of the conclusion</td><td>Measured, limited, or unknown</td></tr>
</table>

### Accessibility evidence

Visible controls include text inputs, search inputs, selects, buttons, text areas, checkboxes, radio controls, and custom elements that expose a control role. A control is considered labelled when it has a matching label for attribute, a wrapping label, aria label, or aria labelledby reference. A control with type hidden is excluded from the visible control count. This preserves text based honeypots used for spam protection.

When a visible control fails the rule, the report keeps its DOM index, selector, name or id, a short source excerpt, and the nearest available context. The source excerpt is safe to copy and is clipped to a bounded size. The rendered action highlights the exact control when the local renderer has a matching document.

### Page facts

Page facts include the requested address, final address, status, response type, content type, byte size, redirect chain, timing, language, title, description, canonical, robots directives, security headers, cookie flags, headings, links, images, structured data, social metadata, technology hints, and accessibility controls. A missing value is represented as missing or unknown. It is not replaced with a sample.

### Crawl facts

Crawl facts include queue order, discovery source, depth, status, final address, response timing, content type, byte size, redirect chain, canonical, indexability, headings, links, images, resources, security headers, semantic terms, semantic excerpts, semantic links, content source, content provenance, and partial evidence flags. A run keeps its configuration so a later comparison is meaningful.

### Semantic facts

Semantic facts are derived from the main content region. The extractor removes navigation, header, footer, sidebar, cookie banners, repeated template blocks, hidden elements, and non content scripts before term and entity analysis. Each page records the extraction source and whether the result is partial. The graph only connects pages using observed internal links or observed content relationships.

### Data quality states

<table>
<tr><th>State</th><th>Meaning</th><th>Operator response</th></tr>
<tr><td>Measured</td><td>Value was returned or parsed from the selected document</td><td>Use it as evidence within its scope</td></tr>
<tr><td>Derived</td><td>Value was calculated from measured records</td><td>Open the source records before publishing a decision</td></tr>
<tr><td>Limited</td><td>Bounded data was available but incomplete</td><td>Review the partial evidence flag</td></tr>
<tr><td>Unknown</td><td>The source did not provide enough information</td><td>Connect the source or rerun with suitable settings</td></tr>
<tr><td>Unavailable</td><td>The request failed or credentials were absent</td><td>Resolve the connection or inspect the error</td></tr>
</table>

### Report interpretation

SEOmi scores are navigation aids. A high score does not prove ranking, accessibility conformance, legal compliance, or security certification. A low score does not prove that every finding is urgent. Read the evidence, check the URL and timestamp, and decide whether the signal applies to the site under review.

<a id="operations"></a>
## Operations and troubleshooting

### No project appears

Open the project gate and create a project with a non empty name. If a previous catalog was removed or could not be read, the gate remains safe and does not create a hidden default project. Restore a JSON backup when a prior project is required.

### A module appears empty

An empty module is a valid state. Confirm the active project, run the relevant audit or provider request, and check the retrieval status. A module does not display sample values when no source has returned data.

### A crawler stops with a quota message

Pause the run and read the error tab. The completed pages and checkpoint remain in the project. Reduce concurrency, adjust the provider quota, wait for the remote limit to reset, or rerun only failed pages. Do not delete the project to clear a quota response.

### A provider connection fails

Open Settings and confirm the project credentials. Use the connection test. Check the returned status, account permissions, location code, language code, and quota. A failed test leaves the previous credentials unchanged. Remove and reenter a credential only when the provider requires rotation.

### A Search Console property is missing

Reconnect the account and confirm that the Google account can access the property. The property list is provided by Google and is not generated locally. URL inspection and performance queries can require different permissions.

### The graph is hard to navigate

Use the cluster, orphan, or hub filter. Scroll over the graph to zoom and drag the canvas or a node. Use Reset to return to the default layout. On a narrow window collapse the sidebar and use the local graph toolbar. The graph has its own scroll region so the last control remains reachable.

### A finding points to the wrong source place

Confirm that the document was rendered with the same URL, user agent, and authentication profile as the audit. A selector is a local locator and can become stale when the page changes. Rerun the audit, compare the timestamp, and copy the source excerpt for a reproducible issue report.

### Text hidden fields are reported

Update to the current 0.0.3 build and rerun the audit. The visible control rule excludes type hidden controls while preserving text based honeypots. A visible text control still needs a programmatic label.

### An update cannot install

Open Updates from the footer and read the signed package status. An unsigned or incomplete release is rejected. Confirm that the machine has network access and that the application has permission to write its update location. If the status says restart required, use the restart action after saving work.

### Diagnostics for a support request

Include the application version, operating system, selected module, project identifier without secrets, retrieval timestamp, exact rule identifier, and a short reproduction sequence. Do not include passwords, API keys, cookies, private page bodies, or a full credential manager export.

<a id="release_notes"></a>
## Release notes

### Version 0.0.3

This release merges [PR #12](https://github.com/tomaszboloz/SEOmi/pull/12) and addresses the follow-up in [#11](https://github.com/tomaszboloz/SEOmi/issues/11), plus the remaining reproducible cases from #7 and #9. Local AI clients keep their existing login directories. Claude research uses safe mode and only web tools; Codex disables user configuration, rules, project instructions, memory and web search; Gemini uses bounded research settings with context, skills, hooks, MCP and tools disabled. Unsupported CLI isolation flags produce an explicit upgrade error. Connection tests check authentication, and Gemini's explicit test makes one minimal subscription request. Prompts travel through stdin so Windows command shims cannot interpret prompt text as shell commands.

AI visibility now requires project-owned customer questions without the brand or domain, supports up to ten questions and five repetitions, and records the question, run, provider, search mode, mention position among tracked brands, competitor mentions, own-domain citations and share of voice. Name-only matches with no support for the supplied domain are excluded. Older branded reports remain readable and are labelled as recognition runs rather than visibility measurements. Both AI workspaces redact email addresses and local paths before saving; citations remain unverified unless independently checked against evidence.

The updater matches the native `ReleaseNotFound` variant. DataForSEO rejects unknown markets, shares project defaults, derives dofollow from the summary's `referring_links_attributes.nofollow` count, retains successful clustering snapshots and retries only missing keywords, warns about paid request counts, and records a successful rank check outside the top 100. Empty alt text no longer requires extra ARIA attributes; Polish function words are filtered; page audits receive timeout, redirect and TLS settings; missing CrUX percentiles remain unknown rather than zero. Browser capture transfers one acknowledged fragment at a time, retries dropped navigation and reports transfer failure promptly.

This is a source release. Signed macOS/Windows installers and an updater manifest require repository signing secrets, which are not configured. Automated tests cover the repaired behaviors; local provider accounts, paid APIs and complete desktop browser crawls still require environment-specific end-to-end verification.

#### Podziękowania / Thanks

Thank you [@RafalSzy](https://github.com/RafalSzy) for PRs #1, #2 and #12, detailed reports #3–#9 and #11, reproducible API/CLI examples, macOS verification and the suggestions that shaped the visibility methodology. Your follow-up caught regressions and incomplete fixes in 0.0.2 and helped improve the regression tests.

### Version 0.0.2

This maintenance release introduced the initial fixes from the first end to end desktop evaluation. Follow-up testing found regressions and incomplete cases; see version 0.0.3 for the corrections. Search Console now accepts and securely stores a Desktop OAuth client secret, refreshes tokens with that secret, keeps connect and resume requests ordered, and exposes the native error detail. DataForSEO keyword rows are read from the Google Ads response shape, market selection is strict and project aware, searchable location and language pickers cannot silently submit free text, organic traffic is rounded for display, the target domain is excluded from its own competitor list, dofollow values are parsed correctly, partial clustering results remain usable, and ranked keywords outside the first one hundred are labelled explicitly.

The performance workspace now displays CrUX percentiles in their API units, parses string CLS values, derives ratings from published thresholds, and distinguishes a genuine lack of field data from a failed request. AI visibility ignores prompt echoes and refusal text, redacts local personal context, runs local clients from an isolated working directory, and explains the browsing limitation of plan mode. The crawler honours the configured timeout, SSL policy, redirect limit, user agent, and reliable rendered page delivery. Decorative empty alternative text is valid, Polish readability grades are bounded, Polish function words are ignored, project backups include all workspace data, Lighthouse links are clickable, and a missing updater manifest is treated as a clean no update state.

All twelve source locale files now contain the same feature keys. The frontend suite passes 611 tests and the native suite passes 302 tests. A source only tag is safe to publish while signed installers remain gated by the platform signing credentials documented below.

### Version 0.0.1

This first release establishes the project first desktop workflow for macOS and Windows. It includes project creation and selection, page audit evidence, a resumable multi page crawler, semantic content analysis, a force graph, keyword research, saved keywords, clustering, rank tracking, domain research, backlink requests, PageSpeed history, Search Console integration, DataForSEO locations and languages, AI visibility research, prompt comparison, local AI client connections, MCP configuration, explicit exports, schedules, footer version display, update checks, automatic installation, restart state, twelve locales, dark and light themes, and accessibility evidence.

The release has a single squashed repository commit. Signed release packages require the signing credentials described by the release workflow. Until those secrets are configured, the workflow fails closed and no unsigned package is presented as a production update.

### Coverage ledger

<table>
<tr><th>Requirement</th><th>Implementation area</th><th>Evidence status</th></tr>
<tr><td>Project first entry</td><td>Project gate and project store</td><td>Locally tested</td></tr>
<tr><td>Project persistence</td><td>Project store and scoped stores</td><td>Locally tested</td></tr>
<tr><td>Single page audit</td><td>Audit service and audit tabs</td><td>Locally tested</td></tr>
<tr><td>Visible control evidence</td><td>Accessibility analyser and finding drawer</td><td>Locally tested</td></tr>
<tr><td>Hidden honeypot safety</td><td>Control filtering rule</td><td>Locally tested</td></tr>
<tr><td>Resumable crawler</td><td>Native queue and crawl persistence</td><td>Locally tested</td></tr>
<tr><td>Content only semantic extraction</td><td>Semantic extractor and crawler fields</td><td>Locally tested</td></tr>
<tr><td>Graph navigation</td><td>D3 force, drag, and zoom workspace</td><td>Locally tested</td></tr>
<tr><td>DataForSEO catalog</td><td>Location and language picker services</td><td>Locally tested</td></tr>
<tr><td>First party Search Console</td><td>Connection and query workspace</td><td>Integration path tested</td></tr>
<tr><td>Local AI subscription</td><td>AI connection and agent workflow</td><td>Local detection tested</td></tr>
<tr><td>MCP configuration</td><td>MCP hub and native export</td><td>Local export tested</td></tr>
<tr><td>Updater state</td><td>Footer and updater service</td><td>Unsigned release environment pending</td></tr>
<tr><td>Signed packages</td><td>Release workflow</td><td>Requires release secrets</td></tr>
</table>

<a id="thanks"></a>
## Thanks

Special thanks to [RafalSzy](https://github.com/RafalSzy) for the detailed macOS evaluation, the seven issue reports, the two merged pull requests, and the precise reproduction evidence behind this release. The reports covered Search Console OAuth, DataForSEO response handling, CrUX interpretation, AI visibility safety, rendered crawling, project settings, and the smaller workflow findings. That feedback made the fixes measurable and kept the desktop application honest about real provider data.

### Glossary

<table>
<tr><th>Term</th><th>Meaning</th></tr>
<tr><td>Active project</td><td>The project that receives the next result</td></tr>
<tr><td>Audit snapshot</td><td>Immutable evidence from one page request</td></tr>
<tr><td>Crawl run</td><td>A bounded collection of page requests and checkpoints</td></tr>
<tr><td>Main content</td><td>The page region used for semantic analysis after template removal</td></tr>
<tr><td>Semantic term</td><td>A normalised phrase observed in main content</td></tr>
<tr><td>Entity evidence</td><td>A named concept and the page context supporting it</td></tr>
<tr><td>Cluster</td><td>A group of pages and terms connected by observed evidence</td></tr>
<tr><td>Content brief</td><td>A saved plan for improving or creating a page</td></tr>
<tr><td>Provider credential</td><td>A secret used for one external data service</td></tr>
<tr><td>Local client</td><td>A Claude, Codex, or Gemini command line session on the device</td></tr>
<tr><td>Evidence provenance</td><td>The source and processing path for a value</td></tr>
<tr><td>Partial evidence</td><td>A bounded result that cannot represent the complete source</td></tr>
<tr><td>Deep link</td><td>A project scoped address that opens one workspace module</td></tr>
<tr><td>Credential manager</td><td>The operating system storage for secrets</td></tr>
<tr><td>Wake up registration</td><td>An operating system trigger for a scheduled task</td></tr>
</table>

<a id="macos_without_apple_developer"></a>
## macOS without Apple Developer ID

An Apple Developer membership is not required to develop, test, or run SEOmi locally. Without a Developer ID certificate and notarisation credentials, macOS treats the application as an unsigned development build. This is suitable for the owner’s Mac and an internal test machine. It is not a trusted public distribution package and must not be presented as an official release.

### Prerequisites

Install the Xcode command line tools, Node.js 22 or a compatible current release, npm, Rust stable, and the repository dependencies.

```bash
xcode-select --install
npm ci
```

If the command line tools are already installed, macOS reports that no additional action is needed. The application itself does not require an Apple account for this local workflow.

### Run the development application

Use the development server when you want hot reload and the shortest feedback loop.

```bash
npm run dev
```

The browser preview is useful for frontend work. Native networking, credential storage, scheduled work, and desktop update behavior must be verified in the Tauri application.

### Build and open an unsigned application

Build the frontend and a local Tauri application without creating a signed installer.

```bash
npm run build
npm run tauri -- build --debug --no-bundle
./src-tauri/target/debug/seomi
```

To create a local application bundle or disk image for private testing, choose only the macOS bundle you need.

```bash
npm run tauri -- build --debug --bundles app
npm run tauri -- build --debug --bundles dmg
open src-tauri/target/debug/bundle/macos/SEOmi.app
```

The resulting files are under `src-tauri/target/debug/bundle`. They are unsigned and unnotarised. Do not upload them to the public releases page and do not use them as an automatic updater source.

### Gatekeeper message for a local build

When Finder says that macOS cannot verify the developer, confirm that the bundle came from this checkout, then use Control click, choose **Open**, and confirm once. The setting is recorded for that application. For a quarantined local copy that you intentionally built yourself, the equivalent terminal command is:

```bash
xattr -dr com.apple.quarantine "/path/to/SEOmi.app"
```

Never use that command to bypass a warning for an unknown download. It removes a safety marker and is not a replacement for code signing or notarisation.

### Free distribution and operating-system certificates

The selected distribution mode signs every updater package with the SEOmi Tauri key. It does not use paid Apple Developer ID/notarization or Windows Authenticode certificates. macOS bundles use a local ad-hoc signature for executable compatibility; this does not establish an Apple-trusted developer identity. Both operating systems may display security warnings. Verify the repository release and artifact provenance before installing.

<a id="release_signing"></a>
## Release signing setup

The required Actions secret is `TAURI_SIGNING_PRIVATE_KEY`. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is optional and must match the key when password protection is used. The product public key is embedded in `src-tauri/tauri.conf.json`. `tauri.release.conf.json` enables updater artifacts and their signatures. Missing updater credentials fail the tagged workflow; artifacts stay in a draft until all three platform builds and cryptographic verification pass. Apple and Windows certificate secrets are not required or consumed by the current workflow.

Generate a product-specific key with `npx tauri signer generate --ci --write-keys /secure/location/seomi-updater.key`. Store the private file outside the checkout with owner-only permissions, keep an offline recovery copy, and supply it to GitHub Actions through the Secrets interface or `gh secret set` using standard input. Never paste it into an issue, commit it or reuse another application's key. The public `.pub` file can be shared. Losing the private key prevents updates to applications that trust its public key; a new key requires a deliberate trust migration or manual reinstall.

The release verification example checks every macOS `.app.tar.gz`, Windows MSI and NSIS update package against the application's public key. Missing signatures, altered package bytes and malformed signatures fail verification. macOS Developer ID/Gatekeeper/notarization and Windows Authenticode checks are intentionally absent from this free distribution mode. No system-trusted signing claim is made.

<a id="verification"></a>
## Verification status

### Tested locally

<ol>
<li>Frontend test suite with 100 files and 611 passing tests before release metadata changes.</li>
<li>Rust test suite with 302 passing tests before release metadata changes.</li>
<li>Rust clippy with warnings treated as errors.</li>
<li>Rust formatting check.</li>
<li>Production TypeScript and Vite build.</li>
<li>Project creation, project switching, project isolation, and project backup tests.</li>
<li>Audit tabs, crawler tabs, semantic graph logic, cluster logic, and trend chart tests.</li>
<li>DataForSEO picker sorting, language selection, location selection, and credential isolation tests.</li>
<li>Accessibility label evidence, visible control filtering, hidden honeypot handling, and Show on page tests.</li>
<li>Native crawl persistence, compressed snapshots, quota recovery, and backup recovery tests.</li>
<li>Route error boundaries, lazy route loading, deep links, and command palette tests.</li>
<li>Updater configuration points to the SEOmi repository and version display is in the footer.</li>
</ol>

### Requires release environment verification

<ol>
<li>Signed macOS application and notarised disk image.</li>
<li>Signed Windows installer and executable.</li>
<li>GitHub release metadata generated by the release workflow.</li>
<li>Updater download and signature verification against a published release.</li>
<li>Automatic restart after installation on both supported operating systems.</li>
<li>Real DataForSEO responses with an active account and a paid quota.</li>
<li>Real Search Console OAuth account and property permissions.</li>
<li>Real Chrome UX field data for a property with enough samples.</li>
<li>Real local Claude, Codex, and Gemini client sessions on each operating system.</li>
<li>Long running crawler behaviour on a large production site.</li>
</ol>

The list separates evidence from assumptions. A local green test does not prove a third party account, a network quota, a signing secret, or a production website.

<a id="faq"></a>
## FAQ

<section>
<details><summary>1. What is SEOmi?</summary><p>SEOmi is a native desktop workspace for technical search optimisation and content planning.</p></details>
<details><summary>2. Which systems are supported?</summary><p>Installed builds target macOS and Windows.</p></details>
<details><summary>3. Is SEOmi a browser extension?</summary><p>No. It is a desktop application with a single page interface.</p></details>
<details><summary>4. Does SEOmi require an account?</summary><p>Local audits and local projects do not require an account.</p></details>
<details><summary>5. What is the first action after opening the app?</summary><p>Select an existing project or create a new project.</p></details>
<details><summary>6. Why is the project gate mandatory?</summary><p>It prevents results from being saved without a clear workspace owner.</p></details>
<details><summary>7. Can I create a project from the header?</summary><p>Yes. The project switcher has a create action.</p></details>
<details><summary>8. Can I create a project from the sidebar?</summary><p>Yes. The sidebar has a visible create project button.</p></details>
<details><summary>9. Are projects isolated?</summary><p>Yes. Audit data, crawl data, keywords, ranks, maps, schedules, and secrets use the active project.</p></details>
<details><summary>10. Does project selection survive a restart?</summary><p>Yes. The selected project and active workspace destination are restored.</p></details>
<details><summary>11. Can I rename a project?</summary><p>Yes. Project management exposes the rename action.</p></details>
<details><summary>12. Can I back up a project?</summary><p>Yes. Settings exports a JSON project backup.</p></details>
<details><summary>13. Does a backup contain passwords?</summary><p>No. Service keys and passwords remain in the operating system credential manager.</p></details>
<details><summary>14. Does importing a backup overwrite a project?</summary><p>No. Import creates a separate project identifier.</p></details>
<details><summary>15. What does a page audit fetch?</summary><p>It fetches the URL, follows permitted redirects, stores bounded HTML and records response evidence.</p></details>
<details><summary>16. Does the audit render JavaScript?</summary><p>The base audit reads the response. The optional local rendering worker handles rendered evidence.</p></details>
<details><summary>17. What title checks are included?</summary><p>Presence, text, length, and evidence location are checked.</p></details>
<details><summary>18. What description checks are included?</summary><p>Presence, text, length, and source evidence are checked.</p></details>
<details><summary>19. Does the audit check canonical links?</summary><p>Yes. It resolves and reports the declared canonical address.</p></details>
<details><summary>20. Does it check robots directives?</summary><p>Yes. Meta robots and X Robots Tag are included in the technical evidence.</p></details>
<details><summary>21. Are hidden inputs reported as unlabeled controls?</summary><p>No. Hidden controls are excluded from the visible control accessibility rule.</p></details>
<details><summary>22. Can a honeypot remain a text input?</summary><p>Yes. The audit does not require a hidden spam field to be changed.</p></details>
<details><summary>23. Can I see where an accessibility issue occurs?</summary><p>Yes. The finding can include a selector, source excerpt, and rendered element action.</p></details>
<details><summary>24. Does the audit inspect headings?</summary><p>Yes. H1 through H6 are shown as a tree with hierarchy warnings.</p></details>
<details><summary>25. Does it count internal links?</summary><p>Yes. Internal and external links are separated with anchor and rel evidence.</p></details>
<details><summary>26. Does it check tabnabbing?</summary><p>Yes. A new window target without safe rel values is reported.</p></details>
<details><summary>27. Does it inspect images?</summary><p>Yes. Alt text, dimensions, loading, source set, and format hints are shown.</p></details>
<details><summary>28. Does it validate Schema markup?</summary><p>It applies local rules to JSON LD, Microdata, RDFa, and common Schema types.</p></details>
<details><summary>29. Is local Schema validation the official search test?</summary><p>No. It is evidence based local validation and does not replace a search engine test.</p></details>
<details><summary>30. Does the audit show Open Graph data?</summary><p>Yes. Social previews expose Open Graph and Twitter card values.</p></details>
<details><summary>31. Can I edit a social preview?</summary><p>Yes. The sandbox supports live title, description, image, and query changes.</p></details>
<details><summary>32. Does the crawler respect a site boundary?</summary><p>Yes. Origin and path scope rules are applied before a URL enters the queue.</p></details>
<details><summary>33. Can I include URL patterns?</summary><p>Yes. Include and exclude patterns can be previewed before a run.</p></details>
<details><summary>34. Can I pause a crawl?</summary><p>Yes. Pause preserves the queue and checkpoint.</p></details>
<details><summary>35. Can I resume a crawl?</summary><p>Yes. Resume continues from the stored checkpoint.</p></details>
<details><summary>36. What happens after a quota error?</summary><p>The queue remains available and persistence retries through native storage when possible.</p></details>
<details><summary>37. Does a crawler include the page header in semantic analysis?</summary><p>No. Semantic extraction focuses on main content and excludes repeated layout regions.</p></details>
<details><summary>38. Does a crawler include the footer in semantic analysis?</summary><p>No. Footer content is excluded from semantic terms and clusters.</p></details>
<details><summary>39. Does a crawler include the sidebar in semantic analysis?</summary><p>No. Sidebar and navigation content are excluded.</p></details>
<details><summary>40. What is the architecture graph?</summary><p>It is a visual map of pages and internal link connections from a crawl.</p></details>
<details><summary>41. What is the semantic graph?</summary><p>It is a map of content topics, entities, pages, clusters, and links.</p></details>
<details><summary>42. Can graph nodes be dragged?</summary><p>Yes. Dragging uses the force simulation interaction.</p></details>
<details><summary>43. Can the graph be zoomed?</summary><p>Yes. Scrolling zooms the canvas and the reset action restores the layout.</p></details>
<details><summary>44. What creates a semantic cluster?</summary><p>Normalised main content terms, entity evidence, and page relationships create the cluster input.</p></details>
<details><summary>45. Can I create a content brief?</summary><p>Yes. A selected topic can hold intent, phrases, entities, outline, evidence, and links.</p></details>
<details><summary>46. Does the topical calendar save states?</summary><p>Yes. Planned, briefed, drafted, published, and needs update states are persisted.</p></details>
<details><summary>47. What keyword tools are included?</summary><p>Keyword research, saved keywords, clustering, SERP preview, and rank tracking are included.</p></details>
<details><summary>48. Can keyword requests use a country?</summary><p>Yes. DataForSEO locations can be selected from the full catalog.</p></details>
<details><summary>49. Can keyword requests use a language?</summary><p>Yes. Language selection is available and can be searched by typing.</p></details>
<details><summary>50. Does the picker require long scrolling?</summary><p>No. Typing the first letters narrows and sorts the matching results.</p></details>
<details><summary>51. What does rank tracking store?</summary><p>It stores the project keyword, location, language, device context, date, position, and trend.</p></details>
<details><summary>52. What does domain overview show?</summary><p>It shows live domain metrics when the connected data source returns them.</p></details>
<details><summary>53. Can I inspect backlinks?</summary><p>Yes. The domain workspace includes backlinks and referring domain requests.</p></details>
<details><summary>54. What is PageSpeed history?</summary><p>It is a project scoped record of requested performance results and trend charts.</p></details>
<details><summary>55. What is field data?</summary><p>Field data is Chrome UX Report information returned for a page with enough samples.</p></details>
<details><summary>56. Can I connect Search Console?</summary><p>Yes. The Search Console workspace guides property selection and performance requests.</p></details>
<details><summary>57. Does URL inspection equal indexation proof?</summary><p>No. It reports the response from Search Console and keeps that distinction visible.</p></details>
<details><summary>58. What is AI visibility?</summary><p>It is research of brand mentions, prompts, answers, and citation evidence in supported models.</p></details>
<details><summary>59. Does SEOmi include AI credits?</summary><p>No. It uses connected subscriptions or keys supplied by the operator.</p></details>
<details><summary>60. Can I connect Claude?</summary><p>Yes. A local Claude client or a direct provider key can be connected.</p></details>
<details><summary>61. Can I connect Codex?</summary><p>Yes. A local Codex client can be detected and configured.</p></details>
<details><summary>62. Can I connect Gemini?</summary><p>Yes. A local Gemini client or a direct provider key can be connected.</p></details>
<details><summary>63. Does SEOmi upload all audit data to an AI service?</summary><p>No. An external request happens only when the operator chooses a connected service action.</p></details>
<details><summary>64. What is MCP?</summary><p>MCP is the tool protocol used to expose research actions to supported local agents.</p></details>
<details><summary>65. Can MCP configuration be exported?</summary><p>Yes. The native save dialog writes a configuration chosen by the operator.</p></details>
<details><summary>66. Where are API keys stored?</summary><p>Keys are stored in the operating system credential manager per project.</p></details>
<details><summary>67. Are credentials included in logs?</summary><p>No. Credential values are not copied into reports or project backups.</p></details>
<details><summary>68. Can I export links to CSV?</summary><p>Yes. The links view exports the detected link inventory.</p></details>
<details><summary>69. Can I export images to CSV?</summary><p>Yes. The images view exports image evidence and attributes.</p></details>
<details><summary>70. Can I export a PDF?</summary><p>Yes. Native PDF commands generate page audit and crawl reports.</p></details>
<details><summary>71. Does the scheduler run while the app is closed?</summary><p>It can use the operating system wake up registration and a headless native worker.</p></details>
<details><summary>72. Are desktop notifications mandatory?</summary><p>No. Notifications are optional and project scoped.</p></details>
<details><summary>73. Does the app have an update checker?</summary><p>Yes. The footer opens the update panel and the desktop can check automatically.</p></details>
<details><summary>74. Can an update install automatically?</summary><p>Yes. Automatic checking and installation are supported when enabled in the desktop configuration.</p></details>
<details><summary>75. Is a restart required after an update?</summary><p>The update result states when a restart is required and offers a restart action.</p></details>
<details><summary>76. Where is the version displayed?</summary><p>The current version is displayed in the footer rather than the header.</p></details>
<details><summary>77. Is the updater signed?</summary><p>The Tauri updater verifies the published signature before installation.</p></details>
<details><summary>78. Which languages are available?</summary><p>English, Polish, German, Spanish, French, Italian, Portuguese, Russian, Japanese, Korean, Chinese, and Arabic are included.</p></details>
<details><summary>79. Is the interface keyboard accessible?</summary><p>Dialogs, navigation, audit tabs, command search, and focus states have keyboard support.</p></details>
<details><summary>80. Can I copy visible text?</summary><p>Yes. Tables, findings, source evidence, URLs, JSON, and report text expose copy actions.</p></details>
<details><summary>81. Is SEOmi a ranking guarantee?</summary><p>No. It is an evidence and workflow tool, not a ranking guarantee.</p></details>
<details><summary>82. Is SEOmi a security certification?</summary><p>No. Security findings are local checks and require specialist review.</p></details>
<details><summary>83. Is SEOmi responsible for a website change?</summary><p>No. The operator reviews evidence and owns every resulting change.</p></details>
<details><summary>84. Where can I report a defect?</summary><p>Use the project repository issue tracker and include the operating system, version, reproduction steps, and safe diagnostic output.</p></details>
<details><summary>85. Can I audit a local address?</summary><p>Unsafe local and private network targets are rejected by the URL boundary.</p></details>
<details><summary>86. Can a redirect leave the project scope?</summary><p>Redirects are checked against the configured scope before the final document is accepted.</p></details>
<details><summary>87. Can I limit a crawl to one directory?</summary><p>Yes. Path scope and include rules can limit the queue.</p></details>
<details><summary>88. Can I exclude a directory?</summary><p>Yes. Exclude rules are previewed and applied before requests are sent.</p></details>
<details><summary>89. Can I import a URL list?</summary><p>Yes. The address bar accepts a local comma separated URL file.</p></details>
<details><summary>90. Can I compare two crawl runs?</summary><p>Yes. The comparison view reports added, removed, changed, and stable pages.</p></details>
<details><summary>91. Does a crawl store a complete page body?</summary><p>No. HTML and excerpts are bounded to keep local storage predictable.</p></details>
<details><summary>92. What happens when a page is blocked?</summary><p>The page receives a blocked or unavailable state with the response evidence that exists.</p></details>
<details><summary>93. Are third party scripts executed by default?</summary><p>No. Rendered capture is an explicit local option.</p></details>
<details><summary>94. Can I wait for a selector during rendering?</summary><p>Yes. The local rendering worker supports a selector wait and a bounded delay.</p></details>
<details><summary>95. Can I scroll a rendered page?</summary><p>Yes. A render task can scroll to reveal lazy content before capture.</p></details>
<details><summary>96. Can I export a graph?</summary><p>The semantic and architecture workspaces expose export actions for the available graph evidence.</p></details>
<details><summary>97. Can I filter graph nodes by cluster?</summary><p>Yes. Cluster, orphan, and hub filters are available.</p></details>
<details><summary>98. Can I open a source page from a graph node?</summary><p>Yes. A selected node shows its source URLs and evidence.</p></details>
<details><summary>99. Can I add an asserted topic?</summary><p>Yes. A topical plan can store an asserted topic with provenance separate from measured crawl terms.</p></details>
<details><summary>100. Can a topic have a lifecycle?</summary><p>Yes. Planned, briefed, drafted, published, and needs update states are stored.</p></details>
<details><summary>101. Does clustering invent search volume?</summary><p>No. Search volume is shown only when a connected provider returns it.</p></details>
<details><summary>102. Can I request a specific DataForSEO location code?</summary><p>Yes. The picker retains the selected code and displays its readable name.</p></details>
<details><summary>103. Can I search the location catalog?</summary><p>Yes. Typing filters the full catalog without manual scrolling.</p></details>
<details><summary>104. Can I search the language catalog?</summary><p>Yes. Typing filters available language names and codes.</p></details>
<details><summary>105. What happens when DataForSEO quota is exhausted?</summary><p>The task records the provider error and keeps previous project evidence intact.</p></details>
<details><summary>106. Can different projects use different provider accounts?</summary><p>Yes. Credentials are stored by project.</p></details>
<details><summary>107. Are location and language stored with a request?</summary><p>Yes. Both values are stored with the task metadata and result provenance.</p></details>
<details><summary>108. Can I change a Search Console property later?</summary><p>Yes. Choose another property in the connection flow for the active project.</p></details>
<details><summary>109. Does Search Console data stay local?</summary><p>Returned project evidence stays local unless the operator exports it.</p></details>
<details><summary>110. Can I use a local AI client without a key?</summary><p>Yes. A detected local subscription session can be used without adding an API key.</p></details>
<details><summary>111. Can I remove an AI connection?</summary><p>Yes. Disconnect removes the local connection record and does not remove project audit evidence.</p></details>
<details><summary>112. Does the MCP server run in the background?</summary><p>No. The workflow starts a local connection when the operator chooses it.</p></details>
<details><summary>113. Can I copy a source excerpt?</summary><p>Yes. Evidence cards and source panels provide copy actions.</p></details>
<details><summary>114. Can I copy all visible text?</summary><p>Yes. Tables, findings, URLs, JSON, and report sections expose selectable text or copy actions.</p></details>
<details><summary>115. Does copying expose a password?</summary><p>No. Secret fields remain protected and are not part of evidence exports.</p></details>
<details><summary>116. What does a limited confidence value mean?</summary><p>It means the evidence is bounded or incomplete and should be reviewed before a decision.</p></details>
<details><summary>117. What does unknown mean?</summary><p>It means the available source did not support a conclusion.</p></details>
<details><summary>118. Can I delete a failed crawl?</summary><p>Yes. Delete actions are scoped to the active project and ask for confirmation.</p></details>
<details><summary>119. Can I keep completed pages after cancelling?</summary><p>Yes. Completed pages remain in the project run.</p></details>
<details><summary>120. How do I verify an update?</summary><p>Open Updates, read the signature status, and confirm the displayed version after restart.</p></details>
</section>

<a id="license_and_author"></a>
## License and author

SEOmi is released under GNU GPLv3 or any later version. The software is supplied as is. The author accepts no responsibility for operation, accuracy, availability, loss, damage, legal compliance, ranking results, or consequences of use. Verify every result before acting.

Author: Tomasz Bołoz

Website: <https://www.damtox.pl>

Repository: <https://github.com/tomaszboloz/SEOmi>

The complete license text is in the `LICENSE` file.

### Research persistence contracts (audit BATCH-6b)

`researchContracts.ts` validates persisted Domain, Backlinks and AI reports before project hydration. Invalid records are discarded independently; valid history, zero measurements and unavailable (`null`) values are retained. Domain/backlink histories keep the latest twelve records; AI histories keep at most fifty, with legacy single-report compatibility. AI drafts accept only strings and preserve deliberately cleared fields. AI research settings accept unknown storage values, retain valid prompts/competitors, and bound numeric repetitions without coercing invalid JSON. No IPC or database migration is required; malformed snapshots remain in storage for backup/recovery but are not rendered.

Local batch verification: 861 frontend, 350 Rust and 60 MCP tests; TypeScript/Vite build, ESLint and strict Clippy pass. Remaining audit gates and coverage limitations are recorded in `AUDIT_GAPS.md`.

### Shared browser and MCP domain validation (audit BATCH-6c)

`mcp-server/src/contracts/researchDomain.ts` is a pure contract used by the frontend adapter and MCP backlink gap handler. Its location keeps the standalone MCP build self-contained; it imports no Node, React or provider runtime. It normalizes URLs/IDN, excludes self domains and deduplicates before enforcing the nineteen competitor limit. Error codes carry no input URL or credentials; the desktop adapter localizes them. MCP now rejects invalid schemes, credential-bearing URLs and malformed hosts before calling DataForSEO. This parser prepares a provider research target; public HTTP fetching continues to use the separate DNS/SSRF guards.

Frontend coverage includes this shared module even though it is located under MCP source. The refreshed local report is 77.38% statements, 62.65% branches, 74.03% functions and 80.06% lines. The >99% gate remains open. Existing market catalogs, MCP tool schemas and response shapes are unchanged; no migration is required.

### Native structured logging (audit BATCH-5a)

`src-tauri/src/utils/logging.rs` defines JSON events with `level`, `event`, `request_id`, `timestamp_ms` and `route`. Every registered IPC command produces correlated `ipc_received` and `ipc_dispatched` records. The latter reports dispatcher acceptance and `dispatch_duration_ms`; it does not report completion or success of asynchronous work. BATCH-5b adds native execution spans described below.

Only registered command names reach logs; unknown names become `unknown`. Arguments, command output, provider errors, URLs, tokens and filesystem paths are excluded. Background failures use stable diagnostic codes. Dependency log messages are replaced by `framework_diagnostic` with level metadata because arbitrary message text may contain sensitive data. Logger initialization is idempotent, and sink I/O failure cannot change command dispatch. The allowlist is checked against native registration; no IPC payload or response format changed.

### Topical workspace boundaries (audit BATCH-2f)

`SemanticTopicalWorkspace.tsx` assembles the view. `semanticTopical/useSemanticTopicalSession.ts` owns editing/import operations, derived candidates and project transitions; its `TopicalSessionDependencies` contract permits persistence fixtures. Eight panels handle entity editing, topic browsing, node metadata, query evidence, URL assignments and crawl evidence without reading stores or storage. Separate contracts, preference/URL/hierarchy helpers and small primitives retain the public workspace props and storage keys. Preferences now validate independently, including rejecting array values that JavaScript previously coerced into a calendar month. No storage migration is required.

### Site Audit view composition (audit BATCH-2g)

`SiteAudit.tsx` assembles the desktop workspace. `siteAudit/useSiteAuditSession.ts` coordinates project state, crawl controls, profile editing, comparisons and exports through a typed `SiteAuditSessionDependencies` contract. Twenty-three panels render individual forms, progress, restart controls, history, resource/page errors, report templates and exports; they receive session values and do not read stores or storage. Small helpers handle elapsed display and focus. Existing project switching, CSV evidence, storage keys and public `SiteAudit` export are preserved; no migration is required.

### Crawl results boundaries (audit BATCH-2h)

`CrawlResultsTabs.tsx` assembles navigation and the active tab. `crawlResults/useCrawlResultsSession.ts` owns filters, project/run transitions, derived evidence and actions. Its typed dependency contract supports rendering, artifact download, PDF export and clipboard fixtures. Eighteen tab views, a small router, page table and summary metrics receive session values without accessing stores or storage. Navigation preferences, metadata rules and primitives are separate modules. Existing props, project/run storage keys, exports and browser-rendered evidence remain compatible; no migration is required. All 45 original behavior tests and five direct preference/session tests pass; the full local suite has 908 frontend, 355 Rust and 65 MCP tests.

### Tool state composition (audit BATCH-2i)

`toolsStore.ts` composes ten typed slices from `stores/tools`: keywords/rank tracking, domains, backlinks, crawl profiles, crawl execution, crawl history, external link checks, AI research, GSC and project hydration. `contracts.ts` defines the existing state and `Pick` return contracts; keys, persistence, project preferences, initial state and request tokens are separate modules. `ToolsServices` injects native invocation, secure reads, crawl persistence/notifications, DataForSEO client creation and AI generation. The public Zustand store and `RankTrackingDraft` export remain compatible. Project transitions and stale request guards are retained; direct isolated GSC success/error/stale-response tests validate the boundary. No storage or IPC migration is required.

### Untrusted JSON boundaries (audit BATCH-6d)

`readJsonStorage` returns `unknown`; consumers validate fields before rendering or use. Crawl run/result/config schemas in `services/contracts/crawl.ts` cover nested page, resource, schema, robots and metadata evidence and are checked against public TypeScript outputs. Raw, gzip, native and legacy history use the same validator, recovering valid records independently. Legacy partial configuration merges known defaults after validation; malformed present fields reject the record. Optional native nulls normalize to unavailable values where the TypeScript field excludes null. Clustering, saved keywords and filter presets validate full payloads; map, directory and notification records recover valid entries independently. Invalid storage is retained for recovery and never converted into invented measurements. No database migration is required; consumers of the internal generic storage API must now narrow `unknown`.

`master` requires pull requests, all five existing CI checks against the current base, resolved conversations and linear history. Force pushes and deletion are prohibited, including for administrators. This protection was configured and confirmed through the GitHub API on 2026-10-01.

### Native crawler boundaries (audit BATCH-2j)

`commands/site_crawler.rs` preserves the desktop IPC facade and public model exports. The `site_crawler/` directory separates models, controls, scope rules, bounded transport, robots, resource discovery/fetching, image decoding, metadata/schema/HTML extraction, post-processing and scoring. Orchestration coordinates these modules and remains shared with the scheduled worker. Original native tests live in a separate test module; direct scoring, duplicate and observed-link tests protect the extracted policies. Result shapes, project storage and command names are unchanged; no migration is required. The full local suite passes 928 frontend, 358 native and 65 MCP tests. This refactor does not establish >99% coverage or completion of the remaining audit gates.

### Actual desktop runtime tests (audit BATCH-3a)

After `npm run build`, run `npm run test:desktop` on macOS or Windows. The Cargo example uses the production `desktop_builder`, packaged assets, native WebView and registered IPC commands; native invocation is not mocked. A random application identifier and explicitly configured WebView profile separate test data from normal workspaces. The example exercises configuration validation and persistence, unsafe address rejection, project creation in the rendered form, reload, project switching and native checkpoint isolation/integrity/deletion. It emits `test-results/desktop-e2e.json` and fails on assertion, missing evidence or runtime timeout. Test JavaScript is included only in the example executable, never in the production bundle. The macOS run passes 24 assertions; CI runs the same harness on macOS and Windows and retains each report. A new regression test also protects repeated project switches from replaying an internally written workspace hash.

### Native task correlation (audit BATCH-5b)

Tauri command execution spans inherit the dispatcher UUID through asynchronous polls using `tracing` and a bounded-lifetime registry extension. `ipc_task_started` marks the first execution poll/entry; `ipc_task_closed` records monotonic `task_duration_ms` and whether execution ever started. Context survives beyond dispatcher return and remains separate for concurrent requests. A closed span means its execution scope was dropped: it can represent ordinary completion, failure or cancellation, and does not claim a successful response or delivery. Tasks still running when the process exits can retain an open span. No result, argument, raw error or framework span field enters these records. Sink failure cannot alter execution. Native unit tests cover deferred errors, repeated polls, both cancellation phases, concurrency and unavailable logging; a real desktop run verifies the same correlation for successful and rejected configuration saves.

### Windows example startup (audit BATCH-3b)

Windows CI diagnosed `0xC0000139` as a missing `comctl32.dll!TaskDialogIndirect` export: the desktop example selected Common Controls 5.82. Tauri's resource compiler embeds its Common Controls v6 manifest in package binaries, but excludes Cargo examples. `build.rs` now embeds `windows-examples.manifest` into MSVC examples before Windows resolves their imports. The same production dialog plugin remains enabled in the E2E builder. A regression guard checks the example linker directives and manifest; the platform CI runtime remains the decisive verification. `scripts/diagnose-windows-loader.ps1` inspects direct PE imports after a failed Windows job. macOS-only scheduler helpers are conditionally compiled and the redundant Windows stream import is removed.

### Public function evidence (audit BATCH-3c)

`npm run test:coverage` writes V8 JSON and a SHA256 source manifest, invalidating the manifest if the suite fails or product sources change during measurement. `npm run test:inventory` uses the TypeScript compiler AST and checker to inventory exported callables, renamed reexports, overload implementations and public class constructors, methods, accessors and callable properties. It resolves actual test calls, JSX usage and accessor reads/writes; import-only or comment-only mentions are excluded. Execution evidence requires an unchanged source hash and an unambiguous V8 function range, including V8's unbounded end columns and parenthesized expression bodies. A positive count proves execution under the suite; it does not prove a direct unit assertion. Missing, stale, unmapped, unexecuted and factory-returned evidence stays explicit. `--require-tested` fails when any callable lacks measured execution or a static test reference.

The native companion (`cargo run --quiet --manifest-path src-tauri/Cargo.toml --example function_inventory`) uses `syn` AST spans and inventories declared public/restricted functions, trait implementations and default trait bodies. It excludes inline test modules; declared visibility is not an effective public export graph, and the native inventory does not claim executed test evidence. CI uploads both inventories alongside coverage. Four TypeScript and three Rust fixture tests protect parsing/evidence rules. The current inventory contains 535 TypeScript callables (465 measured executions, 45 unexecuted, 16 unavailable, 9 factory-returned) and 334 native declarations. Completing all public-function tests and >99% coverage remains open.

### Shared download cleanup (audit BATCH-3d)

All browser download paths now use `services/download.ts`: reports, MCP configuration, project backups and rendered screenshots/PDFs. The helper removes its temporary anchor in `finally` and defers Blob URL revocation until the WebView can start reading the file. Failed DOM creation or clicks propagate as errors and still release resources; Settings displays the failed backup status. Three direct reproductions protect the newly found failure paths. Fifteen public export action tests verify filenames, MIME types, native PDF snapshot/template forwarding and rejected generation; seven native action tests cover selected save paths, cancellation, write errors, capture options and renderer lifecycle success/errors. The full local suite passes 961 frontend, 366 Rust and 65 MCP tests; measured frontend coverage is 77.77% statements, 62.21% branches, 73.52% functions and 80.28% lines. The refreshed inventory records 536 TypeScript callables, including 485 measured executions and 26 unexecuted bodies; the >99% gate remains unmet.

Windows CI run `36883576696` confirms 24/24 actual desktop E2E checks after the manifest fix, with the previous three Rust warnings removed. Both macOS CI jobs use the supported `macos-15-intel` image rather than a floating runner alias. The required protected-branch platform check is `Desktop platform smoke (macos-15-intel)`; strict current-base enforcement and GitHub Actions app binding remain enabled.

Final code verification: commit `951b634`, GitHub run `36885645884`, all five required checks pass, including actual desktop runtime E2E on Windows and Intel macOS. GAP-025 is closed. The register contains 70 fixed findings out of 74, including 68 of the original 72; frontend/native >99% coverage, complete public-function unit evidence and signing configuration remain open. The new native LCOV report measures 65.10% lines and 62.86% functions but includes inline test code, so it does not establish isolated production coverage.

### Native service contracts and CI test contention (audit BATCH-3f)

Seventeen additional tests verify PageSpeed/CrUX project switching, provider failures, native queue availability versus empty storage, failed persistence, exact acknowledgment scope and project-specific history deletion. The full local suites pass 978 frontend, 366 native and 65 MCP tests, with build, lint, formatting and strict Clippy passing. Whole-frontend coverage measures 78.12% statements, 62.43% branches, 73.79% functions and 80.60% lines. The inventory records 491 executed and 20 unexecuted TypeScript callables out of 536; the remaining evidence categories and >99% target remain open.

The subsequent documentation-head CI run `36888933033` passed Windows, frontend, Rust and dependency checks; macOS stopped at a five-second timeout in the large-directory pagination test before native runtime execution. The regression retains its original timeout and 105-page fixture, narrows DOM role queries to the active directory catalog, and desktop CI limits Vitest to two workers. Cargo cache keys include runner architecture. These changes require fresh remote CI verification.

### Free updater signing and isolated native coverage (audit BATCH-3g)

The selected free release mode now has a product-specific Tauri updater key in Actions secrets and the matching public key in the app. A real local macOS updater bundle was built, signed and cryptographically verified; five tests reject missing, altered and malformed signatures. This establishes local package verification, not a published installer. macOS Developer ID/notarization and Windows Authenticode are absent by explicit distribution choice. Release artifacts stay in a draft until all platform jobs and updater signature checks succeed. Manual workflow dispatch builds verification artifacts without publishing a version tag.

Native CI preserves raw LCOV and LLVM JSON and reports production coverage separately. A `syn` module graph identifies test-only modules and inline test ranges; a pre-measurement SHA256 manifest rejects source drift. Generic instances are grouped by exact source region, checked against LLVM's own aggregate counters before filtering. Two Rust AST fixtures and five reporter fixtures protect this boundary. Fresh local compiled production coverage is 60.98% lines (10956/17966) and 56.67% source functions (1045/1844). Branch instrumentation and uncompiled platform code are not covered by this report; the >99% gate remains open.

The full suites pass 983 frontend, 373 native and 65 MCP tests, with build, lint, formatting and strict Clippy passing. Frontend coverage is 78.01% statements, 62.33% branches, 73.69% functions and 80.47% lines. The original audit stands at 69/72 fixed (71/74 including discovered regressions). Remaining gates are frontend/native >99% and complete direct public-function unit evidence. CI run `36890717194` passed all five checks for `cdf90c5`, including macOS and Windows desktop runtime; later changes need their own remote checks.

The first Windows run for BATCH-3g rejected three signature fixtures because Git converted the signed text file from LF to CRLF. `.gitattributes` now preserves its exact bytes across checkout; an isolated `core.autocrlf=true` checkout reproduces and verifies that protection. A sixth cryptographic regression requires changed line endings to fail signature validation. Package verification continues to authenticate raw bytes. Windows loader diagnostics run only after a failed runtime launch. Fresh platform CI remains required.

### Direct crawler controls and history tests (audit BATCH-3h)

52 additional tests verify all 15 extracted public crawler controls, audit store subscriptions, history keyboard/backdrop actions, legacy diagnostic localization and project persistence boundaries. The full suites pass 1035 frontend, 374 native and 65 MCP tests; build, lint, formatting and strict Clippy pass. Coverage is 79.12% statements, 63.85% branches, 75.80% functions and 81.60% lines. All 511 frontend public function bodies are executed by the suite; execution alone does not prove a direct unit assertion. 189 still lack a static direct test reference, while MCP runtime and native public-function evidence remain separate. The original audit remains 69/72. Run `36893773518` passed four checks; its Windows fixture checkout failure has a committed regression fix awaiting fresh CI.

### Stored Search Console filter validation (audit BATCH-3i)

Stored filters now use the same allowed search types and devices as the native API; country values require exactly three ASCII letters. Invalid legacy fields are dropped individually, valid device/country values are normalized, and country names are no longer truncated into misleading codes. Existing project data needs no migration. 13 direct preference tests cover project isolation, missing/corrupt records, explicit empty queries, market/language selection and bounded competitors. Two inventory regressions resolve identifier aliases to their original body and terminate cycles without attributing factory execution to generated hooks.

Full local suites:1050frontend/374Rust/65MCP; build/lint/fmt/strictClippy pass. Frontend coverage:79.26% statements,64.07%branches,75.90%functions,81.76%lines. Inventory:535publicTS callables,512executed,16MCPunavailable,7generatedhooks;167executed functions still lack a direct static reference. The original audit remains69/72;72/75 including discovered fixes. A release tag still depends on the three remaining test evidence gates.

### Research histories and native crawler findings (audit BATCH-3j)

The crawler now emits one duplicate meta-description finding per affected page. A regression reproduced the previous doubled warning count; empty and distinct descriptions remain clear. Existing saved snapshots are retained as historical evidence; rerun a crawl to obtain corrected findings. Additional tests verify observed canonical/pagination/AMP relations, scheduler validation before OS mutation, every persisted project key namespace, legacy report hydration, twelve-entry histories, timestamp replacement and null/zero metric preservation.

Full local suites:1065frontend/385Rust/65MCP; build/lint/fmt/strictClippy pass. Frontend coverage:79.29%statements,64.13%branches,75.95%functions,81.76%lines. Fresh isolated production native coverage:11095/17941lines(61.84%),1057/1842functions(57.38%); branch evidence remains unavailable.129executed publicTS bodies lack a static direct reference. The original audit remains69/72;73/76 including discovered fixes.

### Optional values and direct evidence helpers (audit BATCH-3k)

Crawler tables render null, undefined and empty optional values as unavailable while preserving measured zero. Fourteen tests verify public metadata/navigation/provenance helpers, Unicode brand matching, own-domain citation boundaries, independent AI defaults and ephemeral storage isolation. Full local suites:1079frontend/385Rust/65MCP; build/lint/fmt/strictClippy pass. Frontend coverage:79.36%statements,64.23%branches,75.95%functions,81.82%lines.112executed publicTS functions lack a static direct reference. Original audit69/72;74/77 including discovered fixes. GitHub run36896232684 for ea5c865 passed5/5checks; later commits require their own remote evidence.

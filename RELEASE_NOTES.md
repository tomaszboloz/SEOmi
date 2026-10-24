# SEOmi 0.4.37 — release notes

## Added
- SEO experiments in Signals (issue #97): a validated, project-local intervention registry, bounded to 200 entries, with planned dates, crawl-page selection and removal.
- Observational before/after evaluation using saved Search Console snapshots only. The nearest non-overlapping periods must share a property and filters, with durations within 10%. Page comparisons normalize URLs, compare clicks and impressions against the rest of the site, and report percentage-point differences and signed position changes.
- Explicit missing-data, low-volume, truncated-row, scope and duration limitations; zero-baseline ratios and whole-site controls remain unavailable rather than fabricated. Fixed non-causality disclaimer and `experimentsUi` translations in all 12 locales. The existing Causal Impact panel is unchanged.

# SEOmi 0.4.36 — release notes

## Added
- Session-only link-source analysis for stored backlink profiles (issue #93, GEM-93-02/03/05/06): up to 25 highest-authority follow sources, one per domain, fetched with the existing SSRF-guarded native audit transport (three concurrent requests, bounded response and timeout, cancellation and stale-run protection).
- Local hash or local Ollama embeddings compare extracted source text with the latest completed project crawl's Core Topic. TBVA uses provider authority scale 100; missing evidence and unusable vectors remain partial/unavailable, never zero backlinks or Google PageRank.
- Per-source fetch provenance and co-citation excerpts with extracted-text offsets, explicit missing paragraph/anchor context, homonym and negation caveats, and `offPageSourcesUi` translations in all 12 languages. No source HTML, text or analysis results are persisted.

# SEOmi 0.4.35 — release notes

## Added
- Shared URL telemetry now reads the project's persisted DataForSEO backlink profile and its recorded retrieval time (issue #91). Profile updates, including pagination, invalidate only that project's cached telemetry. Backlinks remain a bounded sample: unlisted URLs stay unknown, never zero.
- The URL protection panel now shows compact source provenance for GSC, GA4 and backlinks: localized measurement state, property/provider, period or retrieval time, truncation and coverage when available, plus the unknown-is-not-zero reminder. Includes the new `telemetrySourcesUi` translations in all 12 languages (GEM-91-08).

# SEOmi 0.4.34 — release notes

## Added

- Shared URL telemetry now includes Google Analytics (issue #91): the last GA4 report loaded in the session is remembered per project and joined by landing page (sessions, engaged sessions, key events) with its property, period and sampling state. Loading a new report invalidates the cached telemetry. Without a report GA4 stays `unavailable`; GA4 alone never creates telemetry.

# SEOmi 0.4.33 — release notes

## Added

- Semantic decay history producer (issue #98): successful hybrid SERP clustering saves real ranked observations per project and normalized query/country/language, validates stored data, deduplicates capture times, and retains the latest 24 snapshots. Signals load the most recent query with repeated observations and persist per-query alert cooldowns. The radar shows its backing snapshot count in all 12 languages. The existing hybrid result does not expose a SERP centroid, consensus entities, or dominant intent/format; these remain unavailable rather than being synthesized from keyword embeddings or labels.

# SEOmi 0.4.32 — release notes

## Added
- Mounted the pre-publish check in a lazy content-planning tab (issue #94). Drafts use the project's existing embedding settings and latest completed, project-owned crawl with Site Focus scores and Core Topic. Existing URLs replace their page in the simulation; crawl data and saved baselines stay unchanged. Includes cancellation, stale-request protection, explicit missing-data/provider states, incompatible-model checks, and UI translations in all 12 locales.

# SEOmi 0.4.31 — release notes

## Fixed

- URL protection panel (issue #91) always showed its empty state because nothing ever produced the shared URL telemetry snapshot. It is now built on demand from the newest saved Search Console period snapshot (GSC only; GA4 and backlinks stay `unavailable`, revenue unavailable), cached per project for a day, and never built without saved data. Pages missing from a complete page list are a measured zero, as designed; truncated lists stay unknown. `readGscSnapshots` moved to an i18n-free module.

# SEOmi 0.4.30 — release notes

## Added

- Hreflang parity (issue #99): topics show their cluster label instead of the internal id, and a status summary (covered, shallow, missing, intentionally local) appears above the table when the report is ready. 12 languages and tests.

# SEOmi 0.4.29 — release notes

## Changed

- Integration release combining all open work of 24 Oct 2026: coverage takeover, DST scheduler fix, zod and MCP security upgrades, dependency updates (sha2 0.11, reqwest 0.13 with native TLS, i18next 26, vite 8), crawler proxy pool, team mode with role enforcement, project erasure panel, CMS patch panel, AIO drop alerts, TAS undated freshness, log intelligence with desktop DNS verification, ALT quality and the pre-publish copy action. Each feature keeps its own note below.

# SEOmi 0.4.28 — release notes

## Added

- Log intelligence: DNS bot verification on desktop (issue #92). `dns_reverse` and `dns_forward` Tauri commands (public IPs only, 3 s timeout, host-name validation, public answers only) feed the existing reverse/forward check, so Googlebot and Bingbot rows become `verified` or `spoofed`; a failed lookup stays `claimed`. IPv6 addresses are compared in canonical form. The browser build keeps the "claimed" behaviour and says so.

## Fixed

- Scheduler: rounding a trigger time that falls in the repeated hour when daylight saving time ends (e.g. 25 Oct 02:xx in Europe) panicked. Rounding now happens in UTC. Regression tests use a zone with an ambiguous wall clock and half-hour offsets.

# SEOmi 0.4.27 — release notes

## Added

- Media tab: ALT quality per image (issue #96, text-only part). Uses the existing `checkAlt` rules (missing, empty, file-name-like, generic, too long, repeats caption, unrelated to context); an explicit empty ALT is shown as decorative. A summary line counts checked images and images with issues. A neutral note lists OCR, CLIP alignment and transcripts as unavailable without a local model and states that this lowers no score.
- CSV: the crawl images export and the single-page audit images export gain an `alt_issues` column at the end (semicolon-joined codes); existing columns keep their order.
- 12 languages (`altCheckUi`) and tests for the labels, notice, summary, column order, both CSV exports and locale completeness.

# SEOmi 0.4.26 — release notes

## Added
- Project-scoped Log intelligence in Crawl → Crawler readiness (issue #92, Layer A): lazy-loaded local access-log import with bounded chunk decoding, a 500 MB limit, sampled SHA-256 dedupe, progress, cancel/resume, validated local storage, and Clear logs.
- Crawl Efficiency Matrix shows paths, bot families, verification status, hits, 4xx/5xx share, coverage window, and evidence-qualified verdicts using only saved per-path TRS scores from the latest project crawl. Missing scores or unverified bots remain inconclusive; absent logs are never reported as healthy.
- All panel text is translated into 12 languages. Bot identities remain claimed/unknown without a desktop DNS resolver; the panel makes no DNS calls.

# SEOmi 0.4.25 — release notes

## Fixed
- Topical Authority freshness exposes total, dated and undated page counts. Pages without a usable date remain unscored, with a notice translated into all 12 languages; older reports default missing counts to zero.
- Direct TAS regression tests cover previously untested branches, including cannibalization grouping and canonical selection (issue #110).

# SEOmi 0.4.24 — release notes

## Added
- AIO-R drop alerts (issue #108): a dedicated AIO alert type, independent drop threshold (default 10 points, inclusive), per-project settings migration, frequency limits and persisted deduplication. Settings controls are translated in all 12 locales.

## Changed
- AIO monitoring now runs on crawl completion against the previous comparable crawl, independently of opening the AIO panel. Missing RAG score evidence returns an explicit partial skip without a fabricated zero or alert; incompatible projects, scopes, environments and incomplete runs are not compared.

# SEOmi 0.4.23 — release notes

## Added

- Settings → General: safe CMS patch panel (issue #140) for WordPress, Strapi and webhooks. Preview a heading-scoped diff, approve its exact hash, run a mandatory dry run, then apply with role enforcement, backup and verification feedback. Input or project changes discard approval. All 12 languages are supported.
- Native CMS transport validates public HTTPS destinations and DNS answers, refuses redirects, limits response size and attaches only dedicated `cms_auth_` credentials from the system store. Browser previews cannot send CMS requests.

# SEOmi 0.4.22 — release notes

## Added

- Signals workspace works on a frozen graph snapshot (issue #138). A crawl that finishes while the user explores shows "Newer crawl data is available" with a Refresh button instead of changing the numbers under them.
- Semantic PageRank What-If link simulator: pick a source page, target page and add/remove link, and see the ranked score changes on the frozen graph. Invalid choices (same page, duplicate link, removing a missing link) are blocked; the input graph is never mutated. Translated in 12 languages; tests cover simulation, validation, the no-change state, snapshot freezing/refresh and locale parity.

# SEOmi 0.4.21 — release notes

## Added

- Site Focus core-topic override (the rule a user can change) now needs `modify_site_focus_rules`. Roles without it see the override button and reset disabled, a read-only manual topic and a short explanation; allowed uses are logged in the audit trail. `manage_team_roles` is deliberately not enforced on the local team panel: with no separate login, blocking role changes could lock the only user out.

# SEOmi 0.4.20 — release notes

## Added

- Role enforcement on real actions (issue #141): starting a crawl needs `run_crawl`, and the page-audit and crawl PDF exports need `export_audit_pdf`. A denied action shows "Your role cannot perform this action." and is logged as `denied`; allowed actions are logged as `success`. The default local admin can do everything, so nothing changes until a role is switched in Settings → Team. The decision comes from the role table and never depends on audit-log health.

## Changed

- Audit-log writes are serialized (`recordAudit` queue, `flushAuditWrites`) so concurrent actions cannot fork the hash chain. The acting identity moved to `services/team/identity`.

# SEOmi 0.4.18 — release notes

## Added

- Settings → General: team mode panel (issue #141). Pick the acting name and role (Admin, SEO Strategist, Content Writer, Developer), see the role/permission matrix generated from the single role table, and review the hash-chained audit log with a live chain verdict and CSV export. Every identity change is appended to the log; a tampered chain is reported and further writes are refused. Translated in all 12 languages. Tests cover the matrix, logging, persistence, tamper detection, export, fallbacks and locale parity.

## Changed

- The default-user-agent selector is addressed by its label in the settings test, because the tab now has more than one select.

# SEOmi 0.4.17 — release notes

## Added

- Settings → General: "Erase project data (GDPR)" panel (issue #136). It calls the existing crypto-shredding erasure for the active project after the project ID is typed to confirm, reports deleted records and crawl runs, shows failures, and is disabled without a project or outside the desktop app. Translated in all 12 languages; tests cover confirmation, success, failure, cancel, disabled states and locale parity.

# SEOmi 0.4.16 — release notes

## Added

- Settings validation tests for proxy lists (all separators, one bad entry, duplicates, empty values, the 64-entry limit, oversized entry) and a README section describing proxy rotation, ban and the no-direct-fallback guarantee (issue #142).

# SEOmi 0.4.15 — release notes

## Added

- Proxy list health: a proxy that fails 3 times in a row (connect error, timeout or HTTP 407) is banned for 60 s and requests rotate to the remaining ones; a success clears the streak. If every proxy is banned the crawler keeps using the one whose ban ends first and never falls back to a direct connection. Outcomes are attributed per request URL (issue #142). Tests use real local proxies (dead and live).

# SEOmi 0.4.14 — release notes

## Added

- Request-profile form explains the proxy list format (comma or space separated, up to 64) in all 12 languages; the proxy field accepts long lists. Tests cover the hint, the list input and locale parity.

# SEOmi 0.4.13 — release notes

## Added

- Request-profile proxy field now accepts a list (comma, semicolon or whitespace separated). The crawler rotates requests round-robin across the list; a single proxy behaves as before. Every entry is validated on save (HTTP/HTTPS only, max 64, no duplicates). Ban and cool-down on failures follows once request errors report their proxy (issue #142).

# SEOmi 0.4.12 — release notes

## Added

- Crawler proxy pool foundation (issue #142): validated user-supplied proxy list (HTTP/HTTPS only, max 64, no duplicates), round-robin rotation, ban after consecutive failures with cool-down re-entry, and credential redaction for reports. Unit-tested with injected time; wiring into request profiles and UI follows. No bot-protection bypass.

# SEOmi 0.4.11 — release notes

## Added

- Intrinsic image dimension decoding for lossy and lossless WebP (`VP8 `/`VP8L`), AVIF/HEIF (`ispe`, largest extent), TIFF (first IFD, both byte orders) and BMP (core and info headers, top-down height) in the bounded crawl image decoder (GAP G114). Unit tests cover valid, malformed and foreign-brand inputs.

# SEOmi 0.4.10 — release notes

## Added

- Coverage-completion tests (frontend, MCP server and Rust) taking over the unfinished 100% coverage work: persistence, semantic, TAS, UI, utility and PDF/crawler edges. Thresholds unchanged.

## Fixed

- Schema.org detection in SIJA page features now validates URLs with the URL parser instead of regex matching on raw HTML (CodeQL alerts from PR #176); look-alike hosts and query-string mentions no longer count. Regression test added.

# SEOmi 0.4.9 — release notes

## Security

- Upgraded `zod` to 4.6.7 in the app and the MCP server (high-severity memory exhaustion advisory GHSA-mrhx-c7xc-m3w5); schemas use the v4 `ZodType<Output, Input>` and `z.record(key, value)` signatures. MCP transitive `body-parser` and `fast-uri` advisories fixed with `npm audit fix`. `npm audit --omit=dev` reports 0 vulnerabilities in both packages.

## Added

- Pre-publish check: "Copy report" puts a plain-text before/after card (verdict, signed SFS delta, reasons, conflicts, chunk issues) on the clipboard without publishing anything (issue #94, GEM-94-10). 12 languages and tests.
- Rust unit tests for PDF report label locale/RTL helpers and for crypto-shredding store error, missing-key and tampered-ciphertext paths (GAP-023 coverage work). No production code changed.
- Direct unit assertions for crawl write locking, audit-log hashing and chain verification, CMS patch HTTP helpers, monitoring storage keys and deploy artifact primitives (GAP-026). No production code changed.

## Fixed

- Opening the SQLite crawl store concurrently for the first time no longer fails with `SQLITE_BUSY` when switching to WAL: the switch is retried within the busy timeout. The concurrency test no longer deadlocks its barrier when an open fails.
- Native logging tests no longer race on a cached disabled tracing interest (GAP-D08).
- DataForSEO tests follow the native budget contract.

## Included from 0.4.8

## Added

- Direct unit tests for the Help popover placement (`computePosition`) and the trust-tab helpers (`levelOfScore`, level/severity styles, layer list), part of GAP-022 coverage work.
- Direct unit tests for the E-E-A-T schema graph helpers (`nodesOf`, `childNodes`, `buildRegistry`, `analyzeSchema`, `schemaScore`, `isDeadLink`) and the Site Focus core-topic/flag helpers (`chooseCore`, `describeCore`, `describeClusters`, `computeFlags`).

## Included from 0.4.7

### Fixed

- DataForSEO monthly cap (GAP-C07): the native `dataforseo_request` command now enforces the cap itself (month spend, in-flight reservations) and rejects before credentials or network. Endpoints with no observed price use a conservative 0.10 USD estimate, in both the native and WebView guards.

## Included from 0.4.6

### Added

- Copilot Patcher review UI with human approval ownership checks.

## Fixed

- Crawl history is replaced in one SQLite transaction, so a failed save preserves the previous project snapshot. Legacy imports commit each run and its migration journal together and preserve newer SQLite data.
- Migration stops on unreadable or malformed legacy history, retains its backup and retries safely. Incomplete stored runs produce a read error instead of disappearing from history. Save and restore complete migration before replacing the snapshot.

## Included from 0.4.5

## Added

- Signals tab in the semantic workspace (SPRS PageRank flags, hreflang parity, template governor, decay radar, causal impact); outreach targets and off-page panels in the backlink checker; LLM economy panel in API settings. Panels without a stored data source show empty states.
- IGOS panel with paragraph originality heatmap.
- Contextual AI Copilot Patcher service: before/after proposals that need human approval, local provider preferred.
- TAS: menu and footer links are excluded by crawler link zones; People Also Ask only from a real SERP source.
- Local multimodal services: perceptual image hash and alt text checks (OCR/CLIP reported as unavailable).


## Included from 0.4.4

## Added

- SQLite crawl store on desktop (no page truncation, versioned migration, one-shot import from localStorage) with crypto-shredding for GDPR erasure and an audit log.
- Immutable snapshots for concurrent crawl and What-If, with a stale-snapshot banner.
- Local team mode: RBAC roles and a hash-chained audit trail (ADR 0005).
- CMS patch services for WordPress, Strapi and webhooks: diff preview, approval bound to the diff, rollback, SSRF guard.
- Link placement zones from the crawler (nav, sidebar/footer, widget, main) and SPRS zone weights.
- LLM token economy (cost meter, semantic cache, fact gate), programmatic SEO template governor, outreach co-pilot targets, causal impact with market normalization.

## Included from 0.4.3

## Added

- Execution Card wiring: the recommendation bus feeds the links panel, brief buttons on SFS playbook and TAS cannibalization cards, 410/301 rules for deployment artifacts, task verification after each crawl, owner/SLA/priority editing.
- Indexability gate: SFS skips noindex and canonicalized pages by default, with a banner, include toggle and conflict list.
- URL telemetry snapshot (GSC, GA4, backlinks), PRI protection panel and log intelligence services (parser, bot verification, Crawl Efficiency Matrix).
- Semantic services and panels: IGOS baseline and heatmap, SPRS PageRank flags, Semantic Decay Radar, SIJA micro-intents, Pre-Publish check, hreflang parity, off-page TBVA and co-citation.

## Included from 0.4.2

## Added

- Execution Card building blocks: Unified Recommendation Bus (URL quarantine), 1-click ContentBrief injection, deployment artifacts (Apache, Nginx, Cloudflare Bulk CSV, WordPress Redirection) and a closed-loop task tracker.
- Crawler: JS-shell detection flag, WAF block detection with vendor name and adaptive backoff (detection only, no bypass).
- EETV: syntax-only sameAs profile evidence (ORCID, Wikidata) and DOI/PMID citation identifiers.
- Monitoring: alerts when the AI readiness or E-E-A-T trust score drops.
- TAS: cannibalization groups list each pair with its cosine and basis.
- Docs: ADRs 0001-0004, test acceptance matrix, governance files, pinned CI actions and Dependabot config.

## Fixed

- Schema graph: absent sameAs no longer causes false @id conflicts.
- SFS: pages with TRS 40-74 get advice; runs with no scored page show "unavailable" instead of 0.
- Diacritic folding is unified between topical audit tokens and semantic term keys.
- Flaky crawl delay test made deterministic; pause time no longer consumes the crawl delay.
- Security: hono 4.13.13, ip-address 10.7.4, vitest 5.0.5 (Dependabot alerts 4-7).

## 0.4.1

### Added

- Search Console: every query and page row is now listed in a paginated table (25 / 50 / 100 / 250 rows per page) with sorting by phrase, clicks, impressions, CTR and position.
- Crawl page limit: presets now go up to 50,000 pages and there is a "No limit" option (ceiling 1,000,000 pages); scheduled crawls accept the same range.
- Footer: the Updates button checks for updates in place, shows the result, installs the update and offers a restart without opening Settings.
- Crawl architecture map rebuilt on Cytoscape.js: sections as groups with collapse, hierarchy and force layouts, colour from the Site Focus TRS (HTTP status when there is none), URL search, status/depth/problem filters, a details panel and a table for screen readers.

## Fixed

- MCP server: meta tags with apostrophes and `<link>` tags with any attribute order are read correctly; nested `<article>` no longer truncates the content; `discovered_urls` counts every URL in scope and pages are audited with bounded concurrency; the DataForSEO budget reserves in-flight cost and writes its ledger atomically; the pinned DNS lookup falls back from IPv6 to a verified IPv4 address and rejects more special-purpose IPv6 ranges.
- Search Console traffic rows that collide after URL normalisation are now summed (clicks, impressions, CTR, impression-weighted position) instead of both being dropped.
- Entity trust: citations that were never checked no longer score 100 (capped at 75 and labelled "unverified"); YMYL is detected by document frequency over page titles.
- Site Focus: footer and utility pages (careers, terms, cookies, advertising, FAQ, ...) no longer count as categories with double weight; one utility-page dictionary is shared with the topical diagnosis.
- German umlauts fold consistently (ö to oe) so a manual topic typed without diacritics matches the page terms.
- Test runs no longer print "Not implemented: navigation", help-entry and `act(...)` warnings; `sanitizeBrief` strips nested tags (CodeQL #34).

# SEOmi 0.4.0 — release notes

## Added

- Topical Authority Score (TAS): a 0–100 score of how completely and deeply the site covers its Core Topic, in a new Topical authority tab next to Site Focus. Dual hero (SFS purity next to TAS completeness) and the SFS × TAS maturity matrix with four strategic quadrants.
- Reference map built only from real data: headings, entities and questions of the pages ranking for your Core Topic (DataForSEO or free Bing RSS), plus Google Suggest. Cached for 30 days per project; without a SERP source the tab says so instead of inventing numbers.
- TAS components: topic coverage, entity depth, silo cohesion (pillar links, anchor quality, orphan pages, links to off-topic pages) and freshness with cannibalization, coupled to the Site Focus Score.
- Coverage map with filters and a sub-topic drill-down (missing entities, unanswered questions, internal-link audit), article briefs for missing sub-topics with optional AI outlines.
- Semantic cannibalization groups with a canonical page, a pre-publish draft checker, programmatic-SEO clone detection and an empty-authority warning.
- Topical expansion plan with simulated TAS gain and effort, topical gap matrix against the top 3 competitors, SFS and TAS timeline with milestones.
- Alerts for TAS drops, new cannibalizing pages, competitor expansion and content decay; Topical Authority section in the crawl PDF and report templates.
- Crawler records the page date (meta tags, JSON-LD, time elements, Last-Modified).
- AI Overviews & RAG readiness (AIO-R): a 0–100 score of how easily AI answer engines can extract and cite your passages, in a new AI readiness tab. Simulates H2/H3 and sliding-window chunking, flags dangling pronouns and missing Answer-First openings, measures subject–predicate–object fact density and structural extractability (tables, ordered and definition lists). Weakest passages can be rewritten with the connected AI provider; AIO-R history and an AI Overviews & RAG readiness section in the crawl PDF. Crawler records heading-delimited sections.
- Entity trust (E-E-A-T): a 0–100 trust score in a new Entity trust tab, from the JSON-LD graph (Organization and Person with @id, sameAs, reviewedBy, citation), author alignment with the Core Topic, outbound citation quality and editorial transparency signals, with YMYL detection and a copyable Person and MedicalWebPage JSON-LD generator. Entity Trust section in the crawl PDF.

## Included from 0.3.0

## Added

- Site Focus Score (SFS): topical-coherence score 0–100 for the whole crawl, in a new Focus tab. Core Topic detection with confidence and manual override, per-page Topic Relevance Score (similarity, keyword overlap, semantic drift), weighted aggregation by page type, URL-tree heatmap with filters, keyword alignment matrix, page diagnosis with A/B/C playbooks, rewrite briefs (copyable AI prompt) and Delta Score simulation.
- Multi-topic sites (sub-site scores), low-confidence and lexical-fallback handling, skipped JS-render pages.
- Site Focus history chart with annotated changes, weekly summary, SFS-drop and Content Guard alerts, daily incremental scoring and weekly full re-analysis, 3 manual recalculations per day.
- Competitive benchmark against the top 10 SERP results (DataForSEO or free Bing RSS), competitor topic gaps, internal-linking suggestions and AI-written rewrite briefs.
- Site Focus section in the crawl PDF report and report templates.
- Crawler records focus terms (1–4-gram, zone-weighted), heading texts, and stop words for de, es, fr, it, pt, ru.

## Included from 0.2.1

## Added

- PDF audit and crawl reports follow the interface language (all 12 UI languages, right-to-left included), falling back to English per missing label.
- Contextual help bubbles (?) next to key metrics in Overview, Metadata, Headings, Images, Links and Settings: what it is, why it matters, what to do.

## 0.2.0

## Added

- Google Analytics 4 authorization, property discovery and landing-page reports for the active project.
- Joining observed GA4, Search Console and crawl data from comparable periods.
- Topical diagnosis: multilingual documents, hubs, topics and recommendations for specific pages.
- Importing multi-document topics into topical plans, with source URLs retained.

## Fixed

- Search Console property matching and actionable Google error messages.
- Transient crawler retries, structured robots status and safer redirect handling.
- External-link verification classes and per-host concurrency limits.
- Comparable health-score versions, cross-page structured-data checks and page-specific content guidance.
- Security-header interpretation and repeated-header handling.
- Windows TLS error classification and desktop regression fixtures.
- Embedded Unicode PDF fonts for Latin, Cyrillic, CJK and Arabic text, with long URL wrapping. Fonts are included only when used; the CJK font is currently embedded in full.
- Isolated Windows renderer profiles prevent one WebView2 session from losing the next session’s capture callbacks.
- Topical diagnosis distinguishes post navigation from listing pagination, folds redirect aliases, avoids unsupported link verdicts in legacy crawls and groups duplicate content.
- Complete topic-pair evaluation within the 500-page bound, expandable verdict lists and migration of obsolete graph filters.
- Stored credentials stay on the native side for desktop cloud AI; settings read credential presence rather than stored values.
- MCP shutdown handlers are registered before the server announces readiness.
- Renderer capture sources have standalone JavaScript syntax while retaining acknowledged transfers and duplicate-capture protection.

## Changes since 0.1.2

- **New PDF reports.** Audit and crawl reports are now styled A4 documents built on a new layout engine: header and footer with page numbers, a coloured health score, severity counts and KPI cards, and every finding as a card with **where** it applies (page, element, current value, affected URLs) and **how to fix** it. Nothing is silently omitted: missing values show "—" and a coverage table lists every section. Latin, Cyrillic, CJK and right-to-left Arabic text keep working and the text stays searchable.
- The audit report adds a "Passed checks" summary and a detail table per audit area (meta tags, headings, content, images, links, redirects, indexability, security headers, structured data, Open Graph, accessibility, AMP, performance).
- The crawl report adds the full pages table, issues grouped by type with the affected URLs and advice for every crawler issue code, and detailed sections for duplicates, redirects, broken links, canonicals, hreflang, structured data, images, resources and robots.txt/sitemap. Report templates still select which sections are included.
- PDFs previously dropped each finding's recommendation and showed stray "-" lines for blanks; both are fixed.

## Changes since 0.1.1

- More native error paths are covered by tests: crawler delay and cancellation, sitemap and robots scope, redirect and metadata verdicts, RDAP client construction, the render worker's accept loop (now in `render_worker/admission.rs`) and request-size checks.
- Removed branches that could never run (an always-true render-worker request-size sum, a redundant empty-host check on proxy URLs, a redundant alias comparison in robots scope).

## Changes since 0.1.0

- OpenAI requests no longer send `temperature`, so newer models (gpt-5.x, gpt-6.x, o-series) stop failing with HTTP 400; provider model lists are sorted newest first and skip models that chat completions rejects (fix by @RafalSzy).
- API keys are entered in a shared field that keeps the typed text as a draft until "Save key" or Enter, shows when a key is saved, offers "Remove key", and no longer stores only the last typed character; the chosen model is remembered per provider, provider errors are readable and translated, and the Optimizer no longer asks for a manual connection test after a restart (fix by @RafalSzy).

## Changes since 0.0.7

- Native code gained test seams without changing behaviour: injected endpoints and credential store for Google Analytics 4 commands, the rendered-fetch cancel/timeout race, the external-link runner, file-lock error classification and the public-feed client. These make previously unreachable error paths testable.
- Domain age lookup sends a `User-Agent`, so rdap.org no longer answers HTTP 403 (fix by @RafalSzy, #43).
- Removed defensive branches that could never run (always-true URL checks, an unreachable findings cap, a plain-HTTP proxy body write the parser already rejects).

## Changes since 0.0.6

- Test runs no longer print React `act(...)` warnings.

## Changes since 0.0.5

- Domain age lookup runs through a native RDAP command (validated hostname, HTTPS-only redirects, 1 MiB limit); the WebView policy no longer allows connections to arbitrary `https:` hosts (#35).
- PDF reports draw multiword Arabic and mixed-direction text in right-to-left visual order while text extraction still returns the logical string (#30).
- The release workflow's publish step passes `--repo`, so a finished build is published automatically.

## Release and security

- Releases publish automatically: when `main` carries an application version without a tag, the release workflow builds the macOS and Windows packages, creates the tag and publishes the release.
- macOS packages now include the signed updater archive (`.app.tar.gz`), so in-app updates work on Apple Silicon and Intel; the release job no longer fails with "No signed updater artifacts were produced".
- Third-party GitHub Actions are pinned to commit SHAs and workflows run with a read-only default token.
- HTML entities are unescaped once in the MCP semantic audit (`&amp;lt;` stays `&lt;`).
- Test files no longer trigger CodeQL findings for URL checks, regular expressions or temporary files.

## Quality

- Expanded frontend, native and MCP regression coverage: frontend branches 99.6%, native lines 99.3%, functions 98.8%, branches 98.9% (unit tests only).
- Preserved fallible production errors, bounded history reads and the 150-line code/test limit.
- One application version source in `package.json`.
- A security reporting policy and extended CodeQL scanning for JavaScript/TypeScript and GitHub Actions.

## Downloads and updates

The selected distribution uses signed Tauri updates and installers without Apple/Windows system certificates. Operating systems may show publisher warnings. Download packages are listed in the release assets.

## Thanks

Thank you **@RafalSzy** for contributions, topical diagnosis, detailed issue reports and regression-test feedback in PR #13 and subsequent reviews.


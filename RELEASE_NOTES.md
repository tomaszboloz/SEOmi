# SEOmi 0.2.1 — release notes

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

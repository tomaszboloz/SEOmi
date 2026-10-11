# SEOmi 0.0.4 — release notes draft

This release has not been published. Final coverage, platform checks and package verification remain in progress.

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
- Latin PDF character transliteration and long URL wrapping; full non-Latin font support remains open.

## Quality

- Expanded frontend, native and MCP regression coverage.
- Preserved fallible production errors, bounded history reads and the 150-line code/test limit.
- One application version source in `package.json`.

## Downloads and updates

The selected distribution uses signed Tauri updates and installers without Apple/Windows system certificates. Operating systems may show publisher warnings. Download links will be added after release artifacts are verified.

## Thanks

Thank you **@RafalSzy** for contributions, topical diagnosis, detailed issue reports and regression-test feedback in PR #13 and subsequent reviews.

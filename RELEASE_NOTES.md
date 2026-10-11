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
- Embedded Unicode PDF fonts for Latin, Cyrillic, CJK and Arabic text, with long URL wrapping. Fonts are included only when used; the CJK font is currently embedded in full.
- Isolated Windows renderer profiles prevent one WebView2 session from losing the next session’s capture callbacks.
- Topical diagnosis distinguishes post navigation from listing pagination, folds redirect aliases, avoids unsupported link verdicts in legacy crawls and groups duplicate content.
- Complete topic-pair evaluation within the 500-page bound, expandable verdict lists and migration of obsolete graph filters.

## Quality

- Expanded frontend, native and MCP regression coverage.
- Preserved fallible production errors, bounded history reads and the 150-line code/test limit.
- One application version source in `package.json`.

## Downloads and updates

The selected distribution uses signed Tauri updates and installers without Apple/Windows system certificates. Operating systems may show publisher warnings. Download links will be added after release artifacts are verified.

## Thanks

Thank you **@RafalSzy** for contributions, topical diagnosis, detailed issue reports and regression-test feedback in PR #13 and subsequent reviews.

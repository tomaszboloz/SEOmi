# SEOmi 0.0.6 — release notes

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

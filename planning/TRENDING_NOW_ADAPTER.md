# Trending Now adapter

`src/services/trendingNow.ts` provides a standalone adapter; no UI is connected.
Every operation requires an explicit project ID. Fetching/importing does not
write storage automatically: `saveTrendingNow(projectId, snapshot)` returns
whether the project-local WebView storage write succeeded.

- `fetchTrendingNow(projectId, geo = 'PL', fetcher = fetch)` requests only
  `https://trends.google.com/trending/rss?geo=XX`. Redirects and credentials are
  disabled; the final response URL is validated too. Timeout: 15 seconds.
- `importTrendingNow(projectId, payload, 'csv' | 'json', geo = 'PL')` is the free
  fallback when RSS is unavailable. Import provenance is separate from RSS.
- JSON accepts an entry array or `{ "entries": [...] }`. Entry fields:
  `keyword` (required string), `trafficLabel` and `startedAt` (optional strings).
- CSV accepts Google export columns `Trends`, `Search volume`, `Started`, or
  canonical `keyword`, `trafficLabel`, `startedAt`. Additional columns are
  ignored. Quotes, escaped quotes, commas, BOM and quoted newlines are supported.
- Missing traffic or start dates remain `null`. Nonempty dates must be parseable;
  ambiguous/localized unsupported date strings must be corrected before import.
  `capturedAt` means adapter capture/import time, not a source publication time.
- The raw `trafficLabel` is preserved, including `+`/unit labels. It is never
  converted into a numeric or monthly search volume. Article links/images are
  neither fetched nor retained.
- Payloads are limited to 1 MiB in UTF-8 and 200 entries. Oversized or malformed
  inputs fail rather than silently truncate. Live response bytes are bounded
  while reading the stream. XML DTD/entity declarations are rejected.
- `readTrendingNow`, `saveTrendingNow`, `clearTrendingNow` store one current
  validated snapshot at `seomi_project_<id>_trending_now_v1`; invalid stored data
  returns `null`. Cross-project snapshots are rejected. Unknown metrics are
  stripped before storage.

Browser/WebView CORS can prevent the default browser fetch. Hosts may inject a
compatible fetch transport that honors `redirect: 'error'`, the abort signal and
the HTTPS restriction. No native command or UI contract is assumed here. CSV/JSON
imports work without a network provider. Local adapter tests do not establish
native transport/UI integration or general feature parity.

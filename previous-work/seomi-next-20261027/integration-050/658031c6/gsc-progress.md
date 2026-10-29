Implementation pushed in draft #221 at `658031c633a17128d9d14586dc9ac1ac01a7f5ed`.

- Removed both hidden display limits: the old 20-row UI slice and the 250-query history snapshot as the live report source. History retention stays bounded.
- Added all-query/10–20/CTR views, 20/50/100-row pages and counters, sortable columns, a literal case-insensitive NFC-normalized substring filter, clear action and separate empty states.
- Full live rows are accepted only for matching property/date/filter scope; project hydration hides stale data. Genuine report-limit warnings remain visible and no Google rows are invented.
- Optimized CTR peer comparison to O(n log n), retaining leave-one-out, duplicate-query exclusion and the exact inclusive one-position policy.
- Added 12-locale text and keyboard/ARIA support.

Validation: GSC/session/localization suite **57 files / 1,772 tests PASS**; TypeScript, lint, MAX150, version and diff checks PASS. Browser verification used 301 synthetic queries and confirmed a filter hit beyond history row 250, sorting over the full report and the last page containing row 301. Private query data was not published.

Full unchanged coverage gates and native/remote checks are now running for the frozen SHA. This issue remains open until the implementation is accepted and merged.

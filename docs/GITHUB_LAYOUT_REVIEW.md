# GitHub layout review — issue #19

Reviewed against audit branch `ffd8b34` on 2026-10-02.

## Changes

- Results navigation is the sole sticky bar at the top of the content area.
- Workspace jump actions and the graph header stay in document flow.
- The duplicate workspace dock is removed; the graph dock sits above the 44 px application footer, including safe-area insets.
- Results navigation height is observed so returning to the map clears wrapped navigation after resizing.
- Overview uses two columns below 2xl, with shrinkable health text and wrapping counter labels.
- Translated Start/End labels have flexible button widths. Long non-table text may wrap anywhere.
- Extracted presentation components preserve saved-run selection, grouping, keyboard tabs, retry actions and timeout notices.

## Verification

3010 frontend tests and 70 MCP tests pass. Production build and lint pass.
Fresh full frontend coverage: 88.63% statements, 80.30% branches, 86.80% functions and 90.28% lines. Source hashes remain unchanged during measurement; the >99% gate is not met.
The 19 changed code/test files have at most 149 physical lines each, including the existing graph interaction test. Temporary browser fixtures and dependency symlinks are excluded from the commit.

Browser checks use actual Overview and SiteAudit components with explicitly synthetic existing test fixtures, Polish labels, a 256 px sidebar, 56 px header, 44 px footer and a long URL. The candidate includes the reviewed #18 palette. This verifies the browser layout; it does not establish live-provider results or native WebView equivalence.

| View | Window | Theme | Main width / scroll width | Result |
| --- | --- | --- | --- | --- |
| Overview | 980×680 | dark / light | 712 / 712 | Two 324 px columns; summary text stays inside cards |
| Overview | 1280×800 | dark / light | 1012 / 1012 | Two 474 px columns; summary text stays inside cards |
| Crawler map | 980×680 | dark / light | 718 / 718 | Navigation bottom 215.33; graph header top 248.33; dock bottom = footer top 636 |
| Crawler map | 1280×800 | dark | 1018 / 1018 | Navigation bottom 189.33; graph header top 235.33; dock bottom = footer top 756 |
| Crawler map | 1280×800 | light | 1018 / 1018 | Navigation bottom 186.33; graph header top 219.33; dock bottom = footer top 756 |

Resizing the map from 1280 to 980 and using the return-to-map action leaves the graph header visible below the taller navigation. The viewport override is reset after testing.

Initial regression tests failed for the previous layout. The existing graph test expected the old sticky header; it now asserts document flow while retaining keyboard-selection checks. Observer cleanup also ignores queued callbacks after unmount.

Native sources are unchanged by the layout fix. The prior audit baseline has 529 passing native tests and strict Clippy; a fresh integrated native/platform check is required when bringing in #17/#18.

## Limits and thanks

Original audit remains 69/72: >99% frontend/native coverage and direct public-function assertions are unfinished. Global LOC150 is still not met (102 violations in 1344 code files at this layout snapshot). No release or tag is published by this change. Issue #19 remains open until the fix is integrated into master.

Thanks to **@RafalSzy** for the issue, measurements, proposed layout corrections and contributions #13 and #16–18.

## Audit integration follow-up

#17/#18 are integrated with the layout fix in the audit branch. Conflicts are resolved in the extracted Sidebar and social preview components; request tokens, project isolation and injected settings consumers remain intact. Auth/settings stores, the header language selector, project list and App lifecycle now use modules below LOC150.

Final validation: 3048 frontend / 530 Rust all-targets / 70 MCP tests pass; build, lint, rustfmt and strict Clippy pass. Fresh frontend coverage is 88.76% statements / 80.35% branches / 86.94% functions / 90.41% lines. Global LOC still fails: 97 violations in 1367 files. Original audit remains 69/72; new head requires its own GitHub CI. Issue #19 remains open until master includes the fix.

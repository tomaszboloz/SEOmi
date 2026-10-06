# Independent native / TypeScript contract audit — 2026-10-06

Base: `33ce00600ff2fd3e60e18d45e522ca1a01d2f7ba`. Ownership is limited to
the five source/test files listed below and this report. Existing CI, AI CLI,
GSC, browser proxy/schema validator, DataForSEO, exports, rendered crawler,
scheduler, SEO audit and PDF changes were left untouched.

## Findings and changes

- ICO dimension bytes of zero were decoded as one pixel instead of 256. The
  regression test failed before the fix (32×32 selected instead of 256×256).
  The decoder now reads the ICO sentinel correctly in both dimensions.
- Image contracts cover a partially available ICO directory, truncated
  supported headers, JPEG padding/metadata and invalid segment lengths, SVG
  sniffing without a MIME type, and unrelated/unsupported RIFF chunks.
- Duplicate contracts assert reciprocal URLs and severity at SimHash distance
  seven, rejection at eight, the 19/20-word boundary, missing signatures,
  preservation of existing findings/counts, and exact-content deduplication.
- Template contracts assert persisted and selectable project templates when
  UUID support is missing, project isolation, normalized sections, and built-in
  name updates on actual language changes with language restoration.

Ten Rust tests and three TypeScript cases were added. No coverage exclusions,
thresholds or production paths were changed to make measurements pass.

## Verified scope

The working-tree Rust build is blocked by existing changes in excluded modules:
private `status::version_check` and incompatible future lifetimes / partial move
in AI CLI; `.success()` on a boolean in the macOS scheduler; `unwrap_err()`
requiring `GscSiteProperty: Debug` in GSC tests. These files were not repaired
within this task's ownership.

Rust was therefore tested on an immutable archive of the above HEAD, with only
the four owned Rust files overlaid. Their bytes were compared with this
working-tree. Final nightly branch measurement passed **906 tests** (895
library and 11 example tests). Strict Clippy `--lib --tests -- -D warnings`
and owned-file rustfmt checks passed. This is evidence for the isolated
HEAD-plus-owned-changes tree, not for all pending working-tree changes or
uncompiled Windows code.

Production coverage below uses the repository's unchanged SHA256/AST/LLVM
validator on the explicitly selected owned production modules. Test-only
modules are removed using the existing AST rules. This narrow report does not
establish global native coverage.

| Rust production module | Lines | Functions | Branches |
| --- | ---: | ---: | ---: |
| `site_crawler/image_decoding.rs` | 98/98 | 7/7 | 58/58 |
| `site_crawler/duplicate_annotation.rs` | 60/60 | 7/7 | 4/4 |
| Owned scope | **158/158** | **14/14** | **62/62** |

Current TypeScript template suite: **43 tests / five files passed**, with an
enforcing 98% gate for the measured `src/services/reportTemplates.ts` module.
The same suite without the new test file passed 40 cases before comparison.

| Measure | Without new cases | With new cases |
| --- | ---: | ---: |
| Statements | 75/77 (97.40%) | 76/77 (98.70%) |
| Branches | 68/70 (97.14%) | 69/70 (98.57%) |
| Functions | 17/18 (94.44%) | 18/18 (100%) |
| Lines | 60/62 (96.77%) | 61/62 (98.38%) |

TypeScript typecheck, new-test ESLint and diff whitespace checks passed.

The full working-tree `npm run test:coverage:target` completed with **6529
passed / one failed test** across 777 files. The sole failure is
`tests/nativeSchedulerLoc.test.ts`, which correctly rejects the excluded
166-line scheduler test file. Vitest did not emit the global coverage summary
on this failed run; the runner wrote an empty execution-evidence manifest.
No successful global frontend 98% claim is made. The successful scoped 98%
template gate above is separate.

## MAX LOC and remaining gates

Owned code files are 132, 93, 80, 81 and 52 physical lines, respectively:
`image_decoding.rs`, `image_decoding_contract_tests.rs`,
`duplicate_annotation.rs`, `duplicate_annotation_contract_tests.rs`, and
`reportTemplateIdentityFallback.test.ts`. All pass MAX LOC 150.

The global working-tree MAX LOC check scanned 2472 code files and failed on
the excluded `src-tauri/src/commands/scheduler/macos_contract_tests.rs`
(166 lines). That violation remains for its owner.

The global native production-report validator also rejects the isolated
report with `Source missing AST inventory:
src-tauri/src/commands/pagespeed/command_request_tests.rs`. The existing
`#[cfg(test)] include!(...)` in `pagespeed.rs` is not traversed by the AST
inventory. The narrow report above avoids a false global claim; it does not
alter the inventory or manually classify the missing file.

## Reproducible evidence

- `/tmp/seomi-independent-snapshot`: immutable HEAD archive plus owned Rust files.
- `/tmp/seomi-independent-{sources.json,branches.lcov,llvm.json}`: final raw native evidence.
- `/tmp/seomi-independent-owned-production{.lcov,-summary.json}`: validated owned scope.
- `/tmp/seomi-independent-owned-report.mjs`: exact owned-scope extraction invocation.
- `/tmp/seomi-independent-ts-{baseline,coverage}/coverage-summary.json`: compared TS reports.
- `/tmp/seomi-independent-frontend98.log`: full working-tree frontend gate log.

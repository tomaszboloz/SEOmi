## Problem and result

The automatic 0.4.41 release run `40292165861` exhausted its unchanged 45-minute CI guard while full coverage jobs were still running. Packaging now starts from a successful, same-repository push completion of `Test Suite & Security Audit`. Manual and version-tag releases remain available and still execute the exact-SHA CI guard before and after packaging.

The final publisher also receives `security-events: read`, required by the native CodeQL evidence path already used by preflight on main.

## Linked issue

Refs #207, #102. Historical 0.4.40 asset consolidation remains outside this fix.

## Changed paths

- Add a dispatcher without repository checkout. It validates the source branch/SHA, rejects malformed API results, ignores superseded commits, and dispatches with `expected_sha`.
- Reject a race between dispatch and release startup before shell network reads and before release API requests.
- Keep all ten required checks, CodeQL evidence, 95%/98% thresholds, 150-line limit, branch protections and guard timeouts unchanged.

## Tests

Validated commit `3ae944e460e88fb4ee2ab43de9477cb56d83a005` with stable hashes for all six changed files:

- 331 tests / 28 release and CI contract suites pass, including execution of the actual dispatcher shell with mocked GitHub I/O, stale/unsafe/malformed inputs, lookup/dispatch failures, SHA races and CodeQL read permissions. The shell harness uses Git Bash on Windows and invokes the GitHub I/O stub through the current Node binary. It normalizes YAML CRLF and explicitly executes both LF/CRLF inputs. A focused portability step now runs before the unchanged complete frontend suite on both desktop platforms.
- `npx tsc --noEmit`, `npm run lint`, `npm run check:loc`, `npm run version:check`, source policy and `git diff --check`: pass.
- Checksum-verified actionlint 1.7.12 validates all three changed workflows.
- [x] No code file over 150 physical lines.
- [x] CI thresholds unchanged (Rust 95%, frontend/MCP 98%).

## Migrations and risks

No stored-data migration or application version change. The automatic dispatcher runs from the default branch only after this workflow is merged. Exact-head remote CI and CodeQL still need to pass before merge; the eventual main commit requires its own complete CI before publishing.

## Release

0.4.41 is not published by this PR alone. Existing 0.4.40 releases and assets remain untouched.

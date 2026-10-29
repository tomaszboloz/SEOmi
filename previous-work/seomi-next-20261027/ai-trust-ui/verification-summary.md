# Verification record

Worktree: `/Users/tomaszboloz/.codex/worktrees/ai-trust-ui-050/seomi`

The worktree originally had no `node_modules`. A temporary symlink to `/Users/tomaszboloz/.codex/worktrees/release-next/seomi/node_modules` was created only for validation and removed afterward; no install occurred.

Final green commands (all run under `/tmp/seomi-gemini-20261024-1553/locked-validation.py` where applicable):

- `npx vitest run ...` targeted affected suites: 6 files, 33 tests PASS.
- `npx vitest run tests/aioRewriteLifecycle.test.tsx`: 2 tests PASS.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS.
- `npm run check:loc`: PASS, 0 violations.
- 12-locale JSON/key/non-English fallback check: PASS.
- SHA256 manifest check: PASS.
- `git diff --check`: PASS.

The first lock-backed typecheck failed with three actual DTO errors (`RewriteComparison.diff` and non-exported `DraftDiff`); those were repaired, then the final typecheck passed. The first targeted Vitest run exposed composer conflicts for singleton arrays and empty author input; those were repaired, then 33/33 passed.

JSON-LD boundary evidence:

- RED: raw `JSON.stringify(result.graph)` contains `</script>` for hostile author input (`jsonld-red-green.log`).
- GREEN: production `result.text` escapes the terminator and passes (`jsonld-green.log`).

Logs: `commands.log`, `vitest-targeted.log`, `lifecycle.log`, `tsc.log`, `lint.log`, `loc.log`, `locales-check.log`, `jsonld-red-green.log`, `jsonld-green.log`.

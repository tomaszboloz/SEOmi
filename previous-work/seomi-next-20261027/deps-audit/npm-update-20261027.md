# npm safe patch update — ai-trust-integration-050

Date: 2026-10-27 Europe/Warsaw
Worktree: `/Users/tomaszboloz/.codex/worktrees/ai-trust-integration-050/seomi`
HEAD before changes: `65ec0b98bcd10cb80b02828e552e1a39bb7a74e9`

## Requested updates applied

- `i18next`: `^26.5.10` -> `^26.5.11`
- `react-i18next`: `^17.1.8` -> `^17.1.9`
- `typescript-eslint`: `8.72.0` -> `8.72.1`

`package.json` version remains `0.4.43`. TypeScript remains `^6.0.3`; TypeScript 7 was not attempted or forced because `typescript-eslint@8.72.1` requires peer `typescript >=4.8.4 <6.1.0`.

## Hashes

Before (`git show HEAD`):

```text
ce45f11561e8a21afa993831d00cb0dea564a0a984f7c363451025bfeb9e0a06  package.json
347c6356452f009563a357e6ef8d0156ae2d95a2ce7820fd87946b7a8efa94e6  package-lock.json
```

After:

```text
2731b0f4cf6534d410cdfa315d0d448dd7ed714cda97abf982bd442fa535dddb  package.json
7d13f900bee358c82da558e79a8d029fa6f84ff356ec11bf7f45a0185ece0525  package-lock.json
```

## Lock refresh and scope

Lock refresh command (run in a minimal temp directory containing only copied `package.json` and `package-lock.json`):

```text
rtk proxy npm install --package-lock-only --ignore-scripts --no-audit --no-fund --loglevel verbose
```

No `node_modules` was created in the temp directory. The raw npm resolver output is in `npm-package-lock-only-resolve.raw.log`; the exact resulting repository diff is in `npm-package-lock.actual-diff.patch`.

`npm ls --package-lock-only --depth=0 --json` confirms after-lock direct versions: `i18next 26.5.11`, `react-i18next 17.1.9`, `typescript-eslint 8.72.1`, and `typescript 6.0.3`.

The lock diff changes only the three requested direct packages and the corresponding `@typescript-eslint/*` package graph (25 lock package-entry changes, including relocation from nested to hoisted entries). No unrelated direct dependency changed. No source files, version metadata, tests, install artifacts, Git commits, or GitHub state were changed.

# PR176 CodeQL aggregate analysis — `f41ad56`

Evidence: aggregate check `121286694498`, GitHub Advanced Security app `57789`, CodeQL workflow run `40232351223`, head `f41ad56e3ca0a18a4c61e2bcfe945cc4e4c02777`.

The aggregate is terminal `failure` with 32 open alerts (analysis `2023347759` reports 33 results): 26 high and 6 medium. The two GitHub Actions CodeQL jobs themselves are `success`; that does not clear the aggregate alert gate.

## Production-path findings

### `js/file-access-to-http` — medium

- Alerts 73 and 74: `scripts/release-ci-gate-tag.mjs:25` and `:39`; source is package file data at `:90`, flowing into `${apiUrl}/.../tags/${tag}`. The current tag is assembled from `package.json`/ref data but has no strict semver/tag grammar and is not encoded as a path segment. This is a real URL-boundary gap, although the workflow normally supplies a trusted GitHub API origin.
- Alert 72: `scripts/release-ci-gate-provenance-upload.mjs:71`; sources are `readFileSync(nodePath/rustPath)` at `scripts/release-ci-gate-provenance.mjs:139-140`, flowing as the body of an upload to the fixed uploads.github.com endpoint. This is an intentional SBOM upload, not arbitrary destination selection; normalize/validate CycloneDX objects before serialization and keep the endpoint/repository/name allowlisted.
- Alert 71: `scripts/release-ci-gate-manifest.mjs:118`; sources are fragment JSON at `:83` and package/version file data at `:126`, flowing into `latest.json` upload. This is an intentional upload but the fragment boundary is weak: `entry.url` and `signature` are accepted with no strict schema/origin/tag/filename validation. A tampered fragment can publish an updater URL outside the intended GitHub release.

### `js/http-to-file-access` — medium

- Alert 47: `scripts/release-ci-gate-provenance-upload.mjs:48`; GitHub asset bytes from the download at `:42` are written to `${artifactDir}/${name}`. The caller currently restricts names to the fixed required list (`release-ci-gate-provenance.mjs:105-114`) and checks size/digest, so this is mostly a safe intentional download. The write is still not atomic/no-follow and should use a same-directory random temp file, fsync, digest verification, then rename.
- Alert 48: `scripts/release-ci-gate-tag.mjs:84`; remote release data reaches `$GITHUB_OUTPUT` through `release-ci-gate-inventory.mjs:53` / `release-ci-gate-publish.mjs:78-82` (notably the draft `releaseId`). Validate the returned ID as a bounded decimal integer before writing the output; never write arbitrary API text to the command file.

### `js/file-system-race` — high

- Alert 46: `scripts/release-ci-gate-provenance-upload.mjs:48` is the TOCTOU pair with `existsSync/realpath/stat` at `:31-38` and the later write. Replacing the final write with an atomic temp-file workflow in the trusted artifact directory preserves download behavior and removes the check/write race. Do not suppress the query.

## Non-production/test findings

- Alerts 50-70 (`js/insecure-temporary-file`, high): tests and `scripts/release-ci-gate-provenance.mjs:30,137` use predictable `tmpdir()+Date.now()` paths or write into a shared temp directory. Use `mkdtempSync(join(tmpdir(), 'seomi-...'))`, keep all files inside that directory, and clean it in `finally`.
- Alerts 43-45 (`js/incomplete-url-substring-sanitization`, high): only test mocks (`tests/releaseCiGateInventory.test.ts:103,110`, `tests/causalMarketAdapter.test.tsx:28`) use `url.includes(...)`; production inventory code uses URL origin/protocol/path equality at `scripts/release-ci-gate-inventory.mjs:18-23`. Change mocks to parse `new URL(url).hostname` and compare exact hosts.

## Minimal safe remediation boundary

1. Add shared validators for release semver/tag, `owner/repository`, fixed GitHub API/upload origins, required platform enum, exact release-download URL shape, and bounded asset filename/signature fields. Apply them before every dynamic URL and before manifest upload.
2. For downloaded assets, write verified bytes to a random temp file in the trusted artifact directory, flush/close, verify size+SHA-256, then atomically rename; reject symlink/non-regular targets.
3. For `$GITHUB_OUTPUT`, accept only schema-validated scalars (especially numeric release IDs) and serialize a single-line value.
4. Replace predictable test temp paths with `mkdtempSync`; use exact URL host assertions in tests. Preserve real SBOM/manifest uploads and downloads; do not dismiss or suppress CodeQL findings.

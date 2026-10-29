# SEOmi handoff — 2026-10-29

Continue development from main in https://github.com/tomaszboloz/SEOmi.

- PR #267 merged: a6e85be3dea7cc8d7a2a5edda4b4c132c7cdd3c9.
- Tag v0.5.0: 5ad6b3918f6024e3201e5717b42285cb043cfe18. This tested commit is an ancestor of main and both commits have identical tree 58b1db1f9d6625ff84b518c34b34268db1d8bf96.
- Tag CI: https://github.com/tomaszboloz/SEOmi/actions/runs/40770600180 — all required checks passed; CodeQL also passed on this exact SHA.
- Release workflow: https://github.com/tomaszboloz/SEOmi/actions/runs/40835184941 — consult live state before claiming installers are published.
- Main merge CI: https://github.com/tomaszboloz/SEOmi/actions/runs/40834749158 — independent evidence for the merge SHA.
- Next planned train: 0.6.0; consult open GitHub issues and PRs. Do not infer that every issue is completed from the version number.
- Dependabot PR #268 updates @hono/node-server; it is separate from the frozen 0.5.0 candidate. Alert #9 concerns transitive Windows updater zip 4.6.1. Existing cargo audit configuration was unchanged and cargo audit passed. The GHSA describes a ZipArchive/ZipStreamReader differential; the updater uses ZipArchive and verifies downloaded bundle signatures. Keep upstream dependency review open.

## Archived material

This archive tag preserves selected ignored planning documents and previous temporary source/patch/review files outside application releases. These materials may be stale or unfinished. They are recovery aids, not an alternative implementation or proof of current acceptance. Scratch RED/GREEN tests are diagnostic experiments and are not intended to be added to the suite unchanged. Generated binaries, dependencies, raw session logs and credentials are not migration requirements. Recognizable credential patterns were redacted before archival.

On another computer:

```sh
git clone https://github.com/tomaszboloz/SEOmi.git
cd SEOmi
git switch main
git fetch origin --tags
git archive archive/handoff-20261029 | tar -x -C /path/to/separate-handoff-directory
```

Historical Codex snapshots and stashes were already preserved by remote archive/* tags, including archive/local-refs-20261027. Do not reapply old patches without comparing them against main.

Quality gates remain MAX150 physical lines, 12 locales, frontend/MCP 98%, Rust 95%, current security checks and branch protection. No gate or security exception was changed for this handoff.

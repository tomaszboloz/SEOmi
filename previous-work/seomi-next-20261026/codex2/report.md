# #138 actual crawl event stream — Codex2

Base: `d7e923c76554a7ef4904d1e42c58a23929b2ae60` (`origin/main`, `v0.4.42`).
Worktree: `/Users/tomaszboloz/.codex/worktrees/crawl-events-next/seomi`.
No commit, push, GitHub mutation, release, version, workflow or gate change.

## Implemented

- Added SQLite schema V3 `crawl_events` with project/run/sequence primary key.
- Added atomic append/load IPC commands with strict project/run identity, positive contiguous sequence, idempotent exact duplicate handling and conflict/gap errors.
- Added native `NativeCrawlCollector` to the real crawl pipeline. It writes `crawl:started` before robots/sitemap work, `crawl:page` after each page is assembled inside the loop, and terminal `completed`, `cancelled`, `timed_out` or explicit `interrupted` events.
- Persisted real `projectId`, `runId` and `provenance: live-crawl`; the collector sequence advances only after SQLite commits.
- Added run/project erasure cleanup for event rows and IPC logging registration.
- Added regression coverage for reopen while in flight, terminal replay, SQLite write failure/retry without sequence advance, append conflicts/gaps/isolation, and a real delayed pipeline proving a page event is visible while the crawl is still running.

## Validation

- `rtk cargo fmt -- --check` — PASS.
- `rtk cargo check` — PASS (one existing dead-code warning for compatibility wrapper `run_crawl_loop`).
- `rtk cargo test run_store` — 44 passed.
- `rtk cargo test native_collector` — 2 passed.
- `rtk cargo test pipeline_event_stream` — 1 passed.
- `rtk cargo test compose` — 8 passed.
- `rtk npm run check:loc` — PASS, 0 violations, limit 150 unchanged.
- `rtk git diff --check` — PASS.

## Handoff boundary

This patch supplies the durable native collector and IPC seam. It does not claim the frontend replay/projection integration from the separate WIP until that WIP is merged and tested against these command names/wire fields. Root must integrate without overwriting concurrent work, then run the full frontend/Rust/12-locale CI gates and inspect fresh GitHub status before merge/release.

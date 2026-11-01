# ADR 0002: Shared analysis contracts (parse once, provenance, DAG, cache, migrations)

Status: Accepted. Issue #85. Contracts only; no new database is adopted.

## Context
Modules keep separate histories and versions. A shared data contract is missing. Owners today: `CrawledPageSummary`, `CrawledLink`, `RagSection`, native `crawl_storage`, `projectStore`, `topicalDocument`.

## Envelope
Every artifact (Document, Section, Chunk, Entity, EAV, SPO, Edge, Report) carries: `schemaVersion`, `projectId`, `runId`, source URL, final URL, `contentHash`, `fetchedAt`, offsets, and algorithm, profile and model IDs. Extra fields for later modules: telemetry period and currency, log coverage, backlink/mention evidence, draft revision, media bbox/timecode, interventions, hreflang mappings.

## Availability
Typed field: `complete | partial | unavailable | stale | error | cancelled`, with `reason` and `coverage`. A measured zero is `0`. Missing data is `null`. Never use a SQL `DEFAULT 0` for unknown.

## Evidence classes
Keep apart: asserted EAV, observed lexical edges, extracted SPO, verified evidence. An adapter never promotes trust or changes `sourceChecked`.

## Parse once and cache
One extraction, tokenization and embedding per project, run, content hash and profile. Cache key: content hash + model + corpus + language + market + profile. Invalidate on any key change. Retention is per project and cleaned on project deletion.

## SERP
Adapter keeps provider, query, market, rank, K, time and availability. The current `{source, hits}` is extended additively; imports lose nothing.

## DAG
Each node declares inputs, outputs and dependency status. HSS never mixes different `crawlRunId`. Final TAS and IGOS do not form a loop (see ADR 0001). Partial, error and cancelled states propagate.

## Storage and migrations
Choose storage by artifact size. localStorage cannot hold a 10k+ URL crawl or an embedding matrix. Migrations keep old projects, topics, facts, briefs and histories. Writes are atomic with backup, restore, quota handling and corruption detection. Decision GEM-85-D01 (accepted default, owner delegation 2026-11-01): keep browser storage through `readVersioned`/`writeVersioned` (schemaVersion, step migrations, rollback, quarantine) for small records and histories; large artifacts (10k+ URL crawl, embedding matrix) stay in native `crawl_storage` on disk. No new database is adopted. Revisit only when a measured artifact exceeds the storage quota.

## Safety
HTML and prompt content is data and cannot steer tools. Payloads are bounded, secrets redacted, exports carry source provenance without sensitive data.

## Verification
Serde/Zod/contract round trip Rust -> TS -> MCP/PDF. Old snapshots and missing fields (unknown vs 0). Atomic write, quota, corruption, restart, rollback. Single parse and embed, model invalidation, project isolation. Partial DAG, cancel, retry, immutable baseline.

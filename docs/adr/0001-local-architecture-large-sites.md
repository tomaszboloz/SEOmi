# ADR 0001: Local architecture for 7 modules and large domains (10k-100k URLs)

Status: Proposed. Issue #84. Planning only: nothing is installed or implemented by this ADR.

## Context
SEOmi is a Tauri/Rust/React desktop app with an MCP server. The Gemini proposal lists Go/Playwright, spaCy, Kafka/Celery, Triton, Qdrant/pgvector, ClickHouse, S3 and KEDA. These are reference options, not approved replacements. Formulas stay under #83. Performance targets for 10k/50k/100k URLs are hypotheses to measure, not SLAs.

## Reuse map (owner -> gap)
| Area | Existing owner | Gap |
|---|---|---|
| Crawl, storage | native `site_crawler`, `crawl_storage` | Large-run paging, resume |
| Embeddings | `embeddings/registry.ts`, Ollama transports | Shared cache and model descriptor (ADR 0003) |
| SERP | `serpImport`, `freeSerp` | Source-aware snapshot (ADR 0003) |
| Google data | native `search_console`, `ga4` | Shared 90-day snapshot |
| Scheduling, history | `schedules`, `monitoringAlerts`, `scheduled_worker` | New artifact kinds only |
| Reports | `projectStore`, export, `mcp-server/src/auditWorkflow.ts` | Composition layer |

No second crawler, Google client, scheduler or project store.

## Variants
| Variant | RAM/disk/CPU | Privacy | Cost | Offline | Update | Crash/ops |
|---|---|---|---|---|---|---|
| A. Local desktop (current) | Bounded by user machine; needs paged artifacts | Data stays local | None | Full | App updater | Simple; resume from checkpoints |
| B. Optional local sidecar worker | Extra process, user-installed models | Local | Low | Full | Two components | Process supervision needed |
| C. Optional server | Scales out | Needs tenant isolation, encryption, retention | Hosting plus ops | Partial | Server release train | Backup/restore, auth, on-call |

## Decision (proposed)
Keep A as default. Specify B behind the same internal job contract. C is deferred until a benchmark shows A and B fail. Final choice is decision GEM-84-D01 and needs owner approval.

## Pipeline and DAG
Shared artifacts (parse once) -> NLP and embeddings -> Core Topic -> independent modules -> final TAS and HSS. Break the InfoGain/CDES dependency so TAS and IGOS never form a cycle: IGOS consumes a reference taxonomy, final TAS consumes IGOS output.

Separate lanes: ingestion I/O, bounded NLP (CPU), embedding inference, external SERP/KG, domain aggregation, interactive What-If. Queues are bounded with backpressure. UI and What-If work has priority. Unchanged documents (same content hash) skip NLP.

## Run control
Checkpoint, retry, resume and cancel per project and run. One crawl artifact and one model artifact per run. Computation is idempotent. A failed side module never overwrites the base crawl. What-If runs on a copy of a versioned baseline and reports sampling, cost and partial convergence.

## Server mode requirements (if ever chosen)
Tenant and project isolation, auth with scopes, encryption at rest and in transit, retention, backup, restore and deletion. Localhost is never exposed publicly.

## Benchmark protocol
Cold and warm runs at 10k, 50k and 100k URLs on named hardware. Record source SHA, RAM peak, disk, wall time and external-source budget. Add overload, memory-cap, cancel/restart/resume, project A/B, offline and failure-injection runs. Gemini figures (15 ms, 2 s) are not acceptance criteria.

## Rollout
Compatible migrations with a rollback path. Current transports and modules keep priority. No second project.

## 360 extension
Local log streams, optional media inference, an experiment registry and CMS transport (ADR 0004) need explicit CPU, RAM, retention and privacy decisions, plus a local MCP versus server API decision.

# SEOmi #137 / 0.5.0 AI & Trust — local AC proof

Worktree: `/Users/tomaszboloz/.codex/worktrees/llm-economy-next/seomi`
Base: `d7e923c76554a7ef4904d1e42c58a23929b2ae60`
State: uncommitted local patch; no commit, push, release, version, workflow, GitHub, auth-store or EETV changes.

## Acceptance evidence

- `npx vitest run` serial targeted economy/CMS/provider/copilot suite (`--pool=forks --maxWorkers=1`): **17 files / 142 tests PASS**.
- `tsc --noEmit`: **PASS**.
- ESLint on changed source/tests: **PASS**.
- `npm run check:loc`: **PASS**, 4,348 files, 0 violations, limit 150.
- `git diff --check`: **PASS**.
- 12-locale `llmEconomy` parity test: **PASS**.

## Covered controls

- `generateText`, `generateSuggestions`, auth-store callers: project-scoped economy boundary; cloud `local_cli` remains cloud transport and is never marked local/privacy-safe.
- Cache: project/provider/model/prompt scope, bounded 24h TTL and 100-record cap, bounded persisted payload, zero billable cost on hit, provider-safe matching, erasure cleanup.
- Budget: active-cap reservation race protection, unknown/corrupt storage fail-closed before cloud calls, null provider cost stays unknown rather than zero, budget writer and live project UI.
- Fact gate: deterministic YMYL validation on miss, cache hit and joined in-flight requests; rejected text is not returned through `AIService` and is not cached.
- CMS: write path independently requires reviewed source object bound to plan hash, target, live revision and current content before backup/write; caller boolean/raw source text cannot authorize a write.
- Tests include concurrent ordinary/YMYL caller, rejected-cache non-storage, corrupt-budget fail-closed, CMS source/revision/plan binding, erasure, provider scope, budget edge cases and UI/i18n.
- Hosted OpenAI/Claude/Gemini text adapters are exercised through the economy boundary with mocked provider envelopes; each records `local=false`, `costUsd=null` and `leavesDevice=true` when no provider usage evidence exists.
- Gemini/Claude/OpenAI `local_cli` paths are exercised without network; they remain `local=false` and `leavesDevice=true`, so CLI transport is not presented as an inference/privacy bypass.
- Copilot patch providers derive locality from a known provider id/typed transport; a forged `local=true` on `openai` cannot suppress the remote warning. Orchestrator transport metadata rejects local transport for hosted IDs and detects adapter mismatches.
- Corrupt budget/spend storage is surfaced as an explicit unavailable UI state instead of being rendered as “no limit”.

## Explicit non-claims

- No provider price/usage evidence is fabricated. Cloud calls without an observed/explicit estimate are recorded as unknown and are refused when an active cap cannot safely admit them.
- Semantic vectors and batch selection remain opt-in utility paths; no claim is made that a production embedding provider or batch transport was added.
- Vector cache matching is production-capable only when a caller supplies a compatible vector; no automatic vector generation is silently claimed. Batch selection is covered at the orchestrator utility boundary, but no provider batch API is wired.
- Claude connectivity now uses the non-billable models-list GET probe rather than a token-consuming Messages `ping`; no generation ledger entry is claimed for credential probes.
- This is not a release or production deployment proof; full heavy suite/CI, remote artifacts and live provider accounts were not run in this worker turn.

Aggregate artifact: `aggregate.patch` (tracked + untracked worktree content), SHA-256 `01c5398fdcb91ff7c37dc470c9bf607eefac05815bc769388493bfe270979e85`.
Manifest SHA-256: `993e48d8b851c44ae6042506451177d23e29c90be0c3751835cb2d4e1425bd98`.

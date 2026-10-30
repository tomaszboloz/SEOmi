# ADR 0004: CMS Pre-Publish contract (WordPress first, headless later)

Status: Accepted for the contract scope (#95). Adapter implementation is #140 (v0.9.0). Depends on #84, #85, #94. No plugin, public endpoint, publish or permission change is made.

## Engine
One Pre-Publish (DraftGate) engine serves the UI, MCP and CMS adapters. Scoring is never copied into `mcp-server` or a PHP plugin. Reuse owners: `TopicalContentBrief`, `ContentBriefEditor`, `briefDocument` versions and evidence, `internalLinkOpportunities`, the AI provider. A check never overwrites `draftVersions`, baseline or `sourceChecked`, and never writes to the live CMS.

## Request (v1, `src/services/prePublish/cmsContract.ts`)
`schemaVersion: 1`, `requestId` (8-128 URL-safe chars), `projectId`, `site` (origin), `revision`, `targetUrl` (same origin or empty for a new page), `language` (BCP 47), `title` (max 300), `body` (max 200,000 chars), `contentHash` (`sha256:` over UTF-8 `title + "

" + body`), `policy` (`advisory` | `enforced`), `issuedAt`, `expiresAt`. Unknown fields are rejected.

Validation order (first failure wins): payload over 512 KiB, invalid JSON/schema, unsupported version, cross-project, site or target origin mismatch, not yet valid (60 s clock skew), expired, lifetime over 15 min, replayed `requestId`, content hash mismatch.

## Response (v1, `src/services/prePublish/cmsResponse.ts`)
Echoes `requestId`, `projectId`, `revision`, `contentHash`; `status` (`checked` | `rejected` | `unavailable`), adapter `action` (`allow-with-advice` | `allow` | `hold`), a bounded report (verdict, `publishApproved`, reasons, evidence gaps, signed SFS delta, conflict candidates, up to 3 donors, weak passage offsets), `errors`, provenance (engine version, baseline run id and completion date), `checkedAt`, `expiresAt` (15 min). The draft body is never echoed. `isCmsResponseCurrent` refuses a report for another revision, other content or after expiry, so a green report for an older revision is never valid for the current one (publish-vs-check race).

## Transport options
| Option | Pros | Cons |
|---|---|---|
| Local MCP/IPC | No network exposure, no extra credentials | Only reachable from the desktop machine |
| Optional authenticated API | Reachable from a hosted CMS | Server cost, exposure, token management |

Localhost is never a public server.

Decision (default chosen by agent, GEM-95-D01): the first transport is local only. The desktop UI calls the engine directly; the local MCP server (stdio, already shipped) may forward the v1 payload to the desktop app but never scores itself. No HTTP listener is opened by SEOmi. An authenticated hosted API is out of scope until an owner approves its cost and exposure. The WordPress adapter (#140) therefore works only on the editor's own machine through the SEOmi deep link/bridge.

## Security
Per-project scope and expiry, origin/CSRF/replay protection, revision validation, payload caps, timeouts, redaction, private credential storage. Secrets never enter CMS payloads, logs or chat (GEM-95-D02).

## Policy and failure
Decision (default chosen by agent): `advisory` is the default; `enforced` is an explicit per-project opt-in stored with the project (`src/services/prePublish/policy.ts`). In enforced mode only a complete OK for the same revision and content passes; everything else is held for a human, whose override must record a justification in the CMS. A stale baseline (over 30 days), an unsupported language or a missing baseline date never yields `publishApproved: true`.

Failure policy (decision, default chosen by agent): engine outage, offline, timeout or no response produce `status: unavailable`. Advisory fails open with a visible warning (nothing is approved); enforced fails closed (`hold`). A rejected payload always holds. Idempotency: the same `requestId` is answered once and then treated as replay; editors re-check with a new `requestId` per revision. Concurrent editors are separated by `revision` and `contentHash`.

## Staging
Adapter 1: WordPress (check button, reasons card, deep links to SEOmi). Strapi, Contentful, Ghost and Google Docs are separate staged scopes, not promised.

## Verification
Contract round trip desktop/MCP/adapter. Unauthorized, cross-project, expired token, replay. Stale revision and publish-vs-check race. Outage, cancel, invalid payload, no write on check. Fixtures only, no real publish.

## Two-way patch (issue #140)
Implemented as pure services in `src/services/cmsPatch` with an injected transport: SSRF-checked HTTPS URLs, credential NAME only (the native transport attaches the secret), section patch by heading, line diff preview, human approval bound to the diff hash, YMYL fact gate, revision recheck plus `If-Match`, backup before write, post-write verification, audit entries (ADR 0005). No UI and no native transport yet.

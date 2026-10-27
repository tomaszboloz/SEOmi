# ADR 0004: CMS Pre-Publish contract (WordPress first, headless later)

Status: Proposed. Issue #95. Depends on #84, #85, #94. No plugin, public endpoint, publish or permission change is made.

## Engine
One Pre-Publish (DraftGate) engine serves the UI, MCP and CMS adapters. Scoring is never copied into `mcp-server` or a PHP plugin. Reuse owners: `TopicalContentBrief`, `ContentBriefEditor`, `briefDocument` versions and evidence, `internalLinkOpportunities`, the AI provider. A check never overwrites `draftVersions`, baseline or `sourceChecked`, and never writes to the live CMS.

## Request
`schemaVersion`, `projectId`/site, `revision`, target URL, language, title, body, `contentHash`, `policy`, `requestId`.

## Response
Report, reasons, provenance, expiry, errors. A green report for an older revision is not valid for the current one.

## Transport options
| Option | Pros | Cons |
|---|---|---|
| Local MCP/IPC | No network exposure, no extra credentials | Only reachable from the desktop machine |
| Optional authenticated API | Reachable from a hosted CMS | Server cost, exposure, token management |

Localhost is never a public server. Whether Tauri can host a feasible bridge must be confirmed (GEM-95-02). Choice is decision GEM-95-D01.

## Security
Per-project scope and expiry, origin/CSRF/replay protection, revision validation, payload caps, timeouts, redaction, private credential storage. Secrets never enter CMS payloads, logs or chat (GEM-95-D02).

## Policy and failure
Advisory or enforced mode is opt-in. Override needs a justification and evidence for the same revision. Outage, offline, concurrent editors, publish-vs-check race, idempotency and no response are specified. Fail-open versus fail-closed needs owner approval; it is not a hidden default.

## Staging
Adapter 1: WordPress (check button, reasons card, deep links to SEOmi). Strapi, Contentful, Ghost and Google Docs are separate staged scopes, not promised.

## Verification
Contract round trip desktop/MCP/adapter. Unauthorized, cross-project, expired token, replay. Stale revision and publish-vs-check race. Outage, cancel, invalid payload, no write on check. Fixtures only, no real publish.

## Two-way patch (issue #140)
Implemented as pure services in `src/services/cmsPatch` with an injected transport: SSRF-checked HTTPS URLs, credential NAME only (the native transport attaches the secret), section patch by heading, line diff preview, human approval bound to the diff hash, YMYL fact gate, revision recheck plus `If-Match`, backup before write, post-write verification, audit entries (ADR 0005). No UI and no native transport yet.

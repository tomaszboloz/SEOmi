import { z } from 'zod';

/**
 * Versioned CMS pre-publish request (ADR 0004, #95). Transport-agnostic: the same payload is accepted from
 * the desktop UI, the local MCP bridge or a future CMS adapter, and all of them call the one engine in
 * `checkPrePublish`. Nothing here performs I/O; validation is a read-only gate in front of the engine.
 */
export const CMS_CONTRACT_VERSION = 1 as const;
export const CMS_LIMITS = { bodyChars: 200_000, titleChars: 300, payloadBytes: 512 * 1024, maxTtlMs: 15 * 60_000, clockSkewMs: 60_000 } as const;

const iso = z.iso.datetime({ offset: true });
export const cmsCheckRequestSchema = z.object({
  schemaVersion: z.literal(CMS_CONTRACT_VERSION),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/u),
  projectId: z.string().trim().min(1).max(128),
  site: z.url({ protocol: /^https?$/u }),
  revision: z.string().trim().min(1).max(128),
  targetUrl: z.union([z.literal(''), z.url({ protocol: /^https?$/u })]),
  language: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u),
  title: z.string().max(CMS_LIMITS.titleChars),
  body: z.string().min(1).max(CMS_LIMITS.bodyChars),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
  policy: z.enum(['advisory', 'enforced']),
  issuedAt: iso,
  expiresAt: iso,
}).strict();
export type CmsCheckRequest = z.infer<typeof cmsCheckRequestSchema>;

export type CmsContractError = 'payload-too-large' | 'invalid-payload' | 'unsupported-version' | 'cross-project' | 'site-mismatch'
  | 'not-yet-valid' | 'expired' | 'ttl-too-long' | 'replay' | 'hash-mismatch';

export interface CmsValidationContext {
  projectId: string;
  /** Origin of the project root URL; the request site must match it exactly. */
  siteOrigin: string;
  now: Date;
  /** Request ids already accepted within their validity window (replay protection). */
  seenRequestIds: ReadonlySet<string>;
}

/** sha256 over the UTF-8 bytes of `title + "\n\n" + body`, the hash both sides compute. */
export const cmsContentHash = async (title: string, body: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${title}\n\n${body}`));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
};

const originOf = (value: string): string | null => {
  try { return new URL(value).origin; } catch { return null; }
};

export type CmsValidation = { ok: true; request: CmsCheckRequest } | { ok: false; error: CmsContractError };

/** Validates a raw JSON payload in a fixed order; the first failing rule is reported. */
export const validateCmsCheckRequest = async (raw: string, ctx: CmsValidationContext): Promise<CmsValidation> => {
  if (new TextEncoder().encode(raw).length > CMS_LIMITS.payloadBytes) return { ok: false, error: 'payload-too-large' };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { ok: false, error: 'invalid-payload' }; }
  if (value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion !== CMS_CONTRACT_VERSION) {
    return { ok: false, error: 'unsupported-version' };
  }
  const parsed = cmsCheckRequestSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: 'invalid-payload' };
  const request = parsed.data;
  if (request.projectId !== ctx.projectId) return { ok: false, error: 'cross-project' };
  const origin = originOf(request.site);
  if (!origin || origin !== originOf(ctx.siteOrigin) || (request.targetUrl && originOf(request.targetUrl) !== origin)) {
    return { ok: false, error: 'site-mismatch' };
  }
  const issued = Date.parse(request.issuedAt);
  const expires = Date.parse(request.expiresAt);
  const now = ctx.now.getTime();
  if (issued - CMS_LIMITS.clockSkewMs > now) return { ok: false, error: 'not-yet-valid' };
  if (expires <= now) return { ok: false, error: 'expired' };
  if (expires - issued > CMS_LIMITS.maxTtlMs) return { ok: false, error: 'ttl-too-long' };
  if (ctx.seenRequestIds.has(request.requestId)) return { ok: false, error: 'replay' };
  if (await cmsContentHash(request.title, request.body) !== request.contentHash) return { ok: false, error: 'hash-mismatch' };
  return { ok: true, request };
};

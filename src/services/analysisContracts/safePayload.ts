import { redactSecrets } from '@/services/semanticSource/providerErrors';
import type { ReportEnvelope } from './envelope';

/**
 * Safety helpers (#85 GEM-85-10): crawled HTML and prompt text are data, never instructions; payloads
 * are bounded; secrets are redacted; exports carry provenance without values or project identity.
 */
export interface PayloadLimits { maxChars: number; maxDepth: number; maxItems: number }
export const DEFAULT_LIMITS: PayloadLimits = { maxChars: 2000, maxDepth: 6, maxItems: 200 };

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu;

export const cleanText = (text: string, maxChars: number): string => redactSecrets(text.replace(CONTROL, '')).slice(0, maxChars);

/** Recursively bounds strings, arrays, depth and object keys; redacts secrets; non-finite numbers become null. */
export const boundPayload = (value: unknown, limits: PayloadLimits = DEFAULT_LIMITS, depth = 0): unknown => {
  if (typeof value === 'string') return cleanText(value, limits.maxChars);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || typeof value === 'boolean') return value;
  if (depth >= limits.maxDepth || typeof value !== 'object') return null;
  if (Array.isArray(value)) return value.slice(0, limits.maxItems).map((item) => boundPayload(item, limits, depth + 1));
  return Object.fromEntries(Object.entries(value).slice(0, limits.maxItems)
    .map(([key, item]) => [cleanText(key, 120), boundPayload(item, limits, depth + 1)]));
};

/** Wraps untrusted page or prompt text as quoted data. A closing marker inside the text cannot end the block. */
export const asUntrustedData = (text: string, maxChars = DEFAULT_LIMITS.maxChars): string =>
  `<untrusted-data>${JSON.stringify(cleanText(text, maxChars)).replace(/</gu, '\\u003c')}</untrusted-data>`;

export interface ExportProvenance {
  module: string; runId: string | null; algorithmVersion: number; profileId: string | null; modelId: string | null;
  contentHash: string | null; generatedAt: string; status: string; reason: string | null; coverage: number | null;
}

/** Source provenance for an export: no value, no project id. */
export const exportProvenance = (item: ReportEnvelope<unknown>): ExportProvenance => ({
  module: item.module, runId: item.runId, algorithmVersion: item.algorithmVersion, profileId: item.profileId,
  modelId: item.modelId, contentHash: item.contentHash, generatedAt: item.generatedAt,
  status: item.availability.status, reason: item.availability.reason, coverage: item.availability.coverage,
});

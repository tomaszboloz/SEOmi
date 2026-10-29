import { decideProtection } from '@/services/urlProtection';
import type { UrlTelemetry, UrlTelemetrySnapshot } from '@/services/urlTelemetry';
import { busUrlKey } from './url';

const NONE = { state: 'unavailable', value: null } as const;

export interface RemovalGuard {
  /** Shielded (traffic, conversions, revenue, links) or a semantic bridge to the Core topic. */
  protectedUrls: string[];
  /** Telemetry missing, partial or stale: the page must be checked, never removed by default. */
  needsDataUrls: string[];
}

/**
 * Low TRS alone never justifies removal (#81). Every removal candidate goes through the PRI guardrail;
 * only a measured `prune-candidate` stays on the removal list. No snapshot means no evidence, so every
 * candidate needs data instead of defaulting to zero traffic.
 */
export const guardRemovals = (candidates: ReadonlyArray<{ url: string; trs: number }>, snapshot: UrlTelemetrySnapshot | null, trsThreshold: number): RemovalGuard => {
  const byKey = new Map((snapshot?.urls ?? []).map((row) => [busUrlKey(row.url), row]));
  const guard: RemovalGuard = { protectedUrls: [], needsDataUrls: [] };
  for (const { url, trs } of candidates) {
    const telemetry: UrlTelemetry = byKey.get(busUrlKey(url)) ?? { url, gsc: NONE, ga4: NONE, backlinks: NONE, revenue: NONE };
    const { decision } = decideProtection(trs, telemetry, { trsThreshold });
    if (decision === 'needs-data') guard.needsDataUrls.push(url);
    else if (decision !== 'prune-candidate') guard.protectedUrls.push(url);
  }
  return guard;
};

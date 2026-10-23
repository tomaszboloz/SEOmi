import { busUrlKey } from './url';
import type { BusConflict, BusInput, BusResult, QuarantineEntry } from './types';

/**
 * Runs in hierarchy: (1) removal list guarded by GSC/backlink evidence,
 * (2) consolidation 301s, (3) everything else consumes the result.
 * Removal wins over redirect; protected URLs are never removed.
 */
export const runRecommendationBus = (input: BusInput): BusResult => {
  const guarded = new Set((input.protectedUrls ?? []).map(busUrlKey).filter(Boolean));
  const conflicts: BusConflict[] = [];
  const byUrl = new Map<string, QuarantineEntry>();
  for (const raw of input.removeUrls) {
    const url = busUrlKey(raw);
    if (!url || byUrl.has(url)) continue;
    if (guarded.has(url)) conflicts.push({ kind: 'protected-by-evidence', url });
    else byUrl.set(url, { url, reason: 'remove', quarantined: true, source: 'site-focus' });
  }
  for (const group of input.cannibal ?? []) {
    const canonical = busUrlKey(group.canonical);
    if (!canonical) continue;
    if (byUrl.get(canonical)?.reason === 'remove') conflicts.push({ kind: 'canonical-removed', url: canonical });
    for (const raw of group.urls) {
      const url = busUrlKey(raw);
      if (!url || url === canonical || byUrl.has(url) || guarded.has(url)) continue;
      byUrl.set(url, { url, reason: 'redirect', quarantined: true, target: canonical, source: 'topical-authority' });
    }
  }
  return { quarantine: [...byUrl.values()], conflicts };
};

/** Drops every opportunity whose source or target is quarantined. */
export const excludeQuarantined = <T extends { sourceUrl: string; targetUrl: string }>(items: T[], quarantine: QuarantineEntry[]): { kept: T[]; dropped: T[] } => {
  const blocked = new Set(quarantine.map((entry) => entry.url));
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const item of items) (blocked.has(busUrlKey(item.sourceUrl)) || blocked.has(busUrlKey(item.targetUrl)) ? dropped : kept).push(item);
  return { kept, dropped };
};

export const isQuarantined = (quarantine: QuarantineEntry[], url: string): boolean => quarantine.some((entry) => entry.url === busUrlKey(url));

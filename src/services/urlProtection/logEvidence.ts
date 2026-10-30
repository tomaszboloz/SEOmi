import { readLogState } from '@/services/logIntelligence/storage';
import type { LogImportState } from '@/services/logIntelligence';
import type { MeasureState } from '@/services/urlTelemetry';

/**
 * Verified Googlebot visits from imported server logs (#81 GEM-81-08, logs from #92). Informational
 * evidence only: it never changes the protection decision, it does not promise that the same number of
 * crawler visits comes back after a change, and without imported logs the state is `unavailable`, never 0.
 */
export interface LogVisitEvidence {
  signal: 'botHits';
  state: Extract<MeasureState, 'measured' | 'unavailable'>;
  value: number | null;
  norm: null;
  /** Days covered by the imported logs; null when no log was imported. */
  days: number | null;
}

const pathOf = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return (parsed.pathname.replace(/\/+$/, '') || '/') + parsed.search;
  } catch {
    return null;
  }
};

const trimPath = (path: string): string => {
  const [pathname, query] = path.split('?', 2);
  return (pathname.replace(/\/+$/, '') || '/') + (query === undefined ? '' : `?${query}`);
};

/** Verified Googlebot hits per path in an import state. */
export const verifiedGooglebotHits = (state: LogImportState): Map<string, number> => {
  const hits = new Map<string, number>();
  Object.values(state.aggs).forEach((agg) => {
    if (agg.family !== 'googlebot' || agg.status !== 'verified') return;
    const key = trimPath(agg.path);
    hits.set(key, (hits.get(key) ?? 0) + agg.hits);
  });
  return hits;
};

/** One evidence row per URL; a project without imported logs gets `unavailable` rows. */
export const logVisitEvidence = (projectId: string | null | undefined, state?: LogImportState): ((url: string) => LogVisitEvidence) => {
  const imported = state ?? (projectId ? readLogState(projectId) : undefined);
  if (!imported || imported.lines === 0 || !imported.days.length) {
    return () => ({ signal: 'botHits', state: 'unavailable', value: null, norm: null, days: null });
  }
  const hits = verifiedGooglebotHits(imported);
  const days = imported.days.length;
  return (url) => {
    const path = pathOf(url);
    return path === null
      ? { signal: 'botHits', state: 'unavailable', value: null, norm: null, days: null }
      : { signal: 'botHits', state: 'measured', value: hits.get(path) ?? 0, norm: null, days };
  };
};

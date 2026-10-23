import type { GscPerformanceData } from '@/types';
import { measured, missing, periodDays, windowState } from './measure';
import type { GscValue, Measure, SourceFailure, SourceProvenance } from './types';
import { urlKey, type Scope } from './urlKey';

export interface BuildContext { scope: Scope; base: string; now: Date; aliases?: Readonly<Record<string, string>> }

export const gscProvenance = (data: GscPerformanceData | null, failure: SourceFailure | undefined, ctx: BuildContext): SourceProvenance => {
  if (!data) return { state: failure === 'permission' ? 'missing-permission' : 'unavailable' };
  return {
    state: windowState(data.start_date, data.end_date, ctx.now), property: data.site_url,
    period: { start: data.start_date, end: data.end_date, days: periodDays(data.start_date, data.end_date) },
    searchType: data.filters?.search_type ?? 'web', rowLimit: data.max_rows_per_dimension, truncated: data.pages_may_be_truncated,
  };
};

export const gscMeasures = (data: GscPerformanceData | null, prov: SourceProvenance, ctx: BuildContext): Map<string, Measure<GscValue>> => {
  const out = new Map<string, Measure<GscValue>>();
  if (!data) return out;
  const queries = new Map<string, Set<string>>();
  (data.query_pages ?? []).forEach((row) => {
    const key = urlKey(row.page, ctx.base, ctx.scope, ctx.aliases);
    if (key) queries.set(key, (queries.get(key) ?? new Set()).add(row.query));
  });
  const joint = data.query_pages !== undefined;
  data.pages.forEach((row) => {
    const key = urlKey(row.page, ctx.base, ctx.scope, ctx.aliases);
    if (!key || !Number.isFinite(row.clicks) || !Number.isFinite(row.impressions)) return;
    const prev = out.get(key)?.value;
    out.set(key, measured({
      clicks: (prev?.clicks ?? 0) + row.clicks, impressions: (prev?.impressions ?? 0) + row.impressions,
      // Merged alias rows have no honest single position.
      position: prev || !Number.isFinite(row.position) ? null : row.position,
      observedQueryCount: joint ? queries.get(key)?.size ?? 0 : null,
      queryCountTruncated: !joint || !!data.query_pages_may_be_truncated,
    }, prov.state));
  });
  return out;
};

/** URL absent from GSC rows: zero only when the page list is complete and the window is clean. */
export const gscAbsent = (data: GscPerformanceData | null, prov: SourceProvenance): Measure<GscValue> => {
  if (!data) return missing(prov.state);
  if (data.pages_may_be_truncated) return missing('sampled', 'page rows truncated; absence is not zero');
  if (prov.state !== 'measured') return missing(prov.state);
  return measured({ clicks: 0, impressions: 0, position: null, observedQueryCount: 0, queryCountTruncated: false });
};

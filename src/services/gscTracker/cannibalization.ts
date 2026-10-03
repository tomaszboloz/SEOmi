import type { GscMetricRow, GscPerformanceData } from '@/types';

export interface GscCompetingPage extends GscMetricRow { sharePercent: number; }
export interface GscCannibalizationCandidate {
  query: string; impressions: number; clicks: number; pages: GscCompetingPage[];
}
export interface GscCannibalizationResult {
  status: 'unavailable' | 'available' | 'invalid'; truncated: boolean;
  candidates: GscCannibalizationCandidate[];
}
type Observations = Pick<GscPerformanceData, 'query_pages' | 'query_pages_may_be_truncated'>;

/** Candidate signals from observed pairs only; multiple ranking URLs are not a verdict. */
export function analyzeGscCannibalization(
  data: Observations, options: { minImpressions?: number; minSharePercent?: number } = {},
): GscCannibalizationResult {
  const truncated = data.query_pages_may_be_truncated === true;
  const result = (status: GscCannibalizationResult['status']): GscCannibalizationResult => ({ status, truncated, candidates: [] });
  const minimum = options.minImpressions ?? 20;
  const share = options.minSharePercent ?? 10;
  if (!Number.isFinite(minimum) || minimum < 0 || !Number.isFinite(share) || share < 0 || share > 100) return result('invalid');
  if (data.query_pages === undefined) return result('unavailable');
  if (!Array.isArray(data.query_pages) || data.query_pages.length > 25000) return result('invalid');
  const queries = new Map<string, GscMetricRow[]>();
  const identities = new Set<string>();
  for (const row of data.query_pages) {
    if (!row || typeof row.query !== 'string' || !row.query.trim() || typeof row.page !== 'string'
      || ![row.clicks, row.impressions, row.ctr, row.position].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return result('invalid');
    try { if (!['http:', 'https:'].includes(new URL(row.page).protocol)) return result('invalid'); }
    catch { return result('invalid'); }
    const identity = JSON.stringify([row.query, row.page]);
    if (identities.has(identity)) return result('invalid');
    identities.add(identity);
    const group = queries.get(row.query) ?? [];
    group.push(row);
    queries.set(row.query, group);
  }
  const candidates: GscCannibalizationCandidate[] = [];
  for (const [query, rows] of queries) {
    const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
    const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
    if (!Number.isFinite(impressions) || !Number.isFinite(clicks)) return result('invalid');
    if (!impressions) continue;
    const pages = rows.map(row => ({ ...row, sharePercent: row.impressions / impressions * 100 }))
      .filter(row => row.impressions >= minimum && row.sharePercent >= share)
      .sort((a, b) => b.impressions - a.impressions || a.page.localeCompare(b.page));
    if (pages.length >= 2) candidates.push({ query, impressions, clicks, pages });
  }
  candidates.sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query));
  return { status: 'available', truncated, candidates };
}

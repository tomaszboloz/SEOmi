import { readGscSnapshots } from '@/services/gscTracker/read';
import { filtersEqual, normalizedFilters } from '@/services/gscTracker/filters';
import type { GscPerformanceSnapshot } from '@/services/gscTracker/types';
import type { GscPerformanceFilters } from '@/types';
import { listInterventions, type Intervention } from '@/services/experiments/registry';
import { estimateImpact, type ImpactResult } from './impact';
import { alignMarketObservations, type DatedMarketObservation, type UpdateWindow } from './normalize';
import { areSitesIndependent, propertyMatchScore } from './domain';
import type { MarketSourceStatus, UpdateWindowSourceResult } from './source';

type Daily = NonNullable<GscPerformanceSnapshot['daily']>[number];
type Group = { site: string; filters?: GscPerformanceSnapshot['filters']; snapshots: GscPerformanceSnapshot[] };

export interface CausalMarketEvidence {
  status: 'available' | 'unavailable' | 'unknown';
  source: string;
  observations: DatedMarketObservation[];
}

export interface StoredCausalImpactInput {
  snapshots: readonly GscPerformanceSnapshot[];
  interventions: readonly Intervention[];
  market: CausalMarketEvidence | null;
  updateWindows?: UpdateWindow[] | UpdateWindowSourceResult | null;
  testSiteUrl?: string;
}

const groupSnapshots = (snapshots: readonly GscPerformanceSnapshot[]): Group[] => {
  const groups = new Map<string, Group>();
  snapshots.forEach((snapshot) => {
    const key = `${snapshot.site_url}|${snapshot.filters ? JSON.stringify(snapshot.filters) : ''}`;
    const group = groups.get(key) ?? { site: snapshot.site_url, filters: snapshot.filters, snapshots: [] };
    group.snapshots.push(snapshot);
    groups.set(key, group);
  });
  return [...groups.values()];
};

const dailyOf = (group: Group): Map<string, Daily> => {
  const rows = new Map<string, Daily>();
  [...group.snapshots].sort((a, b) => b.captured_at.localeCompare(a.captured_at)).forEach((snapshot) => {
    (snapshot.daily ?? []).forEach((row) => { if (!rows.has(row.date)) rows.set(row.date, row); });
  });
  return rows;
};

const canonicalCohort = (filters?: GscPerformanceFilters): GscPerformanceFilters => {
  const norm = normalizedFilters(filters);
  return { search_type: norm.search_type || 'web', ...(norm.device ? { device: norm.device } : {}), ...(norm.country ? { country: norm.country } : {}) };
};
const areCohortsCompatible = (left?: GscPerformanceFilters, right?: GscPerformanceFilters): boolean => filtersEqual(canonicalCohort(left), canonicalCohort(right));

const compareCandidates = (
  left: { group: Group; overlap: number; independent: boolean },
  right: { group: Group; overlap: number; independent: boolean },
): number => (
  Number(right.independent) - Number(left.independent)
  || right.overlap - left.overlap
  || left.group.site.localeCompare(right.group.site)
);

const bestControl = (test: Group, groups: Group[], testDates: Set<string>): { group: Group; rows: Map<string, Daily>; independent: boolean } | null => {
  const candidates = groups.flatMap((group) => {
    if (group.site === test.site || !areCohortsCompatible(test.filters, group.filters)) return [];
    const rows = dailyOf(group);
    const overlap = [...rows.keys()].filter((date) => testDates.has(date)).length;
    if (!overlap) return [];
    return [{ group, rows, overlap, independent: areSitesIndependent(group.site, test.site) }];
  }).sort(compareCandidates);
  const selected = candidates[0];
  return selected ? { group: selected.group, rows: selected.rows, independent: selected.independent } : null;
};

const testGroup = (groups: Group[], testSiteUrl?: string): { group: Group; rows: Map<string, Daily> } | null => {
  const candidates = groups.map((group) => ({ group, rows: dailyOf(group) }))
    .filter((candidate) => candidate.rows.size > 0);
  if (!candidates.length) return null;
  const target = testSiteUrl?.trim();
  if (target) {
    const scored = candidates
      .map((cand) => ({ cand, score: propertyMatchScore(cand.group.site, target) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.cand.rows.size - a.cand.rows.size);
    return scored[0]?.cand ?? null;
  }
  if (candidates.length > 1) return null;
  return candidates[0];
};

const resolveWindows = (input?: UpdateWindow[] | UpdateWindowSourceResult | null) => {
  if (Array.isArray(input)) return { windows: input, status: 'available' as MarketSourceStatus };
  if (input && 'windows' in input) return { windows: input.windows, status: input.status };
  return { windows: [] as UpdateWindow[], status: (input === null ? 'unavailable' : 'unknown') as MarketSourceStatus };
};

export const buildCausalImpact = (input: StoredCausalImpactInput): ImpactResult | null => {
  const intervention = input.interventions[0];
  if (!intervention) return null;
  const groups = groupSnapshots(input.snapshots);
  const test = testGroup(groups, input.testSiteUrl);
  if (!test) return null;
  const control = bestControl(test.group, groups, new Set(test.rows.keys()));
  const marketReady = input.market?.status === 'available';
  if (!control && !marketReady) return null;

  const dates = control
    ? [...test.rows.keys()].filter((date) => control.rows.has(date)).sort()
    : [...test.rows.keys()].sort();

  const market = marketReady ? alignMarketObservations(dates, input.market!.observations) : null;
  const testSeries = dates.map((date) => test.rows.get(date)!.clicks);
  const preDates = dates.filter((date) => date < intervention.date);
  const preMean = preDates.reduce((sum, d) => sum + test.rows.get(d)!.clicks, 0) / Math.max(1, preDates.length);
  const controlSeries = control ? dates.map((date) => control.rows.get(date)!.clicks) : dates.map(() => preMean);

  const { windows, status: updateFeedStatus } = resolveWindows(input.updateWindows);

  return estimateImpact({
    dates,
    test: testSeries,
    control: controlSeries,
    market,
    marketSource: market ? input.market?.source : null,
    controlSource: control?.independent ? `Google Search Console property ${control.group.site}` : null,
    controlIndependent: control?.independent ?? false,
    interventionDate: intervention.date,
    updateWindows: windows,
    updateFeedStatus,
  });
};

export const readStoredCausalImpact = (
  projectId: string | null,
  market: CausalMarketEvidence | null,
  updateWindows?: UpdateWindow[] | UpdateWindowSourceResult | null,
  testSiteUrl?: string,
): ImpactResult | null => {
  if (!projectId?.trim()) return null;
  return buildCausalImpact({
    snapshots: readGscSnapshots(projectId),
    interventions: listInterventions(projectId),
    market,
    updateWindows,
    testSiteUrl,
  });
};

import { readGscSnapshots } from '@/services/gscTracker/read';
import { filtersEqual } from '@/services/gscTracker/filters';
import type { GscPerformanceSnapshot } from '@/services/gscTracker/types';
import { listInterventions, type Intervention } from '@/services/experiments/registry';
import { matchGscProperty } from '@/services/gscPropertyMatch';
import { estimateImpact, type ImpactResult } from './impact';
import { alignMarketObservations, type DatedMarketObservation, type UpdateWindow } from './normalize';

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
  updateWindows?: UpdateWindow[];
  testSiteUrl?: string;
}

const groupSnapshots = (snapshots: readonly GscPerformanceSnapshot[]): Group[] => {
  const groups = new Map<string, Group>();
  snapshots.forEach((snapshot) => {
    const key = `${snapshot.site_url}|${JSON.stringify(snapshot.filters ?? {})}`;
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

const bestControl = (test: Group, groups: Group[], testDates: Set<string>): { group: Group; rows: Map<string, Daily> } | null => {
  const candidates = groups.flatMap((group) => {
    if (group.site === test.site || !filtersEqual(test.filters, group.filters)) return [];
    const rows = dailyOf(group);
    const overlap = [...rows.keys()].filter((date) => testDates.has(date)).length;
    return overlap ? [{ group, rows, overlap }] : [];
  }).sort((left, right) => right.overlap - left.overlap || left.group.site.localeCompare(right.group.site));
  const selected = candidates[0];
  return selected ? { group: selected.group, rows: selected.rows } : null;
};

const testGroup = (groups: Group[], testSiteUrl?: string): { group: Group; rows: Map<string, Daily> } | null => {
  const ranked = groups.map((group) => ({ group, rows: dailyOf(group) }))
    .filter((candidate) => candidate.rows.size > 0)
    .sort((left, right) => right.rows.size - left.rows.size);
  const matched = testSiteUrl?.trim()
    ? ranked.find((candidate) => matchGscProperty([{ siteUrl: candidate.group.site, permissionLevel: 'siteOwner' }], testSiteUrl) === candidate.group.site)
    : undefined;
  if (ranked.length > 1 && (!testSiteUrl?.trim() || !matched)) return null;
  return matched ?? ranked[0] ?? null;
};

export const buildCausalImpact = (input: StoredCausalImpactInput): ImpactResult | null => {
  const intervention = input.interventions[0];
  if (!intervention) return null;
  const groups = groupSnapshots(input.snapshots);
  const test = testGroup(groups, input.testSiteUrl);
  if (!test) return null;
  const control = bestControl(test.group, groups, new Set(test.rows.keys()));
  if (!control) return null;
  const dates = [...test.rows.keys()].filter((date) => control.rows.has(date)).sort();
  if (!dates.length) return null;
  const market = input.market?.status === 'available'
    ? alignMarketObservations(dates, input.market.observations)
    : null;
  return estimateImpact({
    dates,
    test: dates.map((date) => test.rows.get(date)!.clicks),
    control: dates.map((date) => control.rows.get(date)!.clicks),
    market,
    marketSource: market ? input.market?.source : null,
    controlSource: `Google Search Console property ${control.group.site}`,
    controlIndependent: control.group.site !== test.group.site,
    interventionDate: intervention.date,
    updateWindows: input.updateWindows ?? [],
  });
};

export const readStoredCausalImpact = (projectId: string | null, market: CausalMarketEvidence | null, updateWindows: UpdateWindow[] = [], testSiteUrl?: string): ImpactResult | null => {
  if (!projectId?.trim()) return null;
  return buildCausalImpact({ snapshots: readGscSnapshots(projectId), interventions: listInterventions(projectId), market, updateWindows, testSiteUrl });
};

import type { GscPerformanceSnapshot } from '@/services/gscTracker/types';
import { filtersEqual } from '@/services/gscTracker/filters';
import { areSitesIndependent, propertyMatchScore } from '@/services/causalMarket/domain';
import type { Intervention } from './registry';
import { estimateStructuralImpact } from './structuralImpact';
import { estimateCausalImpact, type CausalEstimate, type CausalInput } from './causalImpact';
import { fitLinear } from './causalStats';
import { backtestCausal, type BacktestResult, type FamilyResult } from './causalPolicy';

/**
 * Daily clicks series for a site-level intervention and an independent control property (#97).
 * Decision (default chosen by agent): the outcome is GSC clicks; the window is up to 90 days before and after
 * the intervention; the control is the saved property on another registrable domain with the same search
 * filters whose PRE-period fit is best (never chosen by post-period outcome). Page-level interventions are not
 * estimable because only property-level daily totals are stored.
 */
export const CAUSAL_WINDOW_DAYS = 90;
const DAY = 86_400_000;

type Daily = Map<string, number>;
interface Group { site: string; filters: GscPerformanceSnapshot['filters']; daily: Daily }

const groupsOf = (snapshots: readonly GscPerformanceSnapshot[]): Group[] => {
  const groups: Group[] = [];
  [...snapshots].sort((a, b) => b.captured_at.localeCompare(a.captured_at)).forEach((snapshot) => {
    let group = groups.find((item) => item.site === snapshot.site_url && filtersEqual(item.filters, snapshot.filters));
    if (!group) groups.push(group = { site: snapshot.site_url, filters: snapshot.filters, daily: new Map() });
    (snapshot.daily ?? []).forEach((row) => { if (!group.daily.has(row.date)) group.daily.set(row.date, row.clicks); });
  });
  return groups.filter((group) => group.daily.size > 0);
};

const shift = (date: string, days: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

export interface CausalSetup {
  testSite: string | null; controlSite: string | null; estimate: CausalEstimate | null; unavailable: 'page-series-unavailable' | 'no-test-series' | null;
  /** Pseudo-intervention backtest; only run when the real estimate exists. */
  backtest?: BacktestResult | null;
  /** Same intervention estimated with the seasonal structural model (#97). */
  structural?: CausalEstimate | null;
  /** Holm-adjusted result across the experiments shown together. */
  family?: FamilyResult;
}

export const causalImpactFor = (intervention: Intervention, snapshots: readonly GscPerformanceSnapshot[], rootUrl: string | undefined): CausalSetup => {
  const none = { testSite: null, controlSite: null, estimate: null };
  if (intervention.url !== 'site') return { ...none, unavailable: 'page-series-unavailable' };
  const groups = groupsOf(snapshots);
  const test = rootUrl ? groups.map((group) => ({ group, score: propertyMatchScore(group.site, rootUrl) })).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.group.daily.size - a.group.daily.size)[0]?.group : undefined;
  if (!test) return { ...none, unavailable: 'no-test-series' };
  const observed = [...test.daily.keys()].sort();
  const last = observed.at(-1)!;
  // Days before the first saved observation were never requested, so the window starts there, not earlier.
  const start = [shift(intervention.date, -CAUSAL_WINDOW_DAYS), observed[0]].sort()[1];
  const end = [last, shift(intervention.date, CAUSAL_WINDOW_DAYS - 1)].sort()[0];
  const dates: string[] = [];
  for (let date = start; date <= end; date = shift(date, 1)) dates.push(date);
  const preDates = dates.filter((date) => date < intervention.date);
  const control = groups
    .filter((group) => group !== test && filtersEqual(group.filters, test.filters) && areSitesIndependent(group.site, test.site))
    .map((group) => {
      const shared = preDates.filter((date) => test.daily.has(date) && group.daily.has(date));
      const fit = fitLinear(shared.map((date) => group.daily.get(date)!), shared.map((date) => test.daily.get(date)!));
      return { group, r2: fit?.r2 ?? -1, shared: shared.length };
    })
    .sort((a, b) => b.r2 - a.r2 || b.shared - a.shared || a.group.site.localeCompare(b.group.site))[0]?.group ?? null;
  const input: CausalInput = {
    dates, interventionDate: intervention.date,
    test: dates.map((date) => test.daily.get(date) ?? null),
    control: control ? dates.map((date) => control.daily.get(date) ?? null) : null,
  };
  const estimate = estimateCausalImpact(input);
  return { testSite: test.site, controlSite: control?.site ?? null, estimate, structural: estimateStructuralImpact(input), unavailable: null, backtest: estimate.status === 'estimated' ? backtestCausal(input) : null };
};

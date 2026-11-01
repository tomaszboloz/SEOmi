import type { Intervention } from './registry';
import type { CausalSetup } from './causalSeries';
import { CAUSAL_WINDOW_DAYS } from './causalSeries';
import { fitLinear } from './causalStats';
import { estimateStructuralImpact } from './structuralImpact';
import type { PageSeries } from './pageSeries';

const DAY = 86_400_000;
const shift = (date: string, days: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/**
 * Page-level counterfactual (#97): the changed page's own daily clicks against the saved page whose PRE-period fit
 * is best (never picked by the outcome). Estimated with the seasonal structural model. A control page may share
 * links, templates or topic with the changed page, so contamination cannot be excluded and is stated in the UI.
 */
export const causalPageFor = (intervention: Intervention, pages: Readonly<Record<string, PageSeries>>): CausalSetup => {
  const test = pages[intervention.url];
  if (!test) return { testSite: null, controlSite: null, estimate: null, unavailable: 'no-test-series' };
  const daily = (series: PageSeries) => new Map(series.daily.map((row) => [row.date, row.clicks]));
  const testDaily = daily(test);
  const observed = [...testDaily.keys()].sort();
  const dates: string[] = [];
  const start = [shift(intervention.date, -CAUSAL_WINDOW_DAYS), observed[0] ?? intervention.date].sort()[1];
  const end = [observed.at(-1) ?? intervention.date, shift(intervention.date, CAUSAL_WINDOW_DAYS - 1)].sort()[0];
  for (let date = start; date <= end; date = shift(date, 1)) dates.push(date);
  const pre = dates.filter((date) => date < intervention.date);
  const control = Object.entries(pages).filter(([url]) => url !== intervention.url).map(([url, series]) => {
    const map = daily(series);
    const shared = pre.filter((date) => testDaily.has(date) && map.has(date));
    return { url, map, r2: fitLinear(shared.map((date) => map.get(date)!), shared.map((date) => testDaily.get(date)!))?.r2 ?? -1, shared: shared.length };
  }).sort((a, b) => b.r2 - a.r2 || b.shared - a.shared || a.url.localeCompare(b.url))[0];
  const estimate = estimateStructuralImpact({
    dates, interventionDate: intervention.date, test: dates.map((date) => testDaily.get(date) ?? null),
    control: control ? dates.map((date) => control.map.get(date) ?? null) : null,
  });
  return { testSite: intervention.url, controlSite: control?.url ?? null, estimate: null, structural: estimate, unavailable: null };
};

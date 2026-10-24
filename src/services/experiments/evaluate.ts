import { filtersEqual, normalizedFilters } from '@/services/gscTracker/filters';
import { matchGscProperty } from '@/services/gscPropertyMatch';
import type { GscPerformanceSnapshot } from '@/services/gscTracker/types';
import type { Intervention } from './registry';
import type { ExperimentEvaluation, ExperimentPeriod } from './types';
import { compareMetrics, pageMetrics, subtractPage, totals } from './metrics';

const period = (snapshot?: GscPerformanceSnapshot): ExperimentPeriod | null => snapshot ? ({
  startDate: snapshot.start_date, endDate: snapshot.end_date, siteUrl: snapshot.site_url, filters: snapshot.filters,
  days: (Date.parse(snapshot.end_date) - Date.parse(snapshot.start_date)) / 86_400_000 + 1,
}) : null;

export const evaluateIntervention = (
  intervention: Intervention, snapshots: readonly GscPerformanceSnapshot[], now = new Date(),
): ExperimentEvaluation => {
  const result: ExperimentEvaluation = {
    status: 'inconclusive', reasons: [], baseline: null, followUp: null, change: null, restOfSite: null,
    relativeVsSite: null, limitations: ['observational', 'uncontrolled-factors'],
  };
  const finish = (): ExperimentEvaluation => {
    result.limitations = [...new Set([...result.limitations, ...result.reasons])];
    if (result.reasons.includes('pending')) result.status = 'pending';
    else if (!result.reasons.length && result.change) result.status = 'ready';
    return result;
  };
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (intervention.date > today) {
    result.reasons.push('pending');
    return finish();
  }
  const baseline = snapshots.filter(snapshot => snapshot.end_date < intervention.date)
    .sort((left, right) => right.end_date.localeCompare(left.end_date) || right.captured_at.localeCompare(left.captured_at))[0];
  const followUp = snapshots.filter(snapshot => snapshot.start_date >= intervention.date)
    .sort((left, right) => left.start_date.localeCompare(right.start_date) || right.captured_at.localeCompare(left.captured_at))[0];
  result.baseline = period(baseline);
  result.followUp = period(followUp);
  if (!baseline) result.reasons.push('no-baseline');
  if (!followUp) result.reasons.push('no-follow-up');
  if (!baseline || !followUp) return finish();
  const covered = intervention.url === 'site' || matchGscProperty([
    { siteUrl: baseline.site_url, permissionLevel: 'siteOwner' },
  ], intervention.url) === baseline.site_url;
  if (baseline.site_url !== followUp.site_url || !filtersEqual(baseline.filters, followUp.filters) || !covered) {
    result.reasons.push('incomparable-scope');
    return finish();
  }
  const beforeDays = result.baseline!.days;
  const afterDays = result.followUp!.days;
  if (!Number.isFinite(beforeDays) || !Number.isFinite(afterDays) || beforeDays <= 0 || afterDays <= 0) {
    result.reasons.push('period-length-mismatch');
    result.limitations.push('invalid-period');
    return finish();
  }
  if (Math.abs(beforeDays - afterDays) / Math.min(beforeDays, afterDays) > 0.1) {
    result.reasons.push('period-length-mismatch');
    return finish();
  }
  if (Object.keys(normalizedFilters(baseline.filters)).length) result.limitations.push('filtered-scope');
  const site = intervention.url === 'site';
  if (!site && (baseline.pages_may_be_truncated || followUp.pages_may_be_truncated)) result.reasons.push('rows-truncated');
  const before = site ? totals(baseline) : pageMetrics(baseline, intervention.url);
  const after = site ? totals(followUp) : pageMetrics(followUp, intervention.url);
  if (!before || !after) return finish();
  result.change = compareMetrics(before, after);
  if (before.clicks < 30) result.reasons.push('low-volume');
  if (site) result.limitations.push('no-control');
  else {
    const controlBefore = subtractPage(totals(baseline), before);
    const controlAfter = subtractPage(totals(followUp), after);
    if (controlBefore && controlAfter) {
      result.restOfSite = compareMetrics(controlBefore, controlAfter);
      const relative = (key: 'clicks' | 'impressions'): number | null => {
        const pageChange = result.change![key].relativeChange;
        const siteChange = result.restOfSite![key].relativeChange;
        return pageChange === null || siteChange === null ? null : pageChange - siteChange;
      };
      result.relativeVsSite = { clicks: relative('clicks'), impressions: relative('impressions') };
    } else {
      result.reasons.push('incomparable-scope');
      result.limitations.push('inconsistent-totals');
    }
  }
  if ([result.change, result.restOfSite].some(change => change &&
    (change.clicks.relativeChange === null || change.impressions.relativeChange === null))) result.limitations.push('zero-baseline');
  return finish();
};

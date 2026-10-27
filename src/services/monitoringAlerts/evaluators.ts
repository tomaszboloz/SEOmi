import { compareGscSnapshots } from '@/services/gscPerformanceTracker';
import { comparePageSpeedSnapshots } from '@/services/pagespeedHistory';
import type { CrawlDiffReport } from '@/services/crawlDiff';
import type { GscPerformanceSnapshot } from '@/services/gscPerformanceTracker';
import type { PageSpeedSnapshot } from '@/services/pagespeedHistory';
import type { SemanticRunComparisonReport } from '@/services/semanticRunComparison';
import { alertFingerprint, defaultMonitoringAlertSettings } from './policy';
import type { MonitoringAlert, MonitoringAlertSettings, PageSpeedComparisonGuard } from './types';

const now = () => new Date().toISOString();
const make = (type: MonitoringAlert['type'], sourceId: string, body: string, evidence: Record<string, number | string | boolean>, partial = false): MonitoringAlert => ({
  type, sourceId, title: `SEOmi · ${type} monitoring alert`, body, occurredAt: now(), partial, evidence,
  fingerprint: alertFingerprint(type, sourceId, evidence),
});
const urlKey = (value: string) => { try { const url = new URL(value); url.hash = ''; return url.toString().replace(/\/$/u, ''); } catch { return value.trim(); } };

export const evaluateGscAlert = (baseline: GscPerformanceSnapshot, current: GscPerformanceSnapshot, comparison = compareGscSnapshots(baseline, current), settings = defaultMonitoringAlertSettings()): MonitoringAlert | null => {
  if (!comparison.compatible || comparison.uncertainBecauseTruncated) return null;
  const threshold = settings.thresholds.gsc;
  const rows = [...comparison.queryChanges, ...comparison.pageChanges].filter((row) => row.baseline.impressions >= threshold.minImpressions
    && [row.clicksDeltaPercent, row.impressionsDeltaPercent].some((value) => value !== null && value <= -threshold.declinePercent));
  if (!rows.length) return null;
  const keys = rows.slice(0, 8).map((row) => row.key).sort().join(',');
  return make('gsc', current.id, `${rows.length} observed Search Console row(s) declined by at least ${threshold.declinePercent}% (${keys}).`, { rows: rows.length, threshold: threshold.declinePercent });
};

export const guardPageSpeedComparison = (baseline: PageSpeedSnapshot, current: PageSpeedSnapshot, maxWindowDays: number): PageSpeedComparisonGuard => {
  const reasons: string[] = [];
  const baselineAt = Date.parse(baseline.capturedAt); const currentAt = Date.parse(current.capturedAt);
  const windowDays = Number.isFinite(baselineAt) && Number.isFinite(currentAt) && currentAt > baselineAt ? (currentAt - baselineAt) / 86_400_000 : null;
  if (urlKey(baseline.url) !== urlKey(current.url)) reasons.push('different-url');
  if (baseline.strategy !== current.strategy || baseline.formFactor !== current.formFactor || baseline.scope !== current.scope) reasons.push('different-scope');
  if (baseline.crux && current.crux && (urlKey(baseline.crux.target) !== urlKey(current.crux.target) || baseline.crux.scope !== current.crux.scope || baseline.crux.formFactor !== current.crux.formFactor)) reasons.push('different-crux-scope');
  if (windowDays === null) reasons.push('invalid-time-window');
  else if (windowDays > maxWindowDays) reasons.push('window-too-wide');
  const hasComparableSource = (baseline.pageSpeed && current.pageSpeed) || (baseline.crux && current.crux);
  if (!hasComparableSource) reasons.push('missing-comparable-report');
  return { status: reasons.length ? 'blocked' : 'comparable', reasons, windowDays };
};

export const evaluatePageSpeedAlert = (baseline: PageSpeedSnapshot, current: PageSpeedSnapshot, comparison = comparePageSpeedSnapshots(baseline, current), settings = defaultMonitoringAlertSettings()): MonitoringAlert | null => {
  const guard = guardPageSpeedComparison(baseline, current, settings.thresholds.pagespeed.maxWindowDays);
  if (guard.status === 'blocked') return null;
  const categoryRegressions = comparison.categoryDeltas.filter((item) => typeof item.delta === 'number' && item.delta <= -settings.thresholds.pagespeed.categoryDrop);
  const metricRegressions = comparison.metricDeltas.filter((item) => typeof item.delta === 'number' && item.delta >= settings.thresholds.pagespeed.metricIncrease);
  const cruxRegressions = comparison.cruxDeltas.filter((item) => typeof item.delta === 'number' && item.delta >= (item.id === 'cumulative_layout_shift' ? settings.thresholds.pagespeed.categoryDrop : settings.thresholds.pagespeed.metricIncrease));
  if (!categoryRegressions.length && !metricRegressions.length && !cruxRegressions.length) return null;
  return make('pagespeed', current.id, `PageSpeed observed ${categoryRegressions.length} category, ${metricRegressions.length} lab-metric and ${cruxRegressions.length} CrUX regression(s) in a ${guard.windowDays!.toFixed(1)} day comparison window.`, { categories: categoryRegressions.length, metrics: metricRegressions.length, crux: cruxRegressions.length, windowDays: Number(guard.windowDays!.toFixed(1)) });
};

export const evaluateCrawlAlert = (report: CrawlDiffReport, settings = defaultMonitoringAlertSettings()): MonitoringAlert | null => {
  if (report.status === 'blocked') return null;
  const changed = report.added.length + report.changed.length + report.removed.length;
  if (changed < settings.thresholds.crawl.changedPages) return null;
  const sourceId = report.provenance.current.runId;
  return make('crawl', sourceId, `Crawl comparison observed ${changed} changed page observation(s)${report.status === 'partial' ? ' in a partial snapshot' : ''}.`, { changed, partial: report.status === 'partial' }, report.status === 'partial');
};

export const evaluateSemanticAlert = (report: SemanticRunComparisonReport, settings = defaultMonitoringAlertSettings()): MonitoringAlert | null => {
  if (report.truncated || report.guard?.status !== 'comparable') return null;
  const changed = report.changes.length;
  if (changed < settings.thresholds.semantic.changes) return null;
  return make('semantic', report.currentRunId, `Semantic comparison observed ${changed} bounded change(s) between saved crawl runs.`, { changed });
};

export const compareGscForMonitoring = (baseline: GscPerformanceSnapshot, current: GscPerformanceSnapshot, settings?: MonitoringAlertSettings) => evaluateGscAlert(baseline, current, compareGscSnapshots(baseline, current), settings);
export const comparePageSpeedForMonitoring = (baseline: PageSpeedSnapshot, current: PageSpeedSnapshot, settings?: MonitoringAlertSettings) => evaluatePageSpeedAlert(baseline, current, comparePageSpeedSnapshots(baseline, current), settings);

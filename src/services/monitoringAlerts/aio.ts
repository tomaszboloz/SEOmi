import { crawlAioSummary } from '@/services/aioReadiness';
import { guardCrawlComparison } from '@/services/crawlComparisonContract';
import type { CrawlRunRecord } from '@/types';
import { defaultMonitoringAlertSettings } from './policy';
import { evaluateScoreDropAlert } from './scoreDrop';
import type { MonitoringAlert, MonitoringAlertSettings } from './types';

export interface AioMonitoringEvaluation {
  alert: MonitoringAlert | null;
  partial: boolean;
  skipped?: 'no-baseline' | 'incomparable' | 'score-unavailable';
}

const comparable = (baseline: CrawlRunRecord, current: CrawlRunRecord, projectId?: string): boolean =>
  Date.parse(baseline.completedAt) < Date.parse(current.completedAt)
  && (baseline.environment ?? 'default') === (current.environment ?? 'default')
  && guardCrawlComparison(current, baseline, { projectId }).status === 'comparable';

export const previousComparableAioCrawl = (
  current: CrawlRunRecord, runs: CrawlRunRecord[], projectId: string,
): CrawlRunRecord | undefined => runs.filter((run) => comparable(run, current, projectId))
  .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))[0];

export const compareAioForMonitoring = (
  baseline: CrawlRunRecord | undefined, current: CrawlRunRecord,
  settings: MonitoringAlertSettings = defaultMonitoringAlertSettings(), projectId = current.projectId,
): AioMonitoringEvaluation => {
  const after = crawlAioSummary(current);
  const before = baseline && crawlAioSummary(baseline);
  if (!after || (baseline && !before)) return { alert: null, partial: true, skipped: 'score-unavailable' };
  if (!baseline) return { alert: null, partial: false, skipped: 'no-baseline' };
  if (!comparable(baseline, current, projectId)) return { alert: null, partial: true, skipped: 'incomparable' };
  const partial = Boolean(before!.skipped || after.skipped);
  const alert = evaluateScoreDropAlert('aio', before, after, `aio-${current.id}`, settings);
  if (alert) alert.partial = partial;
  return { alert, partial };
};

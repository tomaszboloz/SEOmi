import type { GscPerformanceData } from '@/types';
import { saveGscSnapshot } from '@/services/gscTracker/persistence';
import type { Intervention } from '@/services/experiments/registry';
import { gscData } from './gscTracker';

export const experimentNow = new Date('2026-10-24T12:00:00Z');
export const experimentUrl = 'https://example.com/article';
export const intervention: Intervention = {
  id: 'experiment-1', projectId: 'p1', url: experimentUrl, date: '2026-09-11', kind: 'content',
  note: 'Updated introduction', createdAt: '2026-09-11T12:00:00Z',
};
export const experimentPage = (clicks = 40, impressions = clicks * 10, position = 8, page = experimentUrl) =>
  ({ page, clicks, impressions, position, ctr: impressions ? clicks / impressions : 0 });
export const savedExperimentSnapshot = (start = '2026-09-01', end = '2026-09-10', extra: Partial<GscPerformanceData> = {}) =>
  saveGscSnapshot('p1', gscData({ start_date: start, end_date: end, pages: [experimentPage()], ...extra }),
    undefined, `${end}T12:00:00Z`).snapshot;
export const savedExperimentPair = () => [
  savedExperimentSnapshot(),
  savedExperimentSnapshot('2026-09-11', '2026-09-20', {
    total_clicks: 120, total_impressions: 1200, avg_position: 6, pages: [experimentPage(60, 600, 5)],
  }),
];

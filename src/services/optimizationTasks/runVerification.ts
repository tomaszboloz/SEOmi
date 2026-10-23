import type { CrawlRunRecord } from '@/types';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { appendDeltas } from './metricHistory';
import { readTasks, writeTasks } from './storage';
import type { OptimizationTask } from './types';
import { verifyTasks } from './verify';

/** After a crawl: verifies implemented tasks against fresh pages and records score deltas. */
export const runTaskVerification = (projectId: string, run: CrawlRunRecord): OptimizationTask[] => {
  const tasks = readTasks(projectId);
  if (!tasks.some((task) => task.status === 'implemented')) return tasks;
  const pages = run.result.pages;
  const startUrl = run.result.start_url;
  const sfs = buildSiteFocusReport(pages, startUrl);
  const scores: Record<string, number | null> = { sfs: sfs.unavailable ? null : sfs.score };
  const scoreFor = (task: OptimizationTask): number | null => {
    if (task.module === 'tas' && !('tas' in scores)) scores.tas = buildAuthorityReport(pages, startUrl, sfs).tas;
    return scores[task.module] ?? null;
  };
  const next = verifyTasks(tasks, pages, scoreFor);
  writeTasks(projectId, next);
  appendDeltas(projectId, tasks, next);
  return next;
};

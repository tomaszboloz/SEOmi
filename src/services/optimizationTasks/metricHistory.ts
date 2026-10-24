import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { OptimizationTask } from './types';

export interface MetricDelta { taskId: string; module: OptimizationTask['module']; url: string; delta: number; status: 'verified' | 'failed'; at: string }

export const MAX_METRIC_HISTORY = 500;
export const metricHistoryKey = (projectId: string) => `seomi_project_${projectId}_metric_history_v1`;

export const readMetricHistory = (projectId: string): MetricDelta[] => {
  const raw = readJsonStorage(metricHistoryKey(projectId), []);
  return Array.isArray(raw) ? (raw as MetricDelta[]).filter((row) => row && typeof row.taskId === 'string' && typeof row.delta === 'number') : [];
};

/** Appends the score delta of every newly verified/failed task that measured one. */
export const appendDeltas = (projectId: string, before: OptimizationTask[], after: OptimizationTask[]): MetricDelta[] => {
  const prior = new Map(before.map((task) => [task.id, task.status]));
  const rows: MetricDelta[] = after.flatMap((task) => {
    const verdict = task.verdict;
    if (!verdict || verdict.delta === null || prior.get(task.id) !== 'implemented' || task.status === 'implemented') return [];
    return [{ taskId: task.id, module: task.module, url: task.url, delta: verdict.delta, status: verdict.status, at: task.verifiedAt ?? '' }];
  });
  if (rows.length) writeJsonStorage(metricHistoryKey(projectId), [...readMetricHistory(projectId), ...rows].slice(-MAX_METRIC_HISTORY));
  return rows;
};

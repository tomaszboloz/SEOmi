import type { ScheduledAudit, ScheduledTaskType, ScheduledAuditExecution } from './types';
export const MAX_SCHEDULES_PER_PROJECT = 20;

export const validProjectId = (projectId: string) => /^[a-zA-Z0-9-]{1,80}$/.test(projectId);
export const allowedIntervals = new Set<number>([6, 12, 24, 168]);
export const isHttpUrlWithoutCredentials = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const parseSchedules = (value: unknown): ScheduledAudit[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ScheduledAudit => Boolean(
    item && typeof item.id === 'string' && item.id.length > 0 && isHttpUrlWithoutCredentials(item.url)
      && allowedIntervals.has(item.intervalHours) && typeof item.enabled === 'boolean'
      && ['scheduled', 'running', 'completed', 'failed', 'paused'].includes(item.status)
      && typeof item.createdAt === 'string' && typeof item.nextRunAt === 'string'
      && Number.isFinite(Date.parse(item.nextRunAt))
  )).map((item) => {
    const taskType: ScheduledTaskType = item.taskType === 'site-crawl' ? 'site-crawl' : 'page-audit';
    const crawlLimit = Number.isFinite(item.crawlLimit) ? Math.min(500, Math.max(1, Math.trunc(item.crawlLimit!))) : undefined;
    const runHistory = Array.isArray(item.runHistory)
      ? item.runHistory.filter((entry): entry is ScheduledAuditExecution => Boolean(
        entry && typeof entry.startedAt === 'string' && typeof entry.completedAt === 'string'
          && typeof entry.succeeded === 'boolean' && Number.isFinite(Date.parse(entry.startedAt))
          && Number.isFinite(Date.parse(entry.completedAt)),
      )).slice(-20)
      : [];
    return {
      ...item,
      taskType,
      ...(taskType === 'site-crawl' && crawlLimit ? { crawlLimit } : {}),
      runHistory,
    };
  }).slice(0, MAX_SCHEDULES_PER_PROJECT);
};


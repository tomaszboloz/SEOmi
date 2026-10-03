import i18n from '@/i18n';
import { loadScheduledAudits, saveScheduledAudits } from './persistence';
import type { CrawlConfig } from '@/types';
import { createId } from '@/services/ids';
import type { ScheduledAudit, AuditIntervalHours, ScheduledTaskType } from './types';
import { validProjectId, allowedIntervals, isHttpUrlWithoutCredentials, MAX_SCHEDULES_PER_PROJECT } from './policy';

export const addScheduledAudit = (
  projectId: string,
  value: string,
  intervalHours: AuditIntervalHours,
  now = Date.now(),
  options: {
    taskType?: ScheduledTaskType;
    crawlLimit?: number;
    crawlConfig?: Partial<CrawlConfig>;
  } = {},
): ScheduledAudit => {
  if (!validProjectId(projectId)) throw new Error(i18n.t('runtimeErrors.schedules.projectCreateRequired'));
  if (!allowedIntervals.has(intervalHours)) throw new Error(i18n.t('runtimeErrors.schedules.intervalInvalid'));
  const url = value.trim();
  if (url.length > 2048) throw new Error(i18n.t('runtimeErrors.schedules.urlTooLong'));
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(i18n.t('runtimeErrors.schedules.urlInvalid'));
  }
  if (!isHttpUrlWithoutCredentials(url) || !['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error(i18n.t('runtimeErrors.schedules.urlPublicOnly'));
  }
  const taskType = options.taskType === 'site-crawl' ? 'site-crawl' : 'page-audit';
  const crawlLimit = Math.trunc(options.crawlLimit ?? 25);
  if (taskType === 'site-crawl' && (!Number.isFinite(crawlLimit) || crawlLimit < 1 || crawlLimit > 500)) {
    throw new Error(i18n.t('runtimeErrors.schedules.crawlLimit'));
  }
  const schedules = loadScheduledAudits(projectId);
  if (schedules.length >= MAX_SCHEDULES_PER_PROJECT) throw new Error(i18n.t('runtimeErrors.schedules.maxReached', { count: MAX_SCHEDULES_PER_PROJECT }));
  const normalizedUrl = parsedUrl.toString();
  if (schedules.some((schedule) => schedule.url === normalizedUrl)) throw new Error(i18n.t('runtimeErrors.schedules.duplicate'));
  const createdAt = new Date(now).toISOString();
  const schedule: ScheduledAudit = {
    id: createId('schedule'),
    url: normalizedUrl,
    taskType,
    ...(taskType === 'site-crawl' ? {
      crawlLimit,
      crawlConfig: options.crawlConfig ? JSON.parse(JSON.stringify(options.crawlConfig)) as Partial<CrawlConfig> : undefined,
    } : {}),
    intervalHours,
    enabled: true,
    status: 'scheduled',
    createdAt,
    nextRunAt: new Date(now + intervalHours * 60 * 60 * 1000).toISOString(),
  };
  saveScheduledAudits(projectId, [schedule, ...schedules]);
  return schedule;
};

export const setScheduledAuditEnabled = (projectId: string, id: string, enabled: boolean, now = Date.now()): ScheduledAudit[] => {
  const schedules = loadScheduledAudits(projectId).map((schedule) => schedule.id !== id ? schedule : {
    ...schedule,
    enabled,
    status: enabled ? 'scheduled' as const : 'paused' as const,
    nextRunAt: enabled ? new Date(now + schedule.intervalHours * 60 * 60 * 1000).toISOString() : schedule.nextRunAt,
    lastError: undefined,
  });
  saveScheduledAudits(projectId, schedules);
  return schedules;
};

/**
 * Make one enabled schedule eligible on the next scheduler tick.
 *
 * Keeping this as a state transition (rather than running the audit from the
 * panel) means the same project lock, cancellation path and completion
 * bookkeeping are used for manual and recurring executions.
 */
export const runScheduledAuditNow = (projectId: string, id: string, now = Date.now()): ScheduledAudit[] => {
  const schedules = loadScheduledAudits(projectId).map((schedule) => {
    if (schedule.id !== id || !schedule.enabled || schedule.status === 'running') return schedule;
    return {
      ...schedule,
      status: 'scheduled' as const,
      nextRunAt: new Date(now).toISOString(),
      lastError: undefined,
    };
  });
  saveScheduledAudits(projectId, schedules);
  return schedules;
};

export const removeScheduledAudit = (projectId: string, id: string): ScheduledAudit[] => {
  const schedules = loadScheduledAudits(projectId).filter((schedule) => schedule.id !== id);
  saveScheduledAudits(projectId, schedules);
  return schedules;
};


import type { CrawlConfig } from '@/types';

export type AuditIntervalHours = 6 | 12 | 24 | 168;
export type ScheduledTaskType = 'page-audit' | 'site-crawl';
export type ScheduledAuditStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'paused';

export interface ScheduledAuditExecution {
  startedAt: string;
  completedAt: string;
  succeeded: boolean;
  error?: string;
}

export interface ScheduledExecutionHandoff {
  projectId: string;
  scheduleId: string;
  taskType: ScheduledTaskType | string;
  startedAt: string;
  completedAt: string;
  succeeded: boolean;
  nextRunAt: string;
  error?: string;
  schedulerError?: string;
  result?: unknown;
}

export interface ScheduledAudit {
  id: string;
  url: string;
  /** Missing on older records; those remain single-page audits. */
  taskType?: ScheduledTaskType;
  /** Maximum pages used when taskType is site-crawl. */
  crawlLimit?: number;
  /** Non-secret crawl options captured when the schedule is created. */
  crawlConfig?: Partial<CrawlConfig>;
  intervalHours: AuditIntervalHours;
  enabled: boolean;
  status: ScheduledAuditStatus;
  createdAt: string;
  nextRunAt: string;
  lastStartedAt?: string;
  lastRunAt?: string;
  lastError?: string;
  runHistory?: ScheduledAuditExecution[];
}


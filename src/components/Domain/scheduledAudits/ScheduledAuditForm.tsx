import React, { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import type { AuditIntervalHours, ScheduledTaskType } from '@/services/auditSchedule';
import { intervalOptions } from './scheduledAuditHelpers';

interface ScheduledAuditFormProps {
  url: string;
  setUrl: (url: string) => void;
  taskType: ScheduledTaskType;
  setTaskType: (type: ScheduledTaskType) => void;
  intervalHours: AuditIntervalHours;
  setIntervalHours: (hours: AuditIntervalHours) => void;
  scheduledCrawlLimit: number;
  setScheduledCrawlLimit: (limit: number) => void;
  isTauri: boolean;
  schedulesCount: number;
  onSubmit: (e: FormEvent) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export const ScheduledAuditForm: React.FC<ScheduledAuditFormProps> = ({
  url,
  setUrl,
  taskType,
  setTaskType,
  intervalHours,
  setIntervalHours,
  scheduledCrawlLimit,
  setScheduledCrawlLimit,
  isTauri,
  schedulesCount,
  onSubmit,
  t,
}) => (
  <>
    <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_160px_auto]">
      <label className="sr-only" htmlFor="scheduled-audit-url">{t('schedules.urlLabel')}</label>
      <input
        id="scheduled-audit-url"
        type="url"
        required
        maxLength={2048}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={taskType === 'site-crawl' ? t('schedules.crawlPlaceholder') : t('schedules.pagePlaceholder')}
        disabled={!isTauri}
        className="h-9 min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-emerald-400 disabled:opacity-50"
      />
      <label className="sr-only" htmlFor="scheduled-audit-type">{t('schedules.taskTypeLabel')}</label>
      <select
        id="scheduled-audit-type"
        aria-label={t('schedules.taskTypeLabel')}
        value={taskType}
        onChange={(e) => setTaskType(e.target.value as ScheduledTaskType)}
        disabled={!isTauri}
        className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400 disabled:opacity-50"
      >
        <option value="page-audit">{t('schedules.pageAudit')}</option>
        <option value="site-crawl">{t('schedules.siteCrawl')}</option>
      </select>
      <label className="sr-only" htmlFor="scheduled-audit-interval">{t('schedules.intervalLabel')}</label>
      <select
        id="scheduled-audit-interval"
        value={intervalHours}
        onChange={(e) => setIntervalHours(Number(e.target.value) as AuditIntervalHours)}
        disabled={!isTauri}
        className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400 disabled:opacity-50"
      >
        {intervalOptions.map((opt) => (
          <option key={opt.hours} value={opt.hours}>{t(opt.labelKey)}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!isTauri || schedulesCount >= 20}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        {t('schedules.add')}
      </button>
    </form>
    {taskType === 'site-crawl' && (
      <label className="flex max-w-xs items-center gap-2 text-xs text-slate-400">
        {t('schedules.crawlLimit')}
        <input
          aria-label={t('schedules.crawlLimit')}
          type="number"
          min={1}
          max={500}
          value={scheduledCrawlLimit}
          onChange={(e) => setScheduledCrawlLimit(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
          disabled={!isTauri}
          className="h-9 w-24 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white outline-none focus:border-emerald-400 disabled:opacity-50"
        />
      </label>
    )}
  </>
);

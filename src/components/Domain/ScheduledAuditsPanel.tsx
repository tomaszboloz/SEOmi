import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, Plus } from 'lucide-react';
import {
  addScheduledAudit,
  AUDIT_SCHEDULES_UPDATED_EVENT,
  AuditIntervalHours,
  loadScheduledAudits,
  removeScheduledAudit,
  runScheduledAuditNow,
  ScheduledAudit,
  ScheduledTaskType,
  setScheduledAuditEnabled,
} from '@/services/auditSchedule';
import { isTauriEnvironment } from '@/services/tauri';
import { removeAuditWakeup, syncAuditWakeup } from '@/services/scheduleWakeup';
import type { CrawlConfig } from '@/types';
import { ScheduledAuditRow } from './scheduledAudits/ScheduledAuditRow';
import { intervalOptions } from './scheduledAudits/scheduleFormat';

interface ScheduledAuditsPanelProps {
  projectId: string;
  initialUrl?: string;
  crawlConfig?: CrawlConfig;
  crawlLimit?: number;
}

export const ScheduledAuditsPanel: React.FC<ScheduledAuditsPanelProps> = ({ projectId, initialUrl = '', crawlConfig, crawlLimit = 25 }) => {
  const { t, i18n } = useTranslation();
  const translate = (key: string, options?: Record<string, unknown>): string => t(key, options);
  const [url, setUrl] = useState(initialUrl);
  const [intervalHours, setIntervalHours] = useState<AuditIntervalHours>(24);
  const [taskType, setTaskType] = useState<ScheduledTaskType>('page-audit');
  const [scheduledCrawlLimit, setScheduledCrawlLimit] = useState(crawlLimit);
  const [schedules, setSchedules] = useState<ScheduledAudit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [schedulerError, setSchedulerError] = useState<string | null>(null);
  const projectIdRef = useRef(projectId);

  useEffect(() => {
    projectIdRef.current = projectId;
    setSchedules(loadScheduledAudits(projectId));
    setUrl(initialUrl);
    setScheduledCrawlLimit(crawlLimit);
    setError(null);
    setSchedulerError(null);
  }, [projectId, initialUrl, crawlLimit]);

  useEffect(() => {
    const handleUpdated = (event: Event) => {
      if ((event as CustomEvent<{ projectId?: string }>).detail?.projectId === projectId) {
        setSchedules(loadScheduledAudits(projectId));
      }
    };
    window.addEventListener(AUDIT_SCHEDULES_UPDATED_EVENT, handleUpdated);
    return () => window.removeEventListener(AUDIT_SCHEDULES_UPDATED_EVENT, handleUpdated);
  }, [projectId]);

  const refresh = () => setSchedules(loadScheduledAudits(projectId));

  const syncWakeup = (schedule?: ScheduledAudit): void => {
    if (!isTauriEnvironment()) return;
    void syncAuditWakeup(projectId, schedule)
      .then(() => {
        if (projectIdRef.current === projectId) setSchedulerError(null);
      })
      .catch((cause) => {
        if (projectIdRef.current === projectId) setSchedulerError(cause instanceof Error ? cause.message : translate('schedules.schedulerError', { error: String(cause) }));
      });
  };

  const removeWakeup = (scheduleId: string): void => {
    if (!isTauriEnvironment()) return;
    void removeAuditWakeup(projectId, scheduleId)
      .then(() => {
        if (projectIdRef.current === projectId) setSchedulerError(null);
      })
      .catch((cause) => {
        if (projectIdRef.current === projectId) setSchedulerError(cause instanceof Error ? cause.message : translate('schedules.schedulerError', { error: String(cause) }));
      });
  };

  const addSchedule = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      addScheduledAudit(projectId, url, intervalHours, Date.now(), {
        taskType,
        crawlLimit: scheduledCrawlLimit,
        crawlConfig: taskType === 'site-crawl' ? crawlConfig : undefined,
      });
      refresh();
      const created = loadScheduledAudits(projectId)[0];
      syncWakeup(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate('schedules.saveError'));
    }
  };

  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900/45">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400">
        <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-300" />{translate('schedules.title')}</span>
        <span className="text-[11px] font-normal text-slate-500">{translate('schedules.activeCount', { active: schedules.filter((schedule) => schedule.enabled).length, total: schedules.length })}</span>
      </summary>
      <div className="space-y-4 border-t border-slate-800 p-4">
        <p className="text-xs leading-5 text-slate-400">{translate('schedules.description')}</p>
        {!isTauriEnvironment() && <p role="status" className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-100">{translate('schedules.desktopOnly')}</p>}
        {schedulerError && <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs text-rose-200">{translate('schedules.schedulerError', { error: schedulerError })}</p>}
        <form onSubmit={addSchedule} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_160px_auto]">
          <label className="sr-only" htmlFor="scheduled-audit-url">{translate('schedules.urlLabel')}</label>
          <input id="scheduled-audit-url" type="url" required maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} placeholder={taskType === 'site-crawl' ? translate('schedules.crawlPlaceholder') : translate('schedules.pagePlaceholder')} disabled={!isTauriEnvironment()} className="h-9 min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-emerald-400 disabled:opacity-50" />
          <label className="sr-only" htmlFor="scheduled-audit-type">{translate('schedules.taskTypeLabel')}</label>
          <select id="scheduled-audit-type" aria-label={translate('schedules.taskTypeLabel')} value={taskType} onChange={(event) => setTaskType(event.target.value as ScheduledTaskType)} disabled={!isTauriEnvironment()} className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400 disabled:opacity-50">
            <option value="page-audit">{translate('schedules.pageAudit')}</option>
            <option value="site-crawl">{translate('schedules.siteCrawl')}</option>
          </select>
          <label className="sr-only" htmlFor="scheduled-audit-interval">{translate('schedules.intervalLabel')}</label>
          <select id="scheduled-audit-interval" value={intervalHours} onChange={(event) => setIntervalHours(Number(event.target.value) as AuditIntervalHours)} disabled={!isTauriEnvironment()} className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400 disabled:opacity-50">
            {intervalOptions.map((option) => <option key={option.hours} value={option.hours}>{translate(option.labelKey)}</option>)}
          </select>
          <button type="submit" disabled={!isTauriEnvironment() || schedules.length >= 20} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-3.5 w-3.5" />{translate('schedules.add')}</button>
        </form>
        {taskType === 'site-crawl' && <label className="flex max-w-xs items-center gap-2 text-xs text-slate-400">{translate('schedules.crawlLimit')}<input aria-label={translate('schedules.crawlLimit')} type="number" min={1} max={500} value={scheduledCrawlLimit} onChange={(event) => setScheduledCrawlLimit(Math.min(500, Math.max(1, Number(event.target.value) || 1)))} disabled={!isTauriEnvironment()} className="h-9 w-24 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white outline-none focus:border-emerald-400 disabled:opacity-50" /></label>}
        {error && <p role="alert" className="text-xs text-rose-300">{error || translate('schedules.error')}</p>}
        {schedules.length ? <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
          {schedules.map((schedule) => <ScheduledAuditRow key={schedule.id} schedule={schedule} language={i18n.language || 'pl'} translate={translate}
            onRunNow={() => { const updated = runScheduledAuditNow(projectId, schedule.id); refresh(); const next = updated.find((item) => item.id === schedule.id); syncWakeup(next); }}
            onToggle={() => { const updated = setScheduledAuditEnabled(projectId, schedule.id, !schedule.enabled); refresh(); const next = updated.find((item) => item.id === schedule.id); syncWakeup(next); }}
            onRemove={() => { removeScheduledAudit(projectId, schedule.id); refresh(); removeWakeup(schedule.id); }} />)}
        </ul> : <p className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">{translate('schedules.empty')}</p>}
      </div>
    </details>
  );
};

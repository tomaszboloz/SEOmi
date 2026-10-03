import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3 } from 'lucide-react';
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
import { ScheduledAuditForm } from './scheduledAudits/ScheduledAuditForm';
import { ScheduledAuditsList } from './scheduledAudits/ScheduledAuditsList';

interface ScheduledAuditsPanelProps {
  projectId: string;
  initialUrl?: string;
  crawlConfig?: CrawlConfig;
  crawlLimit?: number;
}

export const ScheduledAuditsPanel: React.FC<ScheduledAuditsPanelProps> = ({
  projectId,
  initialUrl = '',
  crawlConfig,
  crawlLimit = 25,
}) => {
  const { t, i18n } = useTranslation();
  const [url, setUrl] = useState(initialUrl);
  const [intervalHours, setIntervalHours] = useState<AuditIntervalHours>(24);
  const [taskType, setTaskType] = useState<ScheduledTaskType>('page-audit');
  const [scheduledCrawlLimit, setScheduledCrawlLimit] = useState(crawlLimit);
  const [schedules, setSchedules] = useState<ScheduledAudit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [schedulerError, setSchedulerError] = useState<string | null>(null);
  const projectIdRef = useRef(projectId);
  const isTauri = isTauriEnvironment();

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
    if (!isTauri) return;
    void syncAuditWakeup(projectId, schedule)
      .then(() => { if (projectIdRef.current === projectId) setSchedulerError(null); })
      .catch((cause) => {
        if (projectIdRef.current === projectId) {
          setSchedulerError(cause instanceof Error ? cause.message : t('schedules.schedulerError', { error: String(cause) }));
        }
      });
  };

  const removeWakeup = (scheduleId: string): void => {
    if (!isTauri) return;
    void removeAuditWakeup(projectId, scheduleId)
      .then(() => { if (projectIdRef.current === projectId) setSchedulerError(null); })
      .catch((cause) => {
        if (projectIdRef.current === projectId) {
          setSchedulerError(cause instanceof Error ? cause.message : t('schedules.schedulerError', { error: String(cause) }));
        }
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
      setError(cause instanceof Error ? cause.message : t('schedules.saveError'));
    }
  };

  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900/45">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400">
        <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-300" />{t('schedules.title')}</span>
        <span className="text-[11px] font-normal text-slate-500">{t('schedules.activeCount', { active: schedules.filter((s) => s.enabled).length, total: schedules.length })}</span>
      </summary>
      <div className="space-y-4 border-t border-slate-800 p-4">
        <p className="text-xs leading-5 text-slate-400">{t('schedules.description')}</p>
        {!isTauri && <p role="status" className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-100">{t('schedules.desktopOnly')}</p>}
        {schedulerError && <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs text-rose-200">{t('schedules.schedulerError', { error: schedulerError })}</p>}
        <ScheduledAuditForm
          url={url}
          setUrl={setUrl}
          taskType={taskType}
          setTaskType={setTaskType}
          intervalHours={intervalHours}
          setIntervalHours={setIntervalHours}
          scheduledCrawlLimit={scheduledCrawlLimit}
          setScheduledCrawlLimit={setScheduledCrawlLimit}
          isTauri={isTauri}
          schedulesCount={schedules.length}
          onSubmit={addSchedule}
          t={t}
        />
        {error && <p role="alert" className="text-xs text-rose-300">{error || t('schedules.error')}</p>}
        <ScheduledAuditsList
          schedules={schedules}
          language={i18n.language || 'pl'}
          onRunNow={(id) => { const updated = runScheduledAuditNow(projectId, id); refresh(); syncWakeup(updated.find((item) => item.id === id)); }}
          onToggleEnabled={(id, currentEnabled) => { const updated = setScheduledAuditEnabled(projectId, id, !currentEnabled); refresh(); syncWakeup(updated.find((item) => item.id === id)); }}
          onRemove={(id) => { removeScheduledAudit(projectId, id); refresh(); removeWakeup(id); }}
          t={t}
        />
      </div>
    </details>
  );
};

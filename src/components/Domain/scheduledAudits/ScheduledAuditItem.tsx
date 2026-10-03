import React from 'react';
import { Clock3, Layers, Pause, Play, Trash2 } from 'lucide-react';
import type { ScheduledAudit } from '@/services/auditSchedule';
import { intervalOptions, localDate } from './scheduledAuditHelpers';

interface ScheduledAuditItemProps {
  schedule: ScheduledAudit;
  language: string;
  onRunNow: (id: string) => void;
  onToggleEnabled: (id: string, currentEnabled: boolean) => void;
  onRemove: (id: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export const ScheduledAuditItem: React.FC<ScheduledAuditItemProps> = ({
  schedule,
  language,
  onRunNow,
  onToggleEnabled,
  onRemove,
  t,
}) => (
  <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 truncate font-mono text-xs text-slate-200" title={schedule.url}>
        {schedule.taskType === 'site-crawl' ? (
          <Layers className="h-3.5 w-3.5 shrink-0 text-sky-300" />
        ) : (
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
        )}
        {schedule.url}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        {schedule.taskType === 'site-crawl'
          ? t('schedules.multiPage', { count: schedule.crawlLimit ?? 25 })
          : t('schedules.pageAuditShort')}{' '}
        · {t(intervalOptions.find((opt) => opt.hours === schedule.intervalHours)?.labelKey || 'schedules.daily')}{' '}
        · {schedule.enabled ? t('schedules.next', { date: localDate(schedule.nextRunAt, language) }) : t('schedules.paused')}
        {schedule.lastRunAt ? ` · ${t('schedules.last', { date: localDate(schedule.lastRunAt, language) })}` : ''}
        {schedule.status === 'running' ? ` · ${t('schedules.running')}` : ''}
      </p>
      {schedule.lastError && (
        <p className="mt-1 break-words text-[11px] text-rose-300">{schedule.lastError}</p>
      )}
      {schedule.runHistory?.length ? (
        <details className="mt-1 text-[11px] text-slate-500">
          <summary className="cursor-pointer">{t('schedules.history', { count: schedule.runHistory.length })}</summary>
          <ul className="mt-1 space-y-0.5 pl-3">
            {schedule.runHistory.slice(-5).reverse().map((entry) => (
              <li
                key={`${entry.startedAt}-${entry.completedAt}`}
                className={entry.succeeded ? 'text-emerald-300' : 'text-rose-300'}
              >
                {entry.succeeded ? t('schedules.success') : t('schedules.failure')} · {localDate(entry.completedAt, language)}
                {entry.error ? ` · ${entry.error}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
    <div className="flex shrink-0 gap-1.5">
      <button
        type="button"
        aria-label={t('schedules.runNowAria')}
        disabled={!schedule.enabled || schedule.status === 'running'}
        onClick={() => onRunNow(schedule.id)}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 px-2 text-[11px] text-slate-300 hover:border-emerald-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="h-3 w-3" />
        {t('schedules.runNow')}
      </button>
      <button
        type="button"
        aria-label={schedule.enabled ? t('schedules.pauseAria') : t('schedules.resumeAria')}
        onClick={() => onToggleEnabled(schedule.id, schedule.enabled)}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 px-2 text-[11px] text-slate-300 hover:border-emerald-400/50 hover:text-white"
      >
        {schedule.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {schedule.enabled ? t('schedules.pause') : t('schedules.resume')}
      </button>
      <button
        type="button"
        aria-label={t('schedules.removeAria')}
        onClick={() => onRemove(schedule.id)}
        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-700 px-2 text-slate-400 hover:border-rose-400/50 hover:text-rose-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  </li>
);

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Square, X } from 'lucide-react';
import { useAuditStore } from '@/stores/auditStore';

export const BatchAuditQueue: React.FC = () => {
  const { t } = useTranslation();
  const batchItems = useAuditStore((s) => s.batchItems);
  const batchRejectedRows = useAuditStore((s) => s.batchRejectedRows);
  const batchRun = useAuditStore((s) => s.batchRun);
  const isBatchRunning = useAuditStore((s) => s.isBatchRunning);
  const isBatchStopping = useAuditStore((s) => s.isBatchStopping);
  const batchWakeupError = useAuditStore((s) => s.batchWakeupError);
  const startBatchAudits = useAuditStore((s) => s.startBatchAudits);
  const stopBatchAudits = useAuditStore((s) => s.stopBatchAudits);
  const clearBatchAudits = useAuditStore((s) => s.clearBatchAudits);
  if (!batchItems.length) return null;

  const completedCount = batchItems.filter((item) => item.status === 'completed').length;
  const failedCount = batchItems.filter((item) => item.status === 'failed').length;
  const interruptedCount = batchItems.filter((item) => item.status === 'interrupted').length;
  const pendingCount = batchItems.filter((item) => item.status === 'queued' || item.status === 'running' || item.status === 'interrupted').length;
  const runLabel = batchRun?.status === 'interrupted'
    ? t('legacyUi.url.runInterrupted')
    : batchRun?.status === 'stopped'
      ? t('legacyUi.url.runStopped')
      : batchRun?.status === 'completed'
        ? t('legacyUi.url.runCompleted')
        : batchRun?.status === 'running'
          ? t('legacyUi.url.runRunning')
          : null;

  return (
    <section className="mx-auto mt-3 flex max-w-6xl flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" aria-label={t('legacyUi.url.queueAria')}>
      <div className="min-w-0 text-xs text-slate-300"><span className="font-semibold text-white">{t('legacyUi.url.csv')}:</span> {t('legacyUi.url.queue', { completed: completedCount, pending: pendingCount, failed: failedCount, interrupted: interruptedCount ? t('legacyUi.url.interrupted', { count: interruptedCount }) : '', rejected: batchRejectedRows.length ? t('legacyUi.url.rejected', { count: batchRejectedRows.length }) : '' })} {runLabel && <span className="ml-1 text-slate-400">({runLabel}{batchRun?.updatedAt ? ` · ${new Date(batchRun.updatedAt).toLocaleString()}` : ''})</span>} {isBatchStopping && t('legacyUi.url.cancelling')}</div>
      <div className="flex shrink-0 items-center gap-2">
        {isBatchRunning ? <button type="button" onClick={stopBatchAudits} disabled={isBatchStopping} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-200 disabled:opacity-50"><Square className="h-3 w-3" />{t('legacyUi.url.stop')}</button> : <button type="button" onClick={() => void startBatchAudits()} disabled={!pendingCount && !failedCount} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-slate-950 disabled:opacity-50"><Play className="h-3 w-3" />{completedCount || interruptedCount || failedCount ? t('legacyUi.url.resume') : t('legacyUi.url.run')}</button>}
        <button type="button" onClick={clearBatchAudits} disabled={isBatchRunning} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50" title={t('legacyUi.url.clearQueue')}><X className="h-3.5 w-3.5" /></button>
      </div>
      {batchWakeupError && <p role="alert" className="basis-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{batchWakeupError}</p>}
    </section>
  );
};

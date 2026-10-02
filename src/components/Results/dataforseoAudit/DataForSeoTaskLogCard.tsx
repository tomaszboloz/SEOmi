import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import { clearDataForSeoTaskLog, readDataForSeoTaskLog, type DataForSeoTaskRecord } from '@/services/dataforseo';

export const DataForSeoTaskLogCard: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [taskLog, setTaskLog] = useState<DataForSeoTaskRecord[]>([]);
  const [showTaskLog, setShowTaskLog] = useState(false);

  useEffect(() => {
    const refreshTaskLog = () => setTaskLog(readDataForSeoTaskLog(activeProjectId));
    refreshTaskLog();
    window.addEventListener('seomi:dataforseo-task', refreshTaskLog);
    return () => window.removeEventListener('seomi:dataforseo-task', refreshTaskLog);
  }, [activeProjectId]);

  const clearTaskHistory = () => {
    clearDataForSeoTaskLog(activeProjectId);
    setTaskLog([]);
  };

  const formatTaskTime = (value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  const taskStatusLabel = (task: DataForSeoTaskRecord): string => {
    if (task.ok) return t('dataforseo.statusOk');
    if (task.statusCode === null) return t('dataforseo.statusMissing');
    return t('dataforseo.statusError');
  };

  return (
    <section aria-label={t('dataforseo.requestStatus')} className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">{t('dataforseo.taskState')}</h4>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{t('dataforseo.taskDescription')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-mono text-slate-400">{taskLog.length} / 100</span>
          {taskLog.length > 0 && <button type="button" onClick={clearTaskHistory} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 transition hover:border-rose-400/50 hover:text-rose-200">{t('dataforseo.clearHistory')}</button>}
        </div>
      </div>
      {taskLog.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">{t('dataforseo.noRequests')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">{t('dataforseo.status')}</th><th className="px-3 py-2">{t('dataforseo.endpoint')}</th><th className="px-3 py-2">{t('dataforseo.taskId')}</th><th className="px-3 py-2">{t('dataforseo.cost')}</th><th className="px-3 py-2">{t('dataforseo.time')}</th><th className="px-3 py-2">{t('dataforseo.completed')}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {(showTaskLog ? taskLog : taskLog.slice(0, 5)).map((task) => (
                <tr key={`${task.completedAt}-${task.endpoint}-${task.taskId || 'request'}`} className="text-slate-300">
                  <td className={`px-3 py-2 font-semibold ${task.ok ? 'text-emerald-300' : 'text-rose-300'}`} title={task.statusMessage || undefined}>{taskStatusLabel(task)}{task.statusCode !== null ? ` · ${task.statusCode}` : ''}</td>
                  <td className="max-w-[250px] truncate px-3 py-2 font-mono text-slate-400" title={task.endpoint}>{task.endpoint.replace(/^\/v3\//, '')}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{task.taskId || '—'}</td>
                  <td className="px-3 py-2 text-slate-400">{task.cost === null ? t('dataforseo.notInResponse') : `$${task.cost.toFixed(4)}`}</td>
                  <td className="px-3 py-2 text-slate-400">{task.timeSeconds === null ? '—' : `${task.timeSeconds.toFixed(3)} s`}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatTaskTime(task.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {taskLog.length > 5 && <button type="button" onClick={() => setShowTaskLog((value) => !value)} className="w-full border-t border-slate-800 px-3 py-2 text-left text-[11px] font-medium text-emerald-300 transition hover:bg-slate-900/80">{showTaskLog ? t('dataforseo.showRecent') : t('dataforseo.showAll', { count: taskLog.length })}</button>}
        </div>
      )}
    </section>
  );
};

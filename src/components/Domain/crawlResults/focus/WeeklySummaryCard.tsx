import { useTranslation } from 'react-i18next';
import type { WeeklyReport } from '@/services/siteFocusMonitoring';
import { codeTitle, formatPct } from './focusText';

/** Weekly digest: score, change since the previous analysis and the three best gain-per-effort tasks. */
export const WeeklySummaryCard = ({ weekly }: { weekly: WeeklyReport }) => {
  const { t } = useTranslation();
  const delta = weekly.delta === null ? t('focus.weekly.noPrevious') : `${weekly.delta > 0 ? '+' : ''}${weekly.delta}`;
  return (
    <section aria-labelledby="focus-weekly-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="focus-weekly-title" className="text-sm font-semibold text-slate-200">{t('focus.weekly.title')}</h2>
      <p className="text-xs text-slate-300">{t('focus.weekly.summary', { score: weekly.score, delta })}</p>
      {weekly.tasks.length === 0 ? <p className="text-xs text-slate-500">{t('focus.weekly.noTasks')}</p> : (
        <ol className="list-decimal space-y-1 ps-5 text-xs text-slate-300">
          {weekly.tasks.map((task) => (
            <li key={task.code}>
              {codeTitle(t, 'recommendation', task.code, task.params)}
              <span className="text-emerald-300"> {t('focus.weekly.gain', { value: formatPct(task.deltaScore) })}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

import { useTranslation } from 'react-i18next';
import type { TaskFilter } from '@/services/optimizationTasks/edit';

const FILTERS: TaskFilter[] = ['all', 'mine', 'overdue'];

/** Filters: all tasks, my tasks (by owner name), overdue by SLA. */
export const TaskFilterBar = ({ filter, me, onFilter, onMe }: { filter: TaskFilter; me: string; onFilter: (value: TaskFilter) => void; onMe: (value: string) => void }) => {
  const { t } = useTranslation();
  return <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
    {FILTERS.map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => onFilter(value)}
      className={`rounded border px-2 py-1 ${filter === value ? 'border-emerald-400 text-emerald-200' : 'border-slate-700 text-slate-300'}`}>{t(`executionCard.tasks.filter.${value}`)}</button>)}
    {filter === 'mine' && <input aria-label={t('executionCard.tasks.me')} placeholder={t('executionCard.tasks.me')} value={me} onChange={(event) => onMe(event.target.value)} className="h-7 w-28 rounded border border-slate-700 bg-slate-950 px-1.5 text-slate-200" />}
  </div>;
};

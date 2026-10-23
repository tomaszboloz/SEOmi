import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { CrawledPageSummary } from '@/types';
import { markImplemented, planTask, readTasks, writeTasks, type NewTask } from '@/services/optimizationTasks/storage';
import type { OptimizationTask } from '@/services/optimizationTasks/types';
import { verifyTasks } from '@/services/optimizationTasks/verify';
import { editTask, filterTasks, type TaskFilter } from '@/services/optimizationTasks/edit';
import { appendDeltas } from '@/services/optimizationTasks/metricHistory';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskMetaEditor } from './TaskMetaEditor';

const btn = 'rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-emerald-400';

/** Card action: adds a planned task with the module's current score as baseline. */
export const AddTaskButton = ({ projectId, task, onAdded }: { projectId: string; task: NewTask; onAdded?: () => void }) => {
  const { t } = useTranslation();
  const [added, setAdded] = useState(false);
  const add = () => { setAdded(writeTasks(projectId, planTask(readTasks(projectId), task))); onAdded?.(); };
  return <span className="inline-flex items-center gap-1"><button type="button" className={btn} onClick={add}>{t('executionCard.tasks.add')}</button><HelpTip id="executionCard.tasks" />{added && <span role="status" className="text-[10px] text-slate-400">{t('executionCard.tasks.added')}</span>}</span>;
};

interface Props { projectId: string; pages: CrawledPageSummary[]; scoreFor: (task: OptimizationTask) => number | null; }

export const OptimizationTaskTracker = ({ projectId, pages, scoreFor }: Props) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState(() => readTasks(projectId));
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [me, setMe] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const save = (next: OptimizationTask[]) => { setTasks(next); writeTasks(projectId, next); };
  const verify = () => { const next = verifyTasks(tasks, pages, scoreFor); appendDeltas(projectId, tasks, next); save(next); };
  if (!tasks.length) return <p className="rounded-md border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">{t('executionCard.tasks.empty')}</p>;
  return <section aria-label={t('executionCard.tasks.aria')} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
    <header className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold text-slate-100">{t('executionCard.tasks.title')} <HelpTip id="executionCard.tasks" /></h4>
      <button type="button" className={btn} onClick={() => verify()}>{t('executionCard.tasks.verify')}</button></header>
    <TaskFilterBar filter={filter} me={me} onFilter={setFilter} onMe={setMe} />
    <ul className="mt-3 space-y-2">{filterTasks(tasks, filter, me, today).map((task) => <li key={task.id} className="rounded-md border border-slate-800 p-2 text-[11px] text-slate-300">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="truncate font-mono" title={task.url}>{t(`executionCard.tasks.kind.${task.kind}`)}: {task.url}</span>
        <span className="text-[10px] uppercase text-slate-500">{t(`executionCard.tasks.status.${task.status}`)}</span></div>
      <TaskMetaEditor task={task} today={today} onEdit={(edit) => save(editTask(tasks, task.id, edit))} />
      {task.status === 'planned' && <button type="button" className={`${btn} mt-2`} onClick={() => save(markImplemented(tasks, task.id))}>{t('executionCard.tasks.markImplemented')}</button>}
      {task.verdict && <p role={task.verdict.regression ? 'alert' : 'status'} className={`mt-2 text-[10px] ${task.verdict.status === 'verified' ? 'text-emerald-300' : 'text-rose-300'}`}>
        {t(`executionCard.tasks.verdict.${task.verdict.code}`, task.verdict.params)}{task.verdict.delta !== null ? ` (${task.verdict.delta > 0 ? '+' : ''}${task.verdict.delta})` : ''}
        {task.verdict.regression && ` — ${t('executionCard.tasks.regression')}`}</p>}
    </li>)}</ul>
  </section>;
};

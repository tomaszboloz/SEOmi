import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { TaskEdit } from '@/services/optimizationTasks/edit';
import type { OptimizationTask, TaskPriority } from '@/services/optimizationTasks/types';

const field = 'h-7 rounded border border-slate-700 bg-slate-950 px-1.5 text-[10px] text-slate-200';
const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];

/** Owner, priority and SLA date of one task (#134). */
export const TaskMetaEditor = ({ task, today, onEdit }: { task: OptimizationTask; today: string; onEdit: (edit: TaskEdit) => void }) => {
  const { t } = useTranslation();
  const overdue = Boolean(task.dueDate && task.dueDate < today && (task.status === 'planned' || task.status === 'implemented'));
  return <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
    <label className="flex items-center gap-1">{t('executionCard.tasks.owner')}
      <input className={`${field} w-28`} defaultValue={task.owner ?? ''} onBlur={(event) => onEdit({ owner: event.target.value })} />
    </label>
    <label className="flex items-center gap-1">{t('executionCard.tasks.priority')}
      <select className={field} value={task.priority} onChange={(event) => onEdit({ priority: event.target.value as TaskPriority })}>
        {PRIORITIES.map((value) => <option key={value} value={value}>{t(`executionCard.tasks.priorityLevel.${value}`)}</option>)}
      </select>
    </label>
    <label className="flex items-center gap-1">{t('executionCard.tasks.dueDate')}
      <input type="date" className={field} value={task.dueDate ?? ''} onChange={(event) => onEdit({ dueDate: event.target.value })} />
    </label>
    <HelpTip id="executionCard.sla" />
    {overdue && <span role="status" className="font-semibold text-rose-300">{t('executionCard.tasks.overdue')}</span>}
  </div>;
};

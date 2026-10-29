import type { OptimizationTask, TaskPriority } from './types';

export type TaskEdit = Partial<Pick<OptimizationTask, 'owner' | 'priority' | 'dueDate'>> & { expectedDelta?: number | null };
/** Module scores are 0-100, so a larger expected change is a typo. */
const MAX_EXPECTED = 100;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];

/** Applies owner / priority / SLA date / expected-effect edits; invalid values are ignored, empty clears owner, date and estimate. */
export const editTask = (tasks: OptimizationTask[], id: string, edit: TaskEdit): OptimizationTask[] =>
  tasks.map((task) => {
    if (task.id !== id) return task;
    const next = { ...task };
    if (edit.owner !== undefined) { const owner = edit.owner.trim().slice(0, 80); if (owner) next.owner = owner; else delete next.owner; }
    if (edit.priority !== undefined && PRIORITIES.includes(edit.priority)) next.priority = edit.priority;
    if (edit.dueDate !== undefined) { if (!edit.dueDate) delete next.dueDate; else if (DATE.test(edit.dueDate)) next.dueDate = edit.dueDate; }
    if (edit.expectedDelta === null) delete next.expectedDelta;
    else if (edit.expectedDelta !== undefined && Number.isFinite(edit.expectedDelta) && Math.abs(edit.expectedDelta) <= MAX_EXPECTED) {
      next.expectedDelta = Math.round(edit.expectedDelta * 10) / 10;
    }
    return next;
  });

export type TaskFilter = 'all' | 'mine' | 'overdue';

export const filterTasks = (tasks: OptimizationTask[], filter: TaskFilter, me: string, today: string): OptimizationTask[] => {
  if (filter === 'mine') return tasks.filter((task) => me.trim() !== '' && task.owner?.toLocaleLowerCase() === me.trim().toLocaleLowerCase());
  if (filter === 'overdue') return tasks.filter((task) => task.dueDate !== undefined && task.dueDate < today && (task.status === 'planned' || task.status === 'implemented'));
  return tasks;
};

import { createId } from '@/services/ids';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { OptimizationTask, TaskKind, TaskModule, TaskPriority, TaskStatus } from './types';

export const MAX_TASKS = 500;
const KINDS: TaskKind[] = ['add-link', 'redirect-301', 'remove-410', 'add-entities', 'remove-noindex'];
const MODULES: TaskModule[] = ['sfs', 'tas', 'sprs', 'eetv'];
const STATUSES: TaskStatus[] = ['planned', 'implemented', 'verified', 'failed'];
const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];

export const tasksKey = (projectId: string) => `seomi_project_${projectId}_optimization_tasks_v1`;

const isTask = (value: unknown): value is OptimizationTask => {
  const t = value as Partial<OptimizationTask> | null;
  return Boolean(t) && typeof t === 'object' && typeof t!.id === 'string' && typeof t!.url === 'string' && typeof t!.createdAt === 'string'
    && KINDS.includes(t!.kind as TaskKind) && MODULES.includes(t!.module as TaskModule) && STATUSES.includes(t!.status as TaskStatus)
    && PRIORITIES.includes(t!.priority as TaskPriority) && (t!.baselineScore === null || typeof t!.baselineScore === 'number');
};

export const readTasks = (projectId: string): OptimizationTask[] => {
  const raw = readJsonStorage(tasksKey(projectId), []);
  return Array.isArray(raw) ? raw.filter(isTask).slice(-MAX_TASKS) : [];
};

export const writeTasks = (projectId: string, tasks: OptimizationTask[]): boolean => writeJsonStorage(tasksKey(projectId), tasks.slice(-MAX_TASKS));

export type NewTask = Pick<OptimizationTask, 'kind' | 'module' | 'url' | 'baselineScore'> & Partial<Pick<OptimizationTask, 'targetUrl' | 'requiredEntities' | 'owner' | 'priority' | 'dueDate'>>;

/** Adds a planned task; an identical open task (same kind, URL and target) is not duplicated. */
export const planTask = (tasks: OptimizationTask[], input: NewTask, now = new Date().toISOString()): OptimizationTask[] => {
  const open = (t: OptimizationTask) => t.kind === input.kind && t.url === input.url && t.targetUrl === input.targetUrl && (t.status === 'planned' || t.status === 'implemented');
  if (tasks.some(open)) return tasks;
  const created: OptimizationTask = { priority: 'medium', ...input, id: createId('task'), status: 'planned', createdAt: now };
  return [...tasks, created].slice(-MAX_TASKS);
};

export const markImplemented = (tasks: OptimizationTask[], id: string, now = new Date().toISOString()): OptimizationTask[] =>
  tasks.map((t) => (t.id === id && t.status === 'planned' ? { ...t, status: 'implemented', implementedAt: now } : t));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markImplemented, planTask, readTasks, tasksKey, writeTasks } from '@/services/optimizationTasks/storage';
import type { NewTask } from '@/services/optimizationTasks/storage';
import type { OptimizationTask } from '@/services/optimizationTasks/types';

const baseTask = (id: string, patch: Partial<OptimizationTask> = {}): OptimizationTask => ({
  id,
  kind: 'add-link',
  module: 'sfs',
  status: 'planned',
  url: 'https://example.test/source',
  baselineScore: 60,
  priority: 'medium',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('geminiEasy04: storage project separation and planning', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps tasks strictly separated across multiple projects', () => {
    const keyA = tasksKey('proj-a');
    const keyB = tasksKey('proj-b');
    expect(keyA).not.toBe(keyB);
    expect(keyA).toBe('seomi_project_proj-a_optimization_tasks_v1');
    expect(keyB).toBe('seomi_project_proj-b_optimization_tasks_v1');

    const tasksA = [baseTask('task-a', { url: 'https://a.test/' })];
    const tasksB = [baseTask('task-b', { url: 'https://b.test/' })];

    expect(writeTasks('proj-a', tasksA)).toBe(true);
    expect(readTasks('proj-b')).toEqual([]);
    expect(readTasks('proj-a')).toEqual(tasksA);

    expect(writeTasks('proj-b', tasksB)).toBe(true);
    expect(readTasks('proj-a')).toEqual(tasksA);
    expect(readTasks('proj-b')).toEqual(tasksB);
  });

  it('prevents duplicates for open tasks (planned or implemented) but permits re-planning resolved tasks', () => {
    const input: NewTask = { kind: 'redirect-301', module: 'sprs', url: 'https://site.test/old', targetUrl: 'https://site.test/new', baselineScore: 40 };

    const plannedList = [baseTask('1', { ...input, status: 'planned' })];
    expect(planTask(plannedList, input)).toBe(plannedList);

    const implementedList = [baseTask('2', { ...input, status: 'implemented' })];
    expect(planTask(implementedList, input)).toBe(implementedList);

    const verifiedList = [baseTask('3', { ...input, status: 'verified' })];
    const afterVerified = planTask(verifiedList, input, '2026-02-01T00:00:00.000Z');
    expect(afterVerified).toHaveLength(2);
    expect(afterVerified[1]).toMatchObject({ ...input, status: 'planned', priority: 'medium', createdAt: '2026-02-01T00:00:00.000Z' });

    const failedList = [baseTask('4', { ...input, status: 'failed' })];
    const afterFailed = planTask(failedList, input);
    expect(afterFailed).toHaveLength(2);
  });

  it('handles targetUrl differentiation and undefined targets in duplicate detection', () => {
    const noTargetInput: NewTask = { kind: 'remove-410', module: 'tas', url: 'https://site.test/dead', baselineScore: null };
    const withNoTarget = planTask([], noTargetInput);
    expect(withNoTarget).toHaveLength(1);
    expect(planTask(withNoTarget, noTargetInput)).toBe(withNoTarget);

    const withTargetA = planTask([], { ...noTargetInput, targetUrl: 'https://site.test/a' });
    const withTargetB = planTask(withTargetA, { ...noTargetInput, targetUrl: 'https://site.test/b' });
    expect(withTargetB).toHaveLength(2);
    expect(planTask(withTargetB, { ...noTargetInput, targetUrl: undefined })).toHaveLength(3);
  });

  it('markImplemented updates only planned tasks and leaves resolved tasks untouched', () => {
    const tasks = [
      baseTask('t-plan', { status: 'planned' }),
      baseTask('t-ver', { status: 'verified' }),
      baseTask('t-fail', { status: 'failed' }),
    ];
    const updated = markImplemented(tasks, 't-plan', '2026-03-01T12:00:00.000Z');
    expect(updated[0]).toMatchObject({ id: 't-plan', status: 'implemented', implementedAt: '2026-03-01T12:00:00.000Z' });
    expect(markImplemented(tasks, 't-ver', '2026-03-01T12:00:00.000Z')).toEqual(tasks);
    expect(markImplemented(tasks, 't-fail', '2026-03-01T12:00:00.000Z')).toEqual(tasks);
    expect(markImplemented(tasks, 'non-existent')).toEqual(tasks);
  });

  it('leaves persisted tasks unchanged when storage write fails', () => {
    const initialTasks = [baseTask('t1')];
    writeTasks('proj-safe', initialTasks);
    expect(readTasks('proj-safe')).toEqual(initialTasks);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const nextTasks = [...initialTasks, baseTask('t2')];
    const ok = writeTasks('proj-safe', nextTasks);
    expect(ok).toBe(false);

    vi.restoreAllMocks();
    expect(readTasks('proj-safe')).toEqual(initialTasks);
  });
});

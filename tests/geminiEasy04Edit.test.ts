import { describe, expect, it } from 'vitest';
import { editTask, filterTasks, type TaskEdit } from '@/services/optimizationTasks/edit';
import type { OptimizationTask, TaskPriority } from '@/services/optimizationTasks/types';

const sample = (id: string, patch: Partial<OptimizationTask> = {}): OptimizationTask => ({
  id,
  kind: 'add-link',
  module: 'sfs',
  status: 'planned',
  url: 'https://example.test/page',
  baselineScore: 50,
  priority: 'medium',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('geminiEasy04: editTask pure helper', () => {
  it('applies owner trimming, caps at 80 chars, and clears owner on empty input', () => {
    const initial = [sample('t1', { owner: 'bob' }), sample('t2')];
    const edited = editTask(initial, 't1', { owner: '  alice  ' });
    expect(edited[0].owner).toBe('alice');
    expect(edited[1]).toBe(initial[1]);

    const longOwner = 'o'.repeat(120);
    const capped = editTask(initial, 't1', { owner: longOwner });
    expect(capped[0].owner).toHaveLength(80);
    expect(capped[0].owner).toBe('o'.repeat(80));

    const clearedSpaces = editTask(initial, 't1', { owner: '   ' });
    expect(clearedSpaces[0].owner).toBeUndefined();
    expect('owner' in clearedSpaces[0]).toBe(false);

    const clearedEmpty = editTask(initial, 't1', { owner: '' });
    expect(clearedEmpty[0].owner).toBeUndefined();
  });

  it('validates priority and ignores unsupported priority values', () => {
    const tasks = [sample('t1', { priority: 'low' })];
    expect(editTask(tasks, 't1', { priority: 'high' })[0].priority).toBe('high');
    expect(editTask(tasks, 't1', { priority: 'medium' })[0].priority).toBe('medium');
    const invalidEdit = { priority: 'urgent' as unknown as TaskPriority };
    expect(editTask(tasks, 't1', invalidEdit)[0].priority).toBe('low');
  });

  it('validates YYYY-MM-DD due date, ignores malformed dates, and clears on empty string', () => {
    const tasks = [sample('t1', { dueDate: '2026-05-01' })];
    expect(editTask(tasks, 't1', { dueDate: '2026-12-31' })[0].dueDate).toBe('2026-12-31');
    expect(editTask(tasks, 't1', { dueDate: '2026/12/31' })[0].dueDate).toBe('2026-05-01');
    expect(editTask(tasks, 't1', { dueDate: 'not-a-date' })[0].dueDate).toBe('2026-05-01');
    expect(editTask(tasks, 't1', { dueDate: '2026-1-1' })[0].dueDate).toBe('2026-05-01');

    const cleared = editTask(tasks, 't1', { dueDate: '' });
    expect(cleared[0].dueDate).toBeUndefined();
    expect('dueDate' in cleared[0]).toBe(false);
  });

  it('leaves non-matching tasks untouched and allows combined partial edits', () => {
    const tasks = [sample('t1', { owner: 'ann', priority: 'low', dueDate: '2026-03-01' }), sample('t2')];
    const unchanged = editTask(tasks, 't999', { owner: 'someone' });
    expect(unchanged[0]).toBe(tasks[0]);
    expect(unchanged[1]).toBe(tasks[1]);

    const combined: TaskEdit = { owner: 'team-lead', priority: 'high', dueDate: '2026-04-15' };
    const result = editTask(tasks, 't1', combined);
    expect(result[0]).toMatchObject({ owner: 'team-lead', priority: 'high', dueDate: '2026-04-15' });
    expect(result[1]).toBe(tasks[1]);
  });
});

describe('geminiEasy04: filterTasks pure helper', () => {
  it('filters by mine case-insensitively and handles whitespace', () => {
    const tasks = [
      sample('1', { owner: 'Alice' }),
      sample('2', { owner: 'bob' }),
      sample('3', { owner: 'ALICE' }),
      sample('4'),
    ];

    expect(filterTasks(tasks, 'mine', 'alice', '2026-06-01').map((t) => t.id)).toEqual(['1', '3']);
    expect(filterTasks(tasks, 'mine', '  Bob  ', '2026-06-01').map((t) => t.id)).toEqual(['2']);
    expect(filterTasks(tasks, 'mine', '', '2026-06-01')).toEqual([]);
    expect(filterTasks(tasks, 'mine', '   ', '2026-06-01')).toEqual([]);
    expect(filterTasks(tasks, 'mine', 'charlie', '2026-06-01')).toEqual([]);
  });

  it('filters overdue tasks by SLA date and open status only', () => {
    const today = '2026-06-15';
    const tasks = [
      sample('past-planned', { dueDate: '2026-06-10', status: 'planned' }),
      sample('past-implemented', { dueDate: '2026-06-14', status: 'implemented' }),
      sample('past-verified', { dueDate: '2026-06-10', status: 'verified' }),
      sample('past-failed', { dueDate: '2026-06-10', status: 'failed' }),
      sample('today-planned', { dueDate: '2026-06-15', status: 'planned' }),
      sample('future-planned', { dueDate: '2026-06-20', status: 'planned' }),
      sample('no-deadline', { status: 'planned' }),
    ];

    const overdue = filterTasks(tasks, 'overdue', 'alice', today);
    expect(overdue.map((t) => t.id)).toEqual(['past-planned', 'past-implemented']);
  });

  it('returns all tasks for filter all or default', () => {
    const tasks = [sample('1'), sample('2')];
    expect(filterTasks(tasks, 'all', 'alice', '2026-06-15')).toEqual(tasks);
  });
});

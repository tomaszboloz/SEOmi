import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendDeltas, metricHistoryKey, readMetricHistory } from '@/services/optimizationTasks/metricHistory';
import type { OptimizationTask } from '@/services/optimizationTasks/types';

const taskWithVerdict = (
  id: string,
  status: OptimizationTask['status'],
  delta: number | null,
  verdictStatus: 'verified' | 'failed' = 'verified',
  verifiedAt = '2026-03-01T10:00:00.000Z',
): OptimizationTask => ({
  id,
  kind: 'add-link',
  module: 'sfs',
  status,
  url: `https://site.test/${id}`,
  baselineScore: 50,
  priority: 'high',
  createdAt: '2026-01-01T00:00:00.000Z',
  verifiedAt,
  verdict: delta === null ? undefined : {
    status: verdictStatus,
    code: 'link-found',
    params: {},
    delta,
    regression: delta < 0,
  },
});

describe('geminiEasy04: metricHistory pure helpers', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('distinguishes empty history from history containing real zero delta', () => {
    expect(readMetricHistory('proj-none')).toEqual([]);

    const before = [taskWithVerdict('t-zero', 'implemented', null)];
    const after = [taskWithVerdict('t-zero', 'verified', 0)];

    const appended = appendDeltas('proj-zero', before, after);
    expect(appended).toHaveLength(1);
    expect(appended[0].delta).toBe(0);

    const stored = readMetricHistory('proj-zero');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ taskId: 't-zero', module: 'sfs', delta: 0, status: 'verified' });

    localStorage.setItem(metricHistoryKey('proj-corrupt'), JSON.stringify([
      { taskId: 'bad1', delta: null },
      { taskId: 'bad2', delta: '0' },
      null,
      { taskId: 'good-zero', delta: 0 },
      { taskId: 'good-negative', delta: -4.5 },
    ]));
    const cleaned = readMetricHistory('proj-corrupt');
    expect(cleaned).toHaveLength(2);
    expect(cleaned.map((r) => r.delta)).toEqual([0, -4.5]);
  });

  it('maintains strict project separation for recorded metrics', () => {
    const key1 = metricHistoryKey('project-1');
    const key2 = metricHistoryKey('project-2');
    expect(key1).not.toBe(key2);

    const before = [taskWithVerdict('t1', 'implemented', null)];
    const after = [taskWithVerdict('t1', 'verified', 15.5)];

    appendDeltas('project-1', before, after);
    expect(readMetricHistory('project-2')).toEqual([]);
    expect(readMetricHistory('project-1')).toHaveLength(1);
    expect(readMetricHistory('project-1')[0].delta).toBe(15.5);
  });

  it('records deltas only when task transitions from implemented to resolved with a delta', () => {
    const before: OptimizationTask[] = [
      taskWithVerdict('from-planned', 'planned', null),
      taskWithVerdict('already-verified', 'verified', 10),
      taskWithVerdict('stay-implemented', 'implemented', null),
      taskWithVerdict('null-delta', 'implemented', null),
      taskWithVerdict('valid-verified', 'implemented', null),
      taskWithVerdict('valid-failed', 'implemented', null),
    ];

    const after: OptimizationTask[] = [
      taskWithVerdict('from-planned', 'verified', 5),
      taskWithVerdict('already-verified', 'verified', 20),
      taskWithVerdict('stay-implemented', 'implemented', 5),
      { ...taskWithVerdict('null-delta', 'verified', null), verdict: { status: 'verified', code: 'link-found', params: {}, delta: null, regression: false } },
      taskWithVerdict('valid-verified', 'verified', 12.3, 'verified', '2026-03-02T12:00:00Z'),
      taskWithVerdict('valid-failed', 'failed', -8.1, 'failed', '2026-03-02T12:05:00Z'),
    ];

    const deltas = appendDeltas('proj-transitions', before, after);
    expect(deltas.map((d) => [d.taskId, d.delta, d.status])).toEqual([
      ['valid-verified', 12.3, 'verified'],
      ['valid-failed', -8.1, 'failed'],
    ]);
  });

  it('does not write storage when delta list is empty', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const before = [taskWithVerdict('t1', 'implemented', null)];
    const after = [taskWithVerdict('t1', 'implemented', null)];

    const res = appendDeltas('proj-noop', before, after);
    expect(res).toEqual([]);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('preserves existing metric history unchanged when storage write fails', () => {
    const beforeInitial = [taskWithVerdict('t-init', 'implemented', null)];
    const afterInitial = [taskWithVerdict('t-init', 'verified', 10)];
    appendDeltas('proj-fail', beforeInitial, afterInitial);

    const initialHistory = readMetricHistory('proj-fail');
    expect(initialHistory).toHaveLength(1);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Disk quota exceeded');
    });

    const beforeNext = [taskWithVerdict('t-next', 'implemented', null)];
    const afterNext = [taskWithVerdict('t-next', 'verified', 5)];
    const attempted = appendDeltas('proj-fail', beforeNext, afterNext);
    expect(attempted).toHaveLength(1);

    vi.restoreAllMocks();
    expect(readMetricHistory('proj-fail')).toEqual(initialHistory);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { availability, DagCycleError, envelope, runDag, topologicalOrder, type DagNode, type ReportEnvelope } from '@/services/analysisContracts';

const ctx = { projectId: 'p1', runId: 'r1', generatedAt: '2026-10-30T00:00:00Z' };
const ok = (module: string, value: unknown, status: 'complete' | 'partial' = 'complete'): ReportEnvelope<unknown> =>
  envelope({ ...ctx, module, algorithmVersion: 1, value, availability: status === 'complete' ? undefined : availability('partial', 'sample', 0.5) });
const node = (id: string, deps: string[], run: DagNode['run'], extra: Partial<DagNode> = {}): DagNode => ({ id, deps, run, ...extra });

describe('analysis DAG (#85 GEM-85-06, T05)', () => {
  it('orders nodes topologically and rejects cycles and unknown dependencies', () => {
    const noop: DagNode['run'] = async () => ok('x', 1);
    expect(topologicalOrder([node('hss', ['sfs', 'tas'], noop), node('tas', ['sfs'], noop), node('sfs', [], noop)])).toEqual(['sfs', 'tas', 'hss']);
    expect(() => topologicalOrder([node('a', ['b'], noop), node('b', ['a'], noop)])).toThrow(DagCycleError);
    expect(() => topologicalOrder([node('a', ['ghost'], noop)])).toThrow(/ghost|a/);
  });

  it('runs each node once and hands upstream envelopes downstream', async () => {
    const sfs = vi.fn(async () => ok('sfs', 70));
    const hss = vi.fn(async (inputs: Readonly<Record<string, ReportEnvelope<unknown>>>) => ok('hss', (inputs.sfs.value as number) + 1));
    const result = await runDag([node('hss', ['sfs'], hss), node('sfs', [], sfs)], ctx);
    expect(sfs).toHaveBeenCalledTimes(1);
    expect(result.hss.value).toBe(71);
    expect(Object.isFrozen(result.hss)).toBe(true);
    expect(() => { (result.sfs as { value: unknown }).value = 0; }).toThrow();
  });

  it('marks dependents of a failed node unavailable but keeps independent siblings', async () => {
    const result = await runDag([
      node('sfs', [], async () => { throw new Error('crawl gone'); }),
      node('tas', ['sfs'], async () => ok('tas', 1)),
      node('aio', [], async () => ok('aio', 5)),
    ], ctx);
    expect(result.sfs.availability).toMatchObject({ status: 'error', reason: 'failed:crawl gone' });
    expect(result.tas).toMatchObject({ value: null, availability: { status: 'unavailable', reason: 'upstream:sfs' } });
    expect(result.aio.value).toBe(5);
  });

  it('lets a partial-tolerant node run on degraded inputs and passes partial through', async () => {
    const result = await runDag([
      node('sfs', [], async () => ok('sfs', 3, 'partial')),
      node('gone', [], async () => ok('gone', null)),
      node('hss', ['sfs', 'gone'], async (inputs) => ok('hss', inputs.gone.value === null ? 'partial-hss' : 'full', 'partial'), { acceptsPartial: true }),
      node('strict', ['sfs'], async () => ok('strict', 1)),
    ], ctx);
    expect(result.hss.value).toBe('partial-hss');
    expect(result.strict.value).toBe(1);
  });

  it('retries a flaky node and stops on project mismatch', async () => {
    let calls = 0;
    const flaky = node('sfs', [], async () => { calls += 1; if (calls < 2) throw 'transient'; return ok('sfs', 2); });
    expect((await runDag([flaky], { ...ctx, retries: 1 })).sfs.value).toBe(2);
    const foreign = node('x', [], async () => envelope({ ...ctx, projectId: 'p2', module: 'x', algorithmVersion: 1, value: 1 }));
    expect((await runDag([foreign], ctx)).x.availability.reason).toBe('mixed-projects');
  });

  it('cancels the remaining nodes once the signal aborts', async () => {
    const controller = new AbortController();
    const result = await runDag([
      node('a', [], async () => { controller.abort(); throw new Error('aborted'); }),
      node('b', [], async () => ok('b', 1)),
    ], { ...ctx, signal: controller.signal });
    expect(result.a.availability.status).toBe('cancelled');
    expect(result.b.availability.status).toBe('cancelled');
    const pre = new AbortController();
    pre.abort();
    const skipped = await runDag([node('c', [], async () => ok('c', 1), { acceptsPartial: true })], { ...ctx, signal: pre.signal });
    expect(skipped.c.availability.status).toBe('cancelled');
  });
});

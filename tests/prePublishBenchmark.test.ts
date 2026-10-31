import { describe, expect, it, vi } from 'vitest';
import { benchmarkMarkdown, benchmarkPrePublish, percentile, PREPUBLISH_TARGET_MS, PREPUBLISH_WARM_RUNS } from '@/services/prePublish/benchmark';

const environment = { platform: 'darwin-arm64', cpu: 'Test CPU', cores: 8, memoryGb: 16, runtime: 'node 22' };
const clockOf = (durations: number[]) => {
  let now = 0;
  let index = 0;
  let running = false;
  return () => {
    if (running) now += durations[index++] ?? 0;
    running = !running;
    return now;
  };
};

describe('pre-publish cold/warm benchmark (#94 GEM-94-09)', () => {
  it('times one cold and N warm runs with median and p95, labelled as benchmark not SLA', async () => {
    const check = vi.fn(async () => undefined);
    const result = await benchmarkPrePublish(check, { corpusPages: 120, provider: 'local', environment, warmRuns: 4, clock: clockOf([2500, 400, 100, 300, 200]) });
    expect(check).toHaveBeenCalledTimes(5);
    expect(result).toMatchObject({ corpusPages: 120, coldMs: 2500, warmMs: [400, 100, 300, 200], warmMedianMs: 200, warmP95Ms: 400,
      targetMs: PREPUBLISH_TARGET_MS, coldWithinTarget: false, warmWithinTarget: true, kind: 'benchmark-not-sla' });
  });

  it('defaults to the standard warm run count and reports n/a with no warm runs', async () => {
    const check = vi.fn(async () => undefined);
    await benchmarkPrePublish(check, { corpusPages: 1, provider: 'local', environment, clock: () => 0 });
    expect(check).toHaveBeenCalledTimes(1 + PREPUBLISH_WARM_RUNS);
    const cold = await benchmarkPrePublish(check, { corpusPages: 1, provider: 'local', environment, warmRuns: -3, clock: () => 0 });
    expect(cold.warmMs).toEqual([]);
    expect(cold.warmMedianMs).toBeNull();
    expect(cold.warmWithinTarget).toBeNull();
    expect(cold.coldWithinTarget).toBe(true);
  });

  it('uses the performance clock by default', async () => {
    const result = await benchmarkPrePublish(async () => undefined, { corpusPages: 0, provider: 'local', environment, warmRuns: 1 });
    expect(result.coldMs).toBeGreaterThanOrEqual(0);
  });

  it('propagates check failures, cancellation and invalid corpus sizes', async () => {
    await expect(benchmarkPrePublish(async () => { throw new Error('offline'); }, { corpusPages: 3, provider: 'ollama', environment })).rejects.toThrow('offline');
    const abort = new AbortController();
    abort.abort();
    const check = vi.fn(async () => undefined);
    await expect(benchmarkPrePublish(check, { corpusPages: 3, provider: 'local', environment, signal: abort.signal })).rejects.toThrow();
    expect(check).not.toHaveBeenCalled();
    await expect(benchmarkPrePublish(check, { corpusPages: -1, provider: 'local', environment })).rejects.toThrow('Invalid corpus size');
    await expect(benchmarkPrePublish(check, { corpusPages: 1.5, provider: 'local', environment })).rejects.toThrow('Invalid corpus size');
  });

  it('computes nearest-rank percentiles', () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([5], 95)).toBe(5);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4], 0)).toBe(1);
  });

  it('renders a markdown table with deduplicated environment lines', async () => {
    const run = (pages: number, warmRuns: number) => benchmarkPrePublish(async () => undefined, { corpusPages: pages, provider: 'local', environment, warmRuns, clock: () => 0 });
    const markdown = benchmarkMarkdown([await run(50, 2), await run(500, 0)]);
    expect(markdown).toContain('| 50 | local | 0 | 0 | 0 | yes | yes |');
    expect(markdown).toContain('| 500 | local | 0 | n/a | n/a | yes | n/a |');
    expect(markdown.match(/Environment:/g)).toHaveLength(1);
    expect(markdown).toContain('Test CPU, 8 cores, 16 GB RAM');
    const unknown = await benchmarkPrePublish(async () => undefined, { corpusPages: 1, provider: 'local', environment: { ...environment, cores: null, memoryGb: null }, warmRuns: 0, clock: () => 0 });
    expect(benchmarkMarkdown([unknown])).toContain('? cores, ? GB RAM');
  });
});

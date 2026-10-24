import { describe, expect, it } from 'vitest';
import { buildAioReport } from '@/services/aioReadiness';
import { compareAioForMonitoring, previousComparableAioCrawl } from '@/services/monitoringAlerts';
import { aioRun, beforeAio, afterAio, GOOD_PAGE, WEAK_PAGE } from './aioMonitoringFixtures';
import { createCrawlPageFixture } from './fixtures/crawl';
import type { CrawlRunRecord } from '@/types';

describe('AIO crawl comparison', () => {
  it('uses actual AIO-R reports and stable evidence, not placeholder history scores', () => {
    const baseline = beforeAio(); const current = afterAio();
    const before = buildAioReport(baseline.result.pages).score;
    const after = buildAioReport(current.result.pages).score;
    expect(before - after).toBeGreaterThanOrEqual(10);
    const result = compareAioForMonitoring(baseline, current);
    expect(result).toMatchObject({ partial: false, alert: { type: 'aio', partial: false,
      sourceId: 'aio-after', evidence: { before, after, drop: before - after } } });
    expect(compareAioForMonitoring(baseline, current).alert?.fingerprint).toBe(result.alert?.fingerprint);
    expect(compareAioForMonitoring(baseline, afterAio('another')).alert?.fingerprint).not.toBe(result.alert?.fingerprint);
  });

  it('does not alert on first, unchanged or improved runs', () => {
    expect(compareAioForMonitoring(undefined, afterAio())).toEqual({ alert: null, partial: false, skipped: 'no-baseline' });
    expect(compareAioForMonitoring(beforeAio(), aioRun('after')).alert).toBeNull();
    expect(compareAioForMonitoring(aioRun('before', [WEAK_PAGE]), aioRun('after')).alert).toBeNull();
  });

  it.each(['baseline', 'current'] as const)('honestly skips missing rag_sections in %s', (side) => {
    const missing = [createCrawlPageFixture()];
    const baseline = side === 'baseline' ? aioRun('before', missing) : beforeAio();
    const current = side === 'current' ? aioRun('after', missing) : afterAio();
    expect(compareAioForMonitoring(baseline, current)).toEqual({ alert: null, partial: true, skipped: 'score-unavailable' });
  });

  it.each([{ pages: [] }, { pages: [{ ...GOOD_PAGE, rag_sections: [] }] }, { pages: [{ ...GOOD_PAGE, http_status: 500 }] }])('skips unscorable page sets', ({ pages }) => {
    expect(compareAioForMonitoring(beforeAio(), aioRun('after', pages))).toMatchObject({ alert: null, partial: true, skipped: 'score-unavailable' });
  });

  it('marks scored subsets partial whether missing pages are before or after', () => {
    const missing = createCrawlPageFixture();
    expect(compareAioForMonitoring(aioRun('before', [GOOD_PAGE, missing]), afterAio())).toMatchObject({ partial: true, alert: { partial: true } });
    expect(compareAioForMonitoring(beforeAio(), aioRun('after', [WEAK_PAGE, missing]))).toMatchObject({ partial: true, alert: { partial: true } });
    expect(compareAioForMonitoring(aioRun('before', [WEAK_PAGE, missing]), aioRun('after'))).toEqual({ partial: true, alert: null });
  });

  it.each(['cancelled', 'timed_out'] as const)('skips %s on either side', (flag) => {
    const baseline = beforeAio(); const current = afterAio();
    expect(compareAioForMonitoring({ ...baseline, result: { ...baseline.result, [flag]: true } }, current).alert).toBeNull();
    expect(compareAioForMonitoring(baseline, { ...current, result: { ...current.result, [flag]: true } }).alert).toBeNull();
  });

  it.each([
    { id: 'after' }, { projectId: 'other-project' }, { projectId: undefined },
    { startUrl: 'https://other.test/' }, { completedAt: 'invalid' }, { completedAt: '2026-10-03T00:00:00Z' },
    { completedAt: '2026-10-02T00:00:00Z' }, { environment: 'staging' },
  ] satisfies Partial<CrawlRunRecord>[])('rejects incomparable baseline %j', (patch) => {
    expect(compareAioForMonitoring({ ...beforeAio(), ...patch }, afterAio())).toEqual({ alert: null, partial: true, skipped: 'incomparable' });
  });

  it('rejects different configs and truncated crawls', () => {
    const baseline = beforeAio(); const current = afterAio();
    expect(compareAioForMonitoring({ ...baseline, config: { ...baseline.config, maxPages: 2 } }, current).skipped).toBe('incomparable');
    expect(compareAioForMonitoring({ ...baseline, result: { ...baseline.result, storage_pages_truncated: true } }, current).skipped).toBe('incomparable');
    expect(compareAioForMonitoring(baseline, { ...current, result: { ...current.result, resource_limit_reached: true } }).skipped).toBe('incomparable');
  });

  it('chooses the latest comparable prior crawl without mutating or skipping an unavailable score', () => {
    const current = afterAio();
    const newest = aioRun('newest', [createCrawlPageFixture()], { completedAt: '2026-10-01T12:00:00Z' });
    const incompatible = aioRun('staging', [GOOD_PAGE], { environment: 'staging' });
    const candidates = [beforeAio(), current, incompatible, newest]; const original = [...candidates];
    const baseline = previousComparableAioCrawl(current, candidates, 'aio-project');
    expect(baseline).toBe(newest); expect(candidates).toEqual(original);
    expect(compareAioForMonitoring(baseline, current).skipped).toBe('score-unavailable');
    expect(previousComparableAioCrawl(current, [current, incompatible], 'aio-project')).toBeUndefined();
    expect(previousComparableAioCrawl(current, [beforeAio()], 'different-project')).toBeUndefined();
  });
});

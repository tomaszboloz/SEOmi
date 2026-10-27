import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';

const monitor = vi.hoisted(() => vi.fn());
const scores = vi.hoisted(() => ({ aio: 80, trust: 80 }));
vi.mock('@/services/monitoringAlerts', () => ({ monitorScoreDrop: monitor }));
vi.mock('@/services/siteFocus', () => ({ buildSiteFocusReport: () => ({}) }));
vi.mock('@/services/aioReadiness', async (importActual) => ({
  ...(await importActual<typeof import('@/services/aioReadiness')>()),
  buildAioReport: () => ({ generatedAt: 't', score: scores.aio, selfContainment: 1, spoDensity: 1, extractability: 1, scoredCount: 1, weakPassages: [] }),
}));
vi.mock('@/services/eeatTrust', async (importActual) => ({
  ...(await importActual<typeof import('@/services/eeatTrust')>()),
  buildTrustReport: () => ({ generatedAt: 't', score: scores.trust, layers: {} }),
}));

import { useAioReadiness } from '@/hooks/useAioReadiness';
import { useTrust } from '@/hooks/useTrust';

const pages = [{ url: 'https://a.test/' }] as unknown as CrawledPageSummary[];
const run = (id: string) => ({ id, completedAt: '2026-01-01' }) as unknown as CrawlRunRecord;

describe('score drop monitoring in hooks', () => {
  beforeEach(() => {
    localStorage.clear();
    monitor.mockReset();
    monitor.mockResolvedValue({});
    scores.aio = 80;
    scores.trust = 80;
  });

  it('AIO: records snapshots but leaves alerting to crawl completion, not panel history', () => {
    renderHook(() => useAioReadiness(pages, run('r1'), 'proj-1'));
    expect(monitor).not.toHaveBeenCalled();
    scores.aio = 60;
    const { result } = renderHook(() => useAioReadiness(pages, run('r2'), 'proj-1'));
    expect(result.current.history.map((item) => item.score)).toEqual([80, 60]);
    expect(monitor).not.toHaveBeenCalled();
    monitor.mockClear();
    renderHook(() => useAioReadiness(pages, run('r2'), 'proj-1'));
    expect(monitor).not.toHaveBeenCalled();
  });

  it('AIO: does not alert when an older run is opened after a newer run', () => {
    renderHook(() => useAioReadiness(pages, run('r1'), 'proj-1'));
    scores.aio = 10;
    expect(() => renderHook(() => useAioReadiness(pages, run('r2'), 'proj-1'))).not.toThrow();
    renderHook(() => useAioReadiness(pages, run('r1'), 'proj-1'));
    expect(monitor).not.toHaveBeenCalled();
  });

  it('Trust: alerts once per new run and skips repeats and missing project', () => {
    renderHook(() => useTrust(pages, 'https://a.test/', run('r1'), 'proj-1'));
    expect(monitor).toHaveBeenCalledWith('proj-1', 'trust', undefined, expect.objectContaining({ score: 80 }), 'r1');
    monitor.mockClear();
    scores.trust = 50;
    renderHook(() => useTrust(pages, 'https://a.test/', run('r2'), 'proj-1'));
    expect(monitor).toHaveBeenCalledWith('proj-1', 'trust', expect.objectContaining({ score: 80 }), expect.objectContaining({ score: 50 }), 'r2');
    monitor.mockClear();
    renderHook(() => useTrust(pages, 'https://a.test/', run('r2'), 'proj-1'));
    renderHook(() => useTrust(pages, 'https://a.test/', run('r3'), null));
    expect(monitor).not.toHaveBeenCalled();
  });
});

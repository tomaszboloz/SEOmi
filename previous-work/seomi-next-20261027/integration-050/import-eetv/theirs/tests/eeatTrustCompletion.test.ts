import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrawlRunRecord } from '@/types';

const monitor = vi.hoisted(() => vi.fn());
vi.mock('@/services/monitoringAlerts', () => ({ monitorScoreDrop: monitor }));

import { persistCompletedTrustRun } from '@/services/eeatTrust';
import { diabetesPages, NOW, START } from './eeatTrustFixtures';

const run = (id: string, pages = diabetesPages(), patch: Partial<CrawlRunRecord> = {}): CrawlRunRecord => ({
  id, projectId: 'completion-project', startedAt: '2026-10-15T00:00:00Z', completedAt: NOW, startUrl: START,
  config: {} as CrawlRunRecord['config'], environment: 'default', result: { pages, cancelled: false, timed_out: false } as CrawlRunRecord['result'], ...patch,
});

describe('completed crawl EETV lifecycle', () => {
  beforeEach(() => { localStorage.clear(); monitor.mockReset().mockResolvedValue({}); });

  it('records completed runs once and sends only a comparable-profile event', () => {
    const first = persistCompletedTrustRun('completion-project', run('r1'))!;
    expect(first.history).toHaveLength(1);
    expect(first.alerted).toBe(false);
    const second = persistCompletedTrustRun('completion-project', run('r2'))!;
    expect(second.history).toHaveLength(2);
    expect(monitor).toHaveBeenCalledWith('completion-project', 'trust', expect.anything(), expect.anything(), 'r2');
    expect(persistCompletedTrustRun('completion-project', run('r2'))?.history).toHaveLength(2);
    expect(monitor).toHaveBeenCalledTimes(1);
  });

  it('does not persist or alert imported/partial runs or empty evidence', () => {
    expect(persistCompletedTrustRun('completion-project', run('legacy-1'))).toBeUndefined();
    expect(persistCompletedTrustRun('completion-project', run('r-empty', [], { result: { pages: [], cancelled: false, timed_out: false } as unknown as CrawlRunRecord['result'] }))).toBeUndefined();
    expect(monitor).not.toHaveBeenCalled();
  });
});

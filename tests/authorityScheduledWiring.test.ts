import { beforeEach, describe, expect, it, vi } from 'vitest';

const runScheduledAuthorityDefault = vi.hoisted(() => vi.fn());
vi.mock('@/services/topicalAuthorityMonitoring/scheduledAuthorityWiring', () => ({ runScheduledAuthorityDefault }));

import { createCrawlHistoryActions } from '@/stores/tools/crawl/history';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlResultFixture } from './fixtures/crawl';

beforeEach(() => { localStorage.clear(); runScheduledAuthorityDefault.mockReset(); useProjectStore.setState({ activeProjectId: 'wire-1' }); });

describe('native scheduled crawl feeds Topical Authority monitoring (#61)', () => {
  it('hands the imported run to the authority runner and swallows its failure', async () => {
    runScheduledAuthorityDefault.mockRejectedValue(new Error('offline'));
    const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 });
    const { actions } = isolatedToolsSlice((set, get, services) => createCrawlHistoryActions(set, get, services), { saveCrawlRuns });
    expect(await actions.importScheduledCrawlResult(createCrawlResultFixture(), 'sched/9')).toBe(true);
    await vi.waitFor(() => expect(runScheduledAuthorityDefault).toHaveBeenCalledWith('wire-1', expect.objectContaining({ id: 'scheduled-crawl-sched-9' })));
  });
});

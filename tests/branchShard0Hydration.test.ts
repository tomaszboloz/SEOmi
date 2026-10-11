import { beforeEach, expect, it, vi } from 'vitest';
import { createHydrationSlice } from '@/stores/tools/hydrationSlice';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlRunFixture } from './fixtures/crawl';

vi.mock('@/services/tauri', () => ({ isTauriEnvironment: vi.fn(() => false),
  invokeTauriCommand: vi.fn().mockResolvedValue(undefined), getSecureValue: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'shard0-project' });
});

it('keeps runs that already carry the hydrating project id and stamps the ones that do not', async () => {
  const owned = createCrawlRunFixture({ id: 'owned', projectId: 'shard0-project' });
  const legacy = createCrawlRunFixture({ id: 'legacy' });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services),
    { loadCrawlRuns: vi.fn().mockResolvedValue([owned, legacy]) });
  await actions.hydrateProject('shard0-project');
  const runs = store.getState().crawlRuns;
  expect(runs.find((run) => run.id === 'owned')).toBe(owned);
  expect(runs.find((run) => run.id === 'legacy')?.projectId).toBe('shard0-project');
});

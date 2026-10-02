import { beforeEach, expect, it, vi } from 'vitest';
import { isTauriEnvironment } from '@/services/tauri';
import { createHydrationSlice } from '@/stores/tools/hydrationSlice';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
vi.mock('@/services/tauri', () => ({ isTauriEnvironment: vi.fn(() => false),
  invokeTauriCommand: vi.fn().mockResolvedValue(undefined), getSecureValue: vi.fn() }));
beforeEach(() => {
  localStorage.clear(); vi.mocked(isTauriEnvironment).mockReturnValue(false);
  useProjectStore.setState({ activeProjectId: 'hydration-edges' });
});
const legacy = () => localStorage.setItem('seomi_project_hydration-edges_crawl_runs', JSON.stringify([
  createCrawlRunFixture(), createCrawlRunFixture({ id: 'older' }),
]));

it.each([new Error('history read failure'), new DOMException('quota', 'QuotaExceededError'), 'unstructured read failure'])(
  'retains a read error while recovering compatible legacy history: %s', async error => {
    legacy();
    const saveCrawlRuns = vi.fn();
    const { actions, store } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services),
      { loadCrawlRuns: vi.fn().mockRejectedValue(error), saveCrawlRuns });
    await actions.hydrateProject('hydration-edges');
    expect(store.getState().crawlRuns).toHaveLength(2);
    expect(store.getState().crawlPersistenceError).toBeTruthy();
    expect(saveCrawlRuns).not.toHaveBeenCalled();
  },
);

it.each([new Error('migration failure'), new DOMException('quota', 'QuotaExceededError'), 'unstructured migration failure'])(
  'contains a failed legacy history migration: %s', async error => {
    legacy();
    const { actions, store } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services),
      { loadCrawlRuns: vi.fn().mockResolvedValue([]), saveCrawlRuns: vi.fn().mockRejectedValue(error) });
    await actions.hydrateProject('hydration-edges');
    expect(store.getState().crawlRuns).toHaveLength(2);
    expect(store.getState().crawlPersistenceError).toBeTruthy();
  },
);

it('prunes legacy history only after successful migration and removes obsolete desktop mirrors', async () => {
  vi.mocked(isTauriEnvironment).mockReturnValue(true);
  legacy();
  const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 1, compactedRuns: 1 });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services),
    { secureValue: vi.fn().mockRejectedValue(new Error('secret unavailable')),
      loadCrawlRuns: vi.fn().mockResolvedValue([]), saveCrawlRuns, invoke: vi.fn().mockResolvedValue(null) });
  await actions.hydrateProject('hydration-edges');
  expect(store.getState().crawlRuns).toHaveLength(1);
  expect(store.getState().gscClientSecret).toBe('');
  expect(store.getState().crawlPersistenceNotice).toBeTruthy();
  expect(localStorage.getItem('seomi_project_hydration-edges_crawl_runs')).toBeNull();
});

it('migrates a valid single legacy snapshot and exposes stored compaction evidence', async () => {
  localStorage.setItem('seomi_project_hydration-edges_crawl_result', JSON.stringify(createCrawlResultFixture()));
  const saveCrawlRuns = vi.fn().mockResolvedValue({ prunedRuns: 0 });
  const { actions, store } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services),
    { loadCrawlRuns: vi.fn().mockResolvedValue([]), saveCrawlRuns });
  await actions.hydrateProject('hydration-edges');
  expect(saveCrawlRuns).toHaveBeenCalledTimes(1);
  expect(store.getState().crawlRuns[0].id).toMatch(/^legacy-/);
  const compacted = createCrawlRunFixture({ storage_compacted: true });
  const next = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services),
    { loadCrawlRuns: vi.fn().mockResolvedValue([compacted]) });
  await next.actions.hydrateProject('hydration-edges');
  expect(next.store.getState()).toMatchObject({ crawlPersistenceCompacted: true });
  expect(next.store.getState().crawlPersistenceNotice).toBeTruthy();
});

it('ignores a migration completion belonging to an older project', async () => {
  legacy();
  let complete!: (value: unknown) => void;
  const saveCrawlRuns = vi.fn(() => new Promise(resolve => { complete = resolve; }));
  const { actions, store } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services),
    { loadCrawlRuns: vi.fn().mockResolvedValue([]), saveCrawlRuns: saveCrawlRuns as never });
  const pending = actions.hydrateProject('hydration-edges');
  await vi.waitFor(() => expect(saveCrawlRuns).toHaveBeenCalled());
  useProjectStore.setState({ activeProjectId: 'other' });
  store.setState({ crawlRuns: [], crawlResult: null, crawlPersistenceNotice: null });
  complete({ prunedRuns: 0 });
  await pending;
  expect(store.getState()).toMatchObject({ crawlRuns: [], crawlResult: null, crawlPersistenceNotice: null });
});

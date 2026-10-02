import { beforeEach, expect, it, vi } from 'vitest';
import { isTauriEnvironment } from '@/services/tauri';
import { createHydrationSlice } from '@/stores/tools/hydrationSlice';
import { useProjectStore } from '@/stores/projectStore';
import { DEFAULT_CRAWL_CONFIG } from '@/stores/tools/crawlPersistence';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlRunFixture } from './fixtures/crawl';

vi.mock('@/services/tauri', () => ({ isTauriEnvironment: vi.fn(() => false),
  invokeTauriCommand: vi.fn(), getSecureValue: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  vi.mocked(isTauriEnvironment).mockReturnValue(false);
  useProjectStore.setState({ activeProjectId: 'origin' });
});

it('ignores a secret returned after switching projects before initial hydration', async () => {
  vi.mocked(isTauriEnvironment).mockReturnValue(true);
  let complete!: (value: string) => void;
  const secureValue = vi.fn(() => new Promise<string>(resolve => { complete = resolve; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services),
    { secureValue, loadCrawlRuns: vi.fn().mockResolvedValue([]), invoke: vi.fn().mockResolvedValue(null) });
  const pending = actions.hydrateProject('origin');
  useProjectStore.setState({ activeProjectId: 'other' });
  store.setState({ keywordQuery: 'other phrase', gscClientId: 'other-client', gscClientSecret: '' });
  complete('old-secret');
  await pending;
  expect(store.getState()).toMatchObject({ keywordQuery: 'other phrase', gscClientId: 'other-client', gscClientSecret: '' });
});

it('ignores a native checkpoint returned after switching projects during final hydration', async () => {
  vi.mocked(isTauriEnvironment).mockReturnValue(true);
  let complete!: (value: unknown) => void;
  const invoke = vi.fn(() => new Promise(resolve => { complete = resolve; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services),
    { secureValue: vi.fn().mockResolvedValue(''), loadCrawlRuns: vi.fn().mockResolvedValue([createCrawlRunFixture()]),
      invoke: invoke as never });
  const pending = actions.hydrateProject('origin');
  await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
  useProjectStore.setState({ activeProjectId: 'other' });
  store.setState({ crawlUrl: 'https://other.test/', crawlRuns: [], crawlResult: null });
  complete(null);
  await pending;
  expect(store.getState()).toMatchObject({ crawlUrl: 'https://other.test/', crawlRuns: [], crawlResult: null });
});

it('keeps the latest hydration when two requests target the same project', async () => {
  let finishOld!: (value: unknown) => void;
  const older = createCrawlRunFixture({ id: 'older-history' });
  const newer = createCrawlRunFixture({ id: 'newer-history' });
  const loadCrawlRuns = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValue([newer]);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services), { loadCrawlRuns });
  const first = actions.hydrateProject('origin');
  await actions.hydrateProject('origin');
  finishOld([older]);
  await first;
  expect(store.getState().crawlRuns.map(run => run.id)).toEqual(['newer-history']);
});

it.each([null, 'origin'])('hydrates %s with independently owned nested configuration', async projectId => {
  const { store, actions } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services),
    { loadCrawlRuns: vi.fn().mockResolvedValue([]) });
  await actions.hydrateProject(projectId);
  const config = store.getState().crawlConfig;
  expect(config).not.toBe(DEFAULT_CRAWL_CONFIG);
  expect(config.includePatterns).not.toBe(DEFAULT_CRAWL_CONFIG.includePatterns);
  expect(config.customSearches).not.toBe(DEFAULT_CRAWL_CONFIG.customSearches);
});

it('exposes the MCP configuration selector through the direct factory', () => {
  const { actions, store } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services));
  actions.setMcpClientTab('codex');
  expect(store.getState().mcpClientTab).toBe('codex');
});

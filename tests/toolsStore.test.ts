import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';

import { useToolsStore } from '../src/stores/toolsStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';

vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn(),
  isTauriEnvironment: vi.fn(() => false),
  getSecureValue: vi.fn(async () => ''),
}));

describe('toolsStore', () => {
beforeEach(() => {
    localStorage.clear();
    vi.mocked(invokeTauriCommand).mockReset();
    vi.mocked(isTauriEnvironment).mockReturnValue(false);
    useToolsStore.setState({ keywordResults: [], keywordResultsSource: null, keywordError: null, crawlRuns: [], crawlResult: null, selectedCrawlRunId: null, backlinkProfileHistory: [] });
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
  });

afterEach(() => vi.unstubAllGlobals());

it('initializes without fabricated saved keywords or rank data', () => {
    const state = useToolsStore.getState();
    expect(state.savedKeywords).toEqual([]);
    expect(state.trackedRanks).toEqual([]);
  });

it('keeps the active project context in memory when WebView storage is locked', () => {
    useProjectStore.setState({
      projects: [{ id: 'locked-project', name: 'Locked project', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: 'locked-project',
    });
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage blocked'); },
      setItem: () => { throw new Error('storage blocked'); },
      removeItem: () => { throw new Error('storage blocked'); },
    });

    expect(() => useToolsStore.getState().addSavedKeyword({
      keyword: 'locked webview keyword', search_volume: 0, difficulty: 0, cpc: 0, intent: 'Informational', tags: [],
    })).not.toThrow();
    expect(useToolsStore.getState().savedKeywords[0]?.keyword).toBe('locked webview keyword');
  });

it('hydrates the native crawl checkpoint after a desktop restart', async () => {
    const projectId = 'project-native-checkpoint';
    const checkpoint = {
      url: 'https://example.com/',
      limit: 25,
      config: { crawlMode: 'http', respectRobots: true },
      environment: 'default',
      startedAt: '2026-09-25T10:00:00.000Z',
      completedUrls: ['https://example.com/'],
      frontierUrls: ['https://example.com/about'],
      baseRunId: 'crawl-base',
    };
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'load_project_crawl_runs') return [] as never;
      if (command === 'load_project_crawl_checkpoint') return checkpoint as never;
      return undefined as never;
    });

    await useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().interruptedCrawl).toMatchObject(checkpoint);
    expect(invokeTauriCommand).toHaveBeenCalledWith('load_project_crawl_checkpoint', { projectId });
  });

it('keeps the fresher WebView checkpoint when the native copy is stale', async () => {
    const projectId = 'project-native-checkpoint-freshness';
    const localCheckpoint = {
      url: 'https://example.com/',
      limit: 25,
      config: { crawlMode: 'http', respectRobots: true },
      environment: 'default',
      startedAt: '2026-09-25T10:00:00.000Z',
      updatedAt: '2026-09-26T10:00:00.000Z',
      completedUrls: ['https://example.com/newer'],
      frontierUrls: ['https://example.com/newer-frontier'],
    };
    const staleNativeCheckpoint = {
      ...localCheckpoint,
      updatedAt: '2026-09-25T11:00:00.000Z',
      completedUrls: ['https://example.com/older'],
      frontierUrls: ['https://example.com/older-frontier'],
    };
    localStorage.setItem('seomi_active_project_v1', projectId);
    localStorage.setItem(`seomi_project_${projectId}_crawl_interrupted_v1`, JSON.stringify(localCheckpoint));
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'load_project_crawl_runs') return [] as never;
      if (command === 'load_project_crawl_checkpoint') return staleNativeCheckpoint as never;
      return undefined as never;
    });

    await useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().interruptedCrawl?.updatedAt).toBe('2026-09-26T10:00:00.000Z');
    expect(useToolsStore.getState().interruptedCrawl?.frontierUrls).toEqual(['https://example.com/newer-frontier']);
  });

it('can add, filter, and remove saved keywords', () => {
    const store = useToolsStore.getState();
    const initialCount = store.savedKeywords.length;

    store.addSavedKeyword({
      keyword: 'custom keyword test',
      search_volume: 1200,
      difficulty: 35,
      cpc: 1.5,
      intent: 'Informational',
      tags: ['TestTag'],
    });

    const updated = useToolsStore.getState();
    expect(updated.savedKeywords.length).toBe(initialCount + 1);
    expect(updated.savedKeywords[0].keyword).toBe('custom keyword test');

    // Remove
    const addedId = updated.savedKeywords[0].id;
    updated.removeSavedKeyword(addedId);
    expect(useToolsStore.getState().savedKeywords.length).toBe(initialCount);
  });

it('can add a rank target without fabricating a position', async () => {
    const store = useToolsStore.getState();
    const initialCount = store.trackedRanks.length;

    store.addTrackedRank('serp tracking test', 'example.com', 'https://example.com/page', 'PL', 'pl');
    const updated = useToolsStore.getState();
    expect(updated.trackedRanks.length).toBe(initialCount + 1);

    expect(updated.trackedRanks[0].current_rank).toBeNull();
    expect(updated.trackedRanks[0].history).toEqual([]);
    expect(updated.trackedRanks[0]).toMatchObject({ location: 'PL', language_code: 'pl' });
  });
});

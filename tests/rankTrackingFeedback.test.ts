import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToolsStore } from '@/stores/toolsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { TrackedRankItem } from '@/types';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => false, getSecureValue: vi.fn(async () => '') }));
const originalTools = useToolsStore.getState();
const originalSettings = useSettingsStore.getState();
const rank = (extra: Partial<TrackedRankItem> = {}): TrackedRankItem => ({
  id: 'rank-fixture', keyword: 'seo audit', domain: 'example.test', target_url: 'https://example.test', location: 'PL', language_code: 'pl',
  current_rank: 4, previous_rank: 5, delta: 1, best_rank: 2, history: [{ date: '2026-09-30', rank: 4 }], last_checked: '2026-09-30', ...extra,
});
const response = (items: unknown[]) => new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items }] }] }));

describe('rank tracking partial evidence and invalid saved markets', () => {
  beforeEach(() => {
    localStorage.clear(); localStorage.setItem('seomi_active_project_v1', 'rank-feedback');
    useToolsStore.setState({ trackedRanks: [rank()], rankError: null, isRankLoading: false });
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'test-login', password: 'test-password' } });
  });
  afterEach(() => { vi.unstubAllGlobals(); useToolsStore.setState(originalTools); useSettingsStore.setState(originalSettings); });

  it.each([
    ['example.test', 7, 7], ['docs.example.test', 9, 9], ['example.test.evil.test', 1, 101], ['example.test', 120, 101],
  ])('checks domain %s at rank %i without accepting lookalikes', async (domain, returned, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([{ type: 'organic', domain, url: `https://${domain}/`, rank_absolute: returned, rank_group: returned }])));
    await useToolsStore.getState().refreshAllRanks();
    const saved = useToolsStore.getState().trackedRanks[0];
    expect(saved.current_rank).toBe(expected);
    expect(saved.previous_rank).toBe(4);
    expect(saved.best_rank).toBe(2);
    expect(saved.history.at(-1)?.rank).toBe(expected);
    expect(saved.last_checked).not.toBe('2026-09-30');
  });

  it('preserves checked history after an API failure instead of recording an absent rank', async () => {
    const before = rank();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 40100, status_message: 'Authentication failed' }] }))));
    await useToolsStore.getState().refreshAllRanks();
    expect(useToolsStore.getState().trackedRanks).toEqual([before]);
    expect(useToolsStore.getState().rankError).toBeTruthy();
    expect(useToolsStore.getState().isRankLoading).toBe(false);
  });

  it('retains an invalid saved market for correction and sends no paid request for it', async () => {
    localStorage.setItem('seomi_project_rank-feedback_tracked_ranks', JSON.stringify([rank({ location: 'obsolete-market' })]));
    await useToolsStore.getState().hydrateProject('rank-feedback');
    expect(useToolsStore.getState().trackedRanks[0].location).toBe('obsolete-market');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await useToolsStore.getState().refreshAllRanks();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useToolsStore.getState().trackedRanks[0].current_rank).toBe(4);
    expect(useToolsStore.getState().rankError).toBeTruthy();
  });

  it('does not save late rank responses into another project', async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const run = useToolsStore.getState().refreshAllRanks();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    localStorage.setItem('seomi_active_project_v1', 'rank-feedback-two');
    await useToolsStore.getState().hydrateProject('rank-feedback-two');
    finish(response([{ type: 'organic', url: 'https://example.test', rank_absolute: 1 }]));
    await run;
    expect(useToolsStore.getState().trackedRanks).toEqual([]);
    expect(localStorage.getItem('seomi_project_rank-feedback-two_tracked_ranks')).toBeNull();
  });
});

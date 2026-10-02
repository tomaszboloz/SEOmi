import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createKeywordRanksActions } from '@/stores/tools/keywords/ranks';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
const original = useSettingsStore.getState();
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'rank-direct' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
});
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it.each([['example.com', 7, 7], ['docs.example.com', 9, 9], ['example.com.evil.test', 1, 101],
  ['example.com', 120, 101]])('keeps rank evidence for %s at %i', async (domain, rank, expected) => {
  const getSerpCompetitors = vi.fn().mockResolvedValue([{ domain, rank_absolute: rank }]);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordRanksActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getSerpCompetitors }) });
  actions.addTrackedRank('phrase', 'example.com');
  const initial = store.getState().trackedRanks[0];
  store.setState({ trackedRanks: [{ ...initial, current_rank: 4, best_rank: 2 }] });
  await actions.refreshAllRanks();
  expect(getSerpCompetitors).toHaveBeenCalledWith('phrase', 2840, 'en');
  expect(store.getState().trackedRanks[0]).toMatchObject({ current_rank: expected, previous_rank: 4,
    best_rank: 2, delta: 4 - expected, history: [{ rank: expected }] });
  expect(store.getState().isRankLoading).toBe(false);
  expect(store.getState().rankError).toBeNull();
});

it('initializes best rank and bounds history to ninety successful observations', async () => {
  const getSerpCompetitors = vi.fn().mockResolvedValue([{ domain: 'example.com', rank_absolute: 3 }]);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordRanksActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getSerpCompetitors }) });
  actions.addTrackedRank('phrase', 'example.com');
  const initial = store.getState().trackedRanks[0];
  store.setState({ trackedRanks: [{ ...initial, history: Array.from({ length: 90 }, () => ({ date: 'old', rank: 5 })) }] });
  await actions.refreshAllRanks();
  expect(store.getState().trackedRanks[0]).toMatchObject({ current_rank: 3, best_rank: 3, delta: null });
  expect(store.getState().trackedRanks[0].history).toHaveLength(90);
  expect(store.getState().trackedRanks[0].history.at(-1)?.rank).toBe(3);
});

it('preserves failed rows while saving successful rows in a partial refresh', async () => {
  const getSerpCompetitors = vi.fn().mockRejectedValueOnce(new Error('failure')).mockResolvedValue([]);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordRanksActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getSerpCompetitors }) });
  actions.addTrackedRank('success', 'example.com');
  actions.addTrackedRank('failure', 'example.com');
  const failed = store.getState().trackedRanks[0];
  await actions.refreshAllRanks();
  expect(store.getState().trackedRanks[0]).toEqual(failed);
  expect(store.getState().trackedRanks[1]).toMatchObject({ current_rank: 101, best_rank: null });
  expect(store.getState().rankError).toBeTruthy();
  expect(store.getState().isRankLoading).toBe(false);
});

it.each([new Error('client failure'), 'unstructured'])('contains client initialization rejection %s', async error => {
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordRanksActions(set, get, services),
    { createDataForSeoClient: vi.fn(() => { throw error; }) });
  actions.addTrackedRank('phrase', 'example.com');
  const initial = store.getState().trackedRanks;
  await actions.refreshAllRanks();
  expect(store.getState().trackedRanks).toEqual(initial);
  expect(store.getState().rankError).toBeTruthy();
  expect(store.getState().isRankLoading).toBe(false);
});

it('requires credentials before rank refresh', async () => {
  useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
  const createDataForSeoClient = vi.fn();
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordRanksActions(set, get, services), { createDataForSeoClient });
  actions.addTrackedRank('phrase', 'example.com');
  await actions.refreshAllRanks();
  expect(createDataForSeoClient).not.toHaveBeenCalled();
  expect(store.getState().rankError).toBeTruthy();
});

it('does not persist a late rank response into a newly selected project', async () => {
  let finish!: (value: unknown) => void;
  const getSerpCompetitors = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordRanksActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getSerpCompetitors }) });
  actions.addTrackedRank('old', 'example.com');
  const pending = actions.refreshAllRanks();
  useProjectStore.setState({ activeProjectId: 'other' });
  store.setState({ trackedRanks: [], isRankLoading: false });
  finish([{ domain: 'example.com', rank_absolute: 1 }]);
  await pending;
  expect(store.getState().trackedRanks).toEqual([]);
  expect(store.getState().isRankLoading).toBe(false);
  expect(localStorage.getItem('seomi_project_other_tracked_ranks')).toBeNull();
});

it('supports draft, add and remove operations without project persistence', async () => {
  useProjectStore.setState({ activeProjectId: null });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordRanksActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getSerpCompetitors: vi.fn().mockResolvedValue([]) }) });
  actions.setRankTrackingDraft({ keyword: 'draft' });
  actions.addTrackedRank('phrase', 'example.com');
  await actions.refreshAllRanks();
  actions.removeTrackedRank(store.getState().trackedRanks[0].id);
  expect(store.getState().trackedRanks).toEqual([]);
  expect(store.getState().rankTrackingDraft.keyword).toBe('draft');
  expect(localStorage.length).toBe(0);
});

it('ignores a synchronous client error after a project change', async () => {
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordRanksActions(set, get, services),
    { createDataForSeoClient: vi.fn(() => {
      useProjectStore.setState({ activeProjectId: 'new-project' });
      throw new Error('old failure');
    }) });
  actions.addTrackedRank('phrase', 'example.com');
  await actions.refreshAllRanks();
  expect(store.getState().rankError).toBeNull();
});

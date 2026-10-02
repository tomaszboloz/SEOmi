import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBacklinkProfileActions } from '@/stores/tools/backlinks/profile';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { backlinkProfileFixture } from './fixtures/backlinkSlice';
const original = useSettingsStore.getState();
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'profile-direct' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
});
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it('normalizes the target and stores an actual provider profile and history', async () => {
  const getBacklinkProfile = vi.fn().mockResolvedValue(backlinkProfileFixture);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createBacklinkProfileActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getBacklinkProfile }) });
  actions.setBacklinkQuery('  https://example.com/path  ');
  await actions.analyzeBacklinks();
  expect(getBacklinkProfile).toHaveBeenCalledWith('example.com');
  expect(store.getState().backlinkProfile).toEqual(backlinkProfileFixture);
  expect(store.getState().backlinkProfileHistory[0]).toMatchObject({ domain: 'example.com', total_backlinks: 10 });
  expect(store.getState().isBacklinkLoading).toBe(false);
});

it.each(['loadMoreBacklinks', 'loadMoreBacklinkAnchors'] as const)('paginates %s from its own current row count', async method => {
  const page = { items: method === 'loadMoreBacklinks' ? [{ source_url: 'https://source.example' }]
    : [{ anchor: 'fixture', count: 1, percentage: 10 }], totalCount: 2 };
  const getBacklinksPage = vi.fn().mockResolvedValue(page);
  const getBacklinkAnchorsPage = vi.fn().mockResolvedValue(page);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createBacklinkProfileActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getBacklinksPage, getBacklinkAnchorsPage }) });
  store.setState({ backlinkProfile: backlinkProfileFixture });
  await actions[method]();
  if (method === 'loadMoreBacklinks') {
    expect(getBacklinksPage).toHaveBeenCalledWith('example.com', 0);
    expect(store.getState().backlinkProfile?.backlinks).toEqual(page.items);
  } else {
    expect(getBacklinkAnchorsPage).toHaveBeenCalledWith('example.com', 0, 100, 10);
    expect(store.getState().backlinkProfile?.anchors).toEqual(page.items);
  }
  expect(store.getState().isBacklinkLoading).toBe(false);
});

it.each([null, new Error('provider failure')])('contains unavailable profile %s', async response => {
  const getBacklinkProfile = response instanceof Error ? vi.fn().mockRejectedValue(response) : vi.fn().mockResolvedValue(response);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createBacklinkProfileActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getBacklinkProfile }) });
  await actions.analyzeBacklinks('example.com');
  expect(store.getState().backlinkProfile).toBeNull();
  expect(store.getState().backlinkError).toBeTruthy();
  expect(store.getState().isBacklinkLoading).toBe(false);
});

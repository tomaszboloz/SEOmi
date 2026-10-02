import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBacklinksSlice } from '@/stores/tools/backlinksSlice';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { backlinkProfileFixture, backlinkGapFixture, opportunity } from './fixtures/backlinkSlice';
const original = useSettingsStore.getState();
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'backlinks-direct' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
});
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it('rejects projectless backlink-gap analysis before contacting a provider', async () => {
  useProjectStore.setState({ activeProjectId: null });
  const getBacklinkGapPage = vi.fn().mockResolvedValue({ items: [], totalCount: 0 });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createBacklinksSlice(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getBacklinkGapPage }) });
  await actions.analyzeBacklinkGap('example.com', ['other.com']);
  expect(getBacklinkGapPage).not.toHaveBeenCalled();
  expect(store.getState().backlinkGapError).toBeTruthy();
  expect(store.getState().isBacklinkGapLoading).toBe(false);
});

it('deduplicates referring domains within a returned gap page and retains raw scan counts', async () => {
  const getBacklinkGapPage = vi.fn().mockResolvedValue({ items: [
    opportunity('new.example'), opportunity('new.example'), opportunity('old.example'),
  ], totalCount: 10, rawCount: 3 });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createBacklinksSlice(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getBacklinkGapPage }) });
  store.setState({ backlinkGapReport: backlinkGapFixture });
  await actions.loadMoreBacklinkGap();
  expect(store.getState().backlinkGapReport?.opportunities.map(row => row.referring_domain))
    .toEqual(['old.example', 'new.example']);
  expect(store.getState().backlinkGapReport?.rows_scanned).toBe(4);
});

it.each(['loadMoreBacklinks', 'loadMoreBacklinkAnchors', 'loadMoreBacklinkGap'] as const)(
  'rejects projectless pagination through %s', async method => {
    useProjectStore.setState({ activeProjectId: null });
    const createDataForSeoClient = vi.fn().mockReturnValue({
      getBacklinksPage: vi.fn().mockResolvedValue({ items: [], totalCount: 2 }),
      getBacklinkAnchorsPage: vi.fn().mockResolvedValue({ items: [], totalCount: 2 }),
      getBacklinkGapPage: vi.fn().mockResolvedValue({ items: [], totalCount: 10 }),
    });
    const { store, actions } = isolatedToolsSlice((set, get, services) => createBacklinksSlice(set, get, services),
      { createDataForSeoClient });
    store.setState({ backlinkProfile: backlinkProfileFixture, backlinkGapReport: backlinkGapFixture });
    await actions[method]();
    expect(createDataForSeoClient).not.toHaveBeenCalled();
    expect(method === 'loadMoreBacklinkGap' ? store.getState().backlinkGapError : store.getState().backlinkError)
      .toBeTruthy();
    expect(store.getState().isBacklinkLoading).toBe(false);
    expect(store.getState().isBacklinkGapLoading).toBe(false);
  },
);

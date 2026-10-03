import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBacklinksSlice } from '@/stores/tools/backlinksSlice';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { backlinkProfileFixture, backlinkGapFixture } from './fixtures/backlinkSlice';
const methods = ['analyzeBacklinks', 'analyzeBacklinkGap', 'loadMoreBacklinks',
  'loadMoreBacklinkAnchors', 'loadMoreBacklinkGap'] as const;
const original = useSettingsStore.getState();
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'backlink-edges' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
});
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });
const setup = (request = vi.fn()) => {
  const createDataForSeoClient = vi.fn().mockReturnValue({ getBacklinkProfile: request, getBacklinkGapPage: request,
    getBacklinksPage: request, getBacklinkAnchorsPage: request });
  const slice = isolatedToolsSlice((set, get, services) => createBacklinksSlice(set, get, services), { createDataForSeoClient });
  slice.store.setState({ backlinkQuery: 'example.com', backlinkGapCompetitors: ['other.com'],
    backlinkProfile: backlinkProfileFixture, backlinkGapReport: backlinkGapFixture });
  return { ...slice, createDataForSeoClient };
};

it.each(methods)('requires credentials for %s', async method => {
  useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
  const { store, actions, createDataForSeoClient } = setup();
  await actions[method]();
  expect(createDataForSeoClient).not.toHaveBeenCalled();
  expect(method.includes('Gap') ? store.getState().backlinkGapError : store.getState().backlinkError).toBeTruthy();
  expect(store.getState()).toMatchObject({ isBacklinkLoading: false, isBacklinkGapLoading: false });
});

it.each(methods.flatMap(method => [new Error('provider failure'), 'unstructured'].map(error => ({ method, error }))))(
  'contains $method rejection: $error', async ({ method, error }) => {
    const { store, actions } = setup(vi.fn().mockRejectedValue(error));
    await actions[method]();
    expect(method.includes('Gap') ? store.getState().backlinkGapError : store.getState().backlinkError).toBeTruthy();
    expect(store.getState()).toMatchObject({ isBacklinkLoading: false, isBacklinkGapLoading: false });
  },
);

it.each(methods.flatMap(method => [false, true].map(failure => ({ method, failure }))))(
  'rejects late $method evidence after project change (failure=$failure)', async ({ method, failure }) => {
    let finish!: (value: unknown) => void;
    let reject!: (value: unknown) => void;
    const { store, actions } = setup(vi.fn(() => new Promise((resolve, fail) => { finish = resolve; reject = fail; })));
    const pending = actions[method]();
    useProjectStore.setState({ activeProjectId: 'new-project' });
    store.setState({ backlinkProfile: null, backlinkGapReport: null, backlinkError: null, backlinkGapError: null,
      isBacklinkLoading: false, isBacklinkGapLoading: false });
    if (failure) reject(new Error('old failure'));
    else finish(method === 'analyzeBacklinks' ? backlinkProfileFixture : { items: [], totalCount: null });
    await pending;
    expect(store.getState()).toMatchObject({ backlinkProfile: null, backlinkGapReport: null, backlinkError: null,
      backlinkGapError: null, isBacklinkLoading: false, isBacklinkGapLoading: false });
  },
);

it.each(['loadMoreBacklinks', 'loadMoreBacklinkAnchors', 'loadMoreBacklinkGap'] as const)(
  'retains known counts when %s returns an unknown count', async method => {
    const { store, actions } = setup(vi.fn().mockResolvedValue({ items: [], totalCount: null }));
    await actions[method]();
    expect(store.getState().backlinkProfile).toEqual(backlinkProfileFixture);
    expect(store.getState().backlinkGapReport).toEqual(backlinkGapFixture);
  },
);

it.each(['loadMoreBacklinks', 'loadMoreBacklinkAnchors', 'loadMoreBacklinkGap'] as const)(
  'skips %s when there is no report or rows are unavailable, complete or already loading', async method => {
    const { store, actions, createDataForSeoClient } = setup();
    store.setState({ backlinkProfile: null, backlinkGapReport: null });
    await actions[method]();
    store.setState({ backlinkProfile: backlinkProfileFixture, backlinkGapReport: backlinkGapFixture,
      isBacklinkLoading: true, isBacklinkGapLoading: true });
    await actions[method]();
    store.setState({ isBacklinkLoading: false, isBacklinkGapLoading: false,
      backlinkProfile: { ...backlinkProfileFixture, total_anchor_rows: null, total_backlink_rows: null },
      backlinkGapReport: { ...backlinkGapFixture, total_rows: null } });
    await actions[method]();
    store.setState({ backlinkProfile: { ...backlinkProfileFixture, total_anchor_rows: 0, total_backlink_rows: 0 },
      backlinkGapReport: { ...backlinkGapFixture, rows_scanned: 10 } });
    await actions[method]();
    expect(createDataForSeoClient).not.toHaveBeenCalled();
  },
);

it('rejects projectless and empty profile analysis and empty gap analysis', async () => {
  const { actions, store, createDataForSeoClient } = setup();
  useProjectStore.setState({ activeProjectId: null });
  await actions.analyzeBacklinks();
  expect(store.getState().backlinkError).toBeTruthy();
  useProjectStore.setState({ activeProjectId: 'backlink-edges' });
  await actions.analyzeBacklinks('');
  await actions.analyzeBacklinkGap('');
  expect(createDataForSeoClient).not.toHaveBeenCalled();
});

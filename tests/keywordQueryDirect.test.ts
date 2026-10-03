import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createKeywordQueryActions } from '@/stores/tools/keywords/query';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
const original = useSettingsStore.getState();
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'query-direct' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
});
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it('records exact query, market and language evidence from an injected provider', async () => {
  const getKeywordIdeas = vi.fn().mockResolvedValue([{ keyword: 'answer' }]);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordQueryActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getKeywordIdeas }) });
  await actions.searchKeywords(' phrase ', 'PL', 'pl');
  expect(getKeywordIdeas).toHaveBeenCalledWith('phrase', 2616, 'pl');
  expect(store.getState()).toMatchObject({ isKeywordLoading: false, keywordResults: [{ keyword: 'answer' }],
    keywordResultsSource: { seedKeyword: 'phrase', countryCode: 'PL', locationCode: 2616, languageCode: 'pl' } });
  expect(store.getState().keywordResultsSource?.retrievedAt).toMatch(/^\d{4}-/);
});

it.each([new Error('provider failure'), 'unstructured error'])('contains provider rejection %s', async error => {
  const getKeywordIdeas = vi.fn().mockRejectedValue(error);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordQueryActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getKeywordIdeas }) });
  store.setState({ keywordQuery: 'phrase' });
  await actions.searchKeywords();
  expect(store.getState()).toMatchObject({ isKeywordLoading: false, keywordResults: [], keywordResultsSource: null });
  expect(store.getState().keywordError).toBeTruthy();
});

it('rejects missing credentials before contacting a provider', async () => {
  useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
  const createDataForSeoClient = vi.fn();
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordQueryActions(set, get, services), { createDataForSeoClient });
  await actions.searchKeywords('phrase');
  expect(createDataForSeoClient).not.toHaveBeenCalled();
  expect(store.getState().keywordError).toBeTruthy();
});

it.each([false, true])('rejects an old project success or failure (failure=%s)', async failure => {
  let finish!: (value: unknown) => void;
  let reject!: (value: unknown) => void;
  const getKeywordIdeas = vi.fn(() => new Promise((resolve, fail) => { finish = resolve; reject = fail; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordQueryActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getKeywordIdeas }) });
  const pending = actions.searchKeywords('old');
  useProjectStore.setState({ activeProjectId: 'new-project' });
  store.setState({ keywordResults: [], keywordError: null, isKeywordLoading: false });
  if (failure) reject(new Error('old failure')); else finish([{ keyword: 'old' }]);
  await pending;
  expect(store.getState()).toMatchObject({ keywordResults: [], keywordError: null, isKeywordLoading: false });
});

it('rejects a superseded request within the same project', async () => {
  let finish!: (value: unknown) => void;
  const getKeywordIdeas = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue([{ keyword: 'new' }]);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordQueryActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getKeywordIdeas }) });
  const old = actions.searchKeywords('old');
  await actions.searchKeywords('new');
  finish([{ keyword: 'old' }]);
  await old;
  expect(store.getState().keywordResults).toEqual([{ keyword: 'new' }]);
});

it('keeps setters usable without a selected project while leaving storage empty', () => {
  useProjectStore.setState({ activeProjectId: null });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordQueryActions(set, get, services));
  actions.setKeywordCountry('PL');
  actions.setKeywordLanguage('pl');
  actions.setKeywordQuery('  phrase ');
  expect(store.getState()).toMatchObject({ keywordQuery: 'phrase', keywordCountry: 'PL', keywordLanguage: 'pl' });
  expect(localStorage.length).toBe(0);
});

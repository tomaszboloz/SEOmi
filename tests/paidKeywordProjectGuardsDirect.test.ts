import { afterEach, expect, it, vi } from 'vitest';
import { createKeywordQueryActions } from '@/stores/tools/keywords/query';
import { createKeywordRanksActions } from '@/stores/tools/keywords/ranks';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import i18n from '@/i18n';
const original = useSettingsStore.getState();
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it('requires a project before a paid keyword search', async () => {
  localStorage.clear(); useProjectStore.setState({ activeProjectId: null });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
  const createDataForSeoClient = vi.fn().mockReturnValue({ getKeywordIdeas: vi.fn().mockResolvedValue([]) });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordQueryActions(set, get, services),
    { createDataForSeoClient });
  await actions.searchKeywords('phrase');
  expect(createDataForSeoClient).not.toHaveBeenCalled();
  expect(store.getState().keywordError).toBe(i18n.t('runtimeErrors.tools.projectRequired'));
  expect(store.getState().isKeywordLoading).toBe(false);
});

it('requires a project before paid SERP rank refresh', async () => {
  localStorage.clear(); useProjectStore.setState({ activeProjectId: null });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
  const createDataForSeoClient = vi.fn().mockReturnValue({ getSerpCompetitors: vi.fn().mockResolvedValue([]) });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createKeywordRanksActions(set, get, services),
    { createDataForSeoClient });
  actions.addTrackedRank('phrase', 'example.com', '', 'US');
  await actions.refreshAllRanks();
  expect(createDataForSeoClient).not.toHaveBeenCalled();
  expect(store.getState().rankError).toBe(i18n.t('runtimeErrors.tools.projectRequired'));
  expect(store.getState().isRankLoading).toBe(false);
  expect(store.getState().trackedRanks[0].history).toEqual([]);
});

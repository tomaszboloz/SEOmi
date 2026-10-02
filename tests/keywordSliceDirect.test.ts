import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createKeywordSlice } from '@/stores/tools/keywordSlice';
import { useProjectStore } from '@/stores/projectStore';
import { toolsServices } from '@/stores/tools/services';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createKeywordQueryActions } from '@/stores/tools/keywords/query';
import { createKeywordRanksActions } from '@/stores/tools/keywords/ranks';
import { createKeywordSavedActions } from '@/stores/tools/keywords/saved';

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'direct-keyword' });
});
afterEach(() => vi.restoreAllMocks());

const setup = () => isolatedToolsSlice((set, get, services) => createKeywordSlice(set, get, services));

it('assigns distinct rank identities even when additions share a millisecond', () => {
  vi.spyOn(Date, 'now').mockReturnValue(12345);
  const { store, actions } = setup();
  actions.addTrackedRank('first', 'https://example.com/path');
  actions.addTrackedRank('second', 'example.com');
  const ranks = store.getState().trackedRanks;
  expect(new Set(ranks.map(rank => rank.id)).size).toBe(2);
  actions.removeTrackedRank(ranks[0].id);
  expect(store.getState().trackedRanks.map(rank => rank.keyword)).toEqual(['first']);
});

it('exposes query, market, language, filters and persisted draft actions directly', () => {
  const { store, actions } = setup();
  actions.setKeywordQuery('  fixture phrase  ');
  actions.setKeywordCountry('PL');
  actions.setKeywordLanguage('pl');
  actions.setSelectedTagFilter('important');
  actions.setRankTrackingDraft({ keyword: 'phrase', domain: 'example.com', location: 'PL' });
  expect(store.getState()).toMatchObject({ keywordQuery: 'fixture phrase', keywordCountry: 'PL',
    keywordLanguage: 'pl', domainCountry: 'PL', domainLanguage: 'pl', selectedTagFilter: 'important',
    rankTrackingDraft: { keyword: 'phrase', domain: 'example.com', location: 'PL', language: 'pl' } });
  actions.setKeywordCountry('invalid');
  expect(store.getState().keywordCountry).toBe('PL');
  actions.setRankTrackingDraft({ location: 'invalid' });
  expect(store.getState().rankTrackingDraft.location).toBe('PL');
});

it('contains empty query and empty rank refresh without provider calls', async () => {
  const spy = vi.spyOn(toolsServices, 'createDataForSeoClient');
  const { store, actions } = setup();
  await actions.searchKeywords('   ');
  await actions.refreshAllRanks();
  expect(spy).not.toHaveBeenCalled();
  expect(store.getState().rankError).toBeTruthy();
  expect(store.getState().isKeywordLoading).toBe(false);
});

it('exposes extracted query and rank factories with independent action state', () => {
  const query = isolatedToolsSlice((set, get, services) => createKeywordQueryActions(set, get, services));
  query.actions.setKeywordQuery('isolated');
  expect(query.store.getState().keywordQuery).toBe('isolated');
  const ranks = isolatedToolsSlice((set, get, services) => createKeywordRanksActions(set, get, services));
  ranks.actions.addTrackedRank('direct', 'EXAMPLE.COM', 'https://example.com/page', 'PL', 'pl');
  expect(ranks.store.getState().trackedRanks[0]).toMatchObject({ keyword: 'direct', domain: 'example.com',
    target_url: 'https://example.com/page', location: 'PL', language_code: 'pl', current_rank: null });
});

it('adds, deduplicates, tags and deletes saved keyword identities through its direct factory', () => {
  const { store, actions } = isolatedToolsSlice((set, get) => createKeywordSavedActions(set, get));
  const item = { keyword: 'fixture', search_volume: 10, difficulty: 20, cpc: 1,
    intent: 'Informational' as const, tags: ['before'] };
  actions.addSavedKeyword(item);
  actions.addSavedKeyword({ ...item, keyword: 'FIXTURE' });
  expect(store.getState().savedKeywords).toHaveLength(1);
  const id = store.getState().savedKeywords[0].id;
  actions.updateKeywordTags('missing', ['ignored']);
  actions.updateKeywordTags(id, ['after']);
  expect(store.getState().savedKeywords[0].tags).toEqual(['after']);
  expect(localStorage.getItem('seomi_project_direct-keyword_saved_keywords')).toContain('after');
  actions.removeSavedKeyword(id);
  expect(store.getState().savedKeywords).toEqual([]);
});

it('does not persist saved keyword changes without an active project', () => {
  useProjectStore.setState({ activeProjectId: null });
  const { store, actions } = isolatedToolsSlice((set, get) => createKeywordSavedActions(set, get));
  actions.addSavedKeyword({ keyword: 'local', search_volume: 1, difficulty: 1, cpc: 1,
    intent: 'Informational', tags: [] });
  const id = store.getState().savedKeywords[0].id;
  actions.updateKeywordTags(id, ['local']);
  actions.removeSavedKeyword(id);
  expect(store.getState().savedKeywords).toEqual([]);
  expect(localStorage.length).toBe(0);
});

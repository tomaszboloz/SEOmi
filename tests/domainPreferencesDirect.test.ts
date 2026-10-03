import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDomainPreferences } from '@/stores/tools/domain/preferences';
import { useProjectStore } from '@/stores/projectStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'domain-preferences' }); });
afterEach(() => vi.restoreAllMocks());

it('persists the exact trimmed query in the current project', () => {
  const { store, actions } = isolatedToolsSlice((set, get) => createDomainPreferences(set, get));
  actions.setDomainQuery('  https://example.com/path  ');
  expect(store.getState().domainQuery).toBe('https://example.com/path');
  expect(localStorage.getItem('seomi_project_domain-preferences_domain_query_v1')).toBe('https://example.com/path');
});

it('synchronizes domain, keyword and rank draft market/language preferences', () => {
  const { store, actions } = isolatedToolsSlice((set, get) => createDomainPreferences(set, get));
  actions.setDomainCountry('PL');
  expect(store.getState()).toMatchObject({ domainCountry: 'PL', keywordCountry: 'PL',
    domainLanguage: 'pl', keywordLanguage: 'pl', rankTrackingDraft: { location: 'PL', language: 'pl' } });
  actions.setDomainLanguage('pl');
  expect(store.getState()).toMatchObject({ domainLanguage: 'pl', keywordLanguage: 'pl' });
  expect(localStorage.getItem('seomi_project_domain-preferences_keyword_language_v1')).toBe('pl');
  expect(localStorage.getItem('seomi_project_domain-preferences_dataforseo_market_v1')).toBe('PL');
});

it('ignores unsupported markets without changing state or writing preferences', () => {
  const { store, actions } = isolatedToolsSlice((set, get) => createDomainPreferences(set, get));
  const previous = store.getState();
  actions.setDomainCountry('invalid');
  expect(store.getState()).toBe(previous);
  expect(localStorage.length).toBe(0);
});

it('deduplicates trimmed targets and bounds saved competitors to five', () => {
  const { store, actions } = isolatedToolsSlice((set, get) => createDomainPreferences(set, get));
  actions.setDomainComparisonTargets([' a ', 'a', '', 'b', 'c', 'd', 'e', 'f']);
  expect(store.getState().domainComparisonTargets).toEqual(['a', 'b', 'c', 'd', 'e']);
  expect(JSON.parse(localStorage.getItem('seomi_project_domain-preferences_domain_comparison_targets_v1') || '[]'))
    .toEqual(['a', 'b', 'c', 'd', 'e']);
});

it('keeps all preferences usable without a project while leaving storage empty', () => {
  useProjectStore.setState({ activeProjectId: null });
  const { store, actions } = isolatedToolsSlice((set, get) => createDomainPreferences(set, get));
  actions.setDomainQuery(' example.com ');
  actions.setDomainCountry('PL');
  actions.setDomainLanguage('pl');
  actions.setDomainComparisonTargets([' other.example ']);
  expect(store.getState()).toMatchObject({ domainQuery: 'example.com', domainCountry: 'PL',
    domainLanguage: 'pl', domainComparisonTargets: ['other.example'] });
  expect(localStorage.length).toBe(0);
});

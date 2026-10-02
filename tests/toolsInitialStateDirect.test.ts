import { beforeEach, expect, it } from 'vitest';
import { createToolsInitialState } from '@/stores/tools/initialState';
import { useProjectStore } from '@/stores/projectStore';
import { DEFAULT_CRAWL_CONFIG } from '@/stores/tools/crawlPersistence';

beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: null }); });

it('returns empty evidence, independent collections and default markets without a project', () => {
  const first = createToolsInitialState();
  const second = createToolsInitialState();
  expect(first).toMatchObject({ keywordCountry: 'US', keywordLanguage: 'en', domainCountry: 'US',
    domainLanguage: 'en', keywordResults: [], keywordResultsSource: null, domainOverview: null,
    backlinkProfile: null, aiBrandReport: null, aiPromptComparison: null, gscData: null, crawlResult: null });
  expect(first.savedKeywords).not.toBe(second.savedKeywords);
  expect(first.trackedRanks).not.toBe(second.trackedRanks);
  expect(first.aiResearchSettings).not.toBe(second.aiResearchSettings);
});

it('does not share mutable crawl configuration with another store or the defaults', () => {
  const first = createToolsInitialState();
  const second = createToolsInitialState();
  expect(first.crawlConfig).not.toBe(second.crawlConfig);
  expect(first.crawlConfig).not.toBe(DEFAULT_CRAWL_CONFIG);
  expect(first.crawlConfig.includePatterns).not.toBe(second.crawlConfig.includePatterns);
  first.crawlConfig.includePatterns.push('/fixture');
  expect(second.crawlConfig.includePatterns).toEqual([]);
  expect(DEFAULT_CRAWL_CONFIG.includePatterns).toEqual([]);
});

it('loads only preferences owned by the selected project', () => {
  useProjectStore.setState({ activeProjectId: 'initial-direct' });
  localStorage.setItem('seomi_project_initial-direct_keyword_query_v1', 'own phrase');
  localStorage.setItem('seomi_project_other_keyword_query_v1', 'other phrase');
  const state = createToolsInitialState();
  expect(state.keywordQuery).toBe('own phrase');
  expect(state.keywordResults).toEqual([]);
  expect(state.isKeywordLoading).toBe(false);
});

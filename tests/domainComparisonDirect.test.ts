import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDomainComparisonActions } from '@/stores/tools/domain/comparison';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { domainOverviewFixture } from './fixtures/domainSlice';
import * as dataForSeo from '@/services/dataforseo';
const original = useSettingsStore.getState();
beforeEach(() => {
  localStorage.clear(); useProjectStore.setState({ activeProjectId: 'domain-comparison' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
});
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it('preserves factual metrics, bounds samples and writes project comparison history', async () => {
  const response = domainOverviewFixture();
  response.top_keywords = Array.from({ length: 12 }, () => ({ keyword: 'phrase', position: 0,
    search_volume: null, traffic_share: null, intent: null }));
  response.top_pages = Array.from({ length: 12 }, () => ({ url: 'https://example.com', traffic_percentage: 0, keywords_count: null }));
  response.competitors = Array.from({ length: 12 }, () => ({ domain: 'other.example', common_keywords: 0, average_position: null }));
  const getDomainOverview = vi.fn().mockResolvedValue(response);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainComparisonActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  store.setState({ domainOverview: response });
  await actions.compareDomains(['https://example.com', 'other.example'], 'PL', 'pl');
  expect(getDomainOverview.mock.calls).toEqual([['example.com', 2616, 'pl'], ['other.example', 2616, 'pl']]);
  const comparison = store.getState().domainComparison;
  expect(comparison).toMatchObject({ target: 'example.com', location_code: 2616, language_code: 'pl', source: 'dataforseo' });
  expect(comparison?.rows[0]).toMatchObject({ organic_traffic: 0, organic_keywords: null, total_backlinks: null, dofollow_ratio: null });
  expect(comparison?.rows[0].top_keywords).toHaveLength(10);
  expect(comparison?.rows[0].top_pages).toHaveLength(10);
  expect(comparison?.rows[0].competitors).toHaveLength(10);
  expect(store.getState().domainComparisonHistory).toEqual([comparison]);
  expect(store.getState().domainComparisonError).toBeNull();
  expect(store.getState().isDomainComparisonLoading).toBe(false);
});

it('uses saved competitor targets with the current query and deduplicates domains', async () => {
  const getDomainOverview = vi.fn().mockResolvedValue(domainOverviewFixture());
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainComparisonActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  store.setState({ domainQuery: 'example.com', domainComparisonTargets: [' other.example ', 'example.com', ''] });
  await actions.compareDomains();
  expect(getDomainOverview.mock.calls).toEqual([['example.com', 2840, 'en'], ['other.example', 2840, 'en']]);
});

it.each(['target', 'count', 'project', 'market', 'credentials'] as const)(
  'rejects invalid %s before a paid provider request', async kind => {
  const createDataForSeoClient = vi.fn();
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainComparisonActions(set, get, services),
    { createDataForSeoClient });
  if (kind === 'project') useProjectStore.setState({ activeProjectId: null });
  if (kind === 'credentials') useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
  const targets = kind === 'target' ? ['example.com', 'invalid target']
    : kind === 'count' ? ['example.com'] : ['example.com', 'other.example'];
  await actions.compareDomains(targets, kind === 'market' ? 'invalid' : undefined);
  expect(createDataForSeoClient).not.toHaveBeenCalled();
  expect(store.getState().domainComparisonError).toBeTruthy();
  expect(store.getState().domainComparison).toBeNull();
});

it.each([null, new Error('provider failed'), 'unstructured failure'])('contains a completely unavailable comparison %s', async response => {
  const getDomainOverview = response === null ? vi.fn().mockResolvedValue(null) : vi.fn().mockRejectedValue(response);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainComparisonActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  await actions.compareDomains(['example.com', 'other.example']);
  expect(store.getState()).toMatchObject({ domainComparison: null, isDomainComparisonLoading: false });
  expect(store.getState().domainComparisonError).toBeTruthy();
});

it('contains an unstructured target normalization failure without provider access', async () => {
  vi.spyOn(dataForSeo, 'normalizeDataForSeoDomain').mockImplementation(() => { throw 'invalid domain'; });
  const createDataForSeoClient = vi.fn();
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainComparisonActions(set, get, services),
    { createDataForSeoClient });
  await actions.compareDomains(['example.com', 'other.example']);
  expect(createDataForSeoClient).not.toHaveBeenCalled();
  expect(store.getState().domainComparisonError).toBeTruthy();
});

it('contains an unstructured provider setup error and releases loading state', async () => {
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainComparisonActions(set, get, services),
    { createDataForSeoClient: () => { throw 'client unavailable'; } });
  await actions.compareDomains(['example.com', 'other.example']);
  expect(store.getState().isDomainComparisonLoading).toBe(false);
  expect(store.getState().domainComparisonError).toBeTruthy();
});

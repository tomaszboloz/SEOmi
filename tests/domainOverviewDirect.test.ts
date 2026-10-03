import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDomainOverviewActions } from '@/stores/tools/domain/overview';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { domainOverviewFixture } from './fixtures/domainSlice';
const original = useSettingsStore.getState();
beforeEach(() => {
  localStorage.clear(); useProjectStore.setState({ activeProjectId: 'domain-overview' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
});
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it('normalizes a provided URL and preserves actual zero/null metrics and requested market', async () => {
  const response = domainOverviewFixture();
  const getDomainOverview = vi.fn().mockResolvedValue(response);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainOverviewActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  await actions.analyzeDomain(' https://example.com/path ', 'PL', 'pl');
  expect(getDomainOverview).toHaveBeenCalledWith('example.com', 2616, 'pl');
  expect(store.getState()).toMatchObject({ domainOverview: response, isDomainLoading: false, domainError: null });
  expect(JSON.parse(localStorage.getItem('seomi_project_domain-overview_domain_overview_v1') || 'null')).toEqual(response);
});

it('uses current query and ignores empty targets before contacting a provider', async () => {
  const getDomainOverview = vi.fn().mockResolvedValue(domainOverviewFixture());
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainOverviewActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  await actions.analyzeDomain();
  expect(getDomainOverview).not.toHaveBeenCalled();
  store.setState({ domainQuery: 'example.com' });
  await actions.analyzeDomain();
  expect(getDomainOverview).toHaveBeenCalledWith('example.com', 2840, 'en');
});

it.each([null, new Error('provider failed'), 'unstructured failure'])('contains unavailable response %s', async response => {
  const getDomainOverview = response === null ? vi.fn().mockResolvedValue(null) : vi.fn().mockRejectedValue(response);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainOverviewActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  await actions.analyzeDomain('example.com');
  expect(store.getState().domainOverview).toBeNull();
  expect(store.getState().isDomainLoading).toBe(false);
  expect(store.getState().domainError).toBeTruthy();
});

it.each(['credentials', 'market'] as const)('rejects missing %s before provider access', async kind => {
  if (kind === 'credentials') useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
  const createDataForSeoClient = vi.fn();
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainOverviewActions(set, get, services),
    { createDataForSeoClient });
  await actions.analyzeDomain('example.com', kind === 'market' ? 'invalid' : undefined);
  expect(createDataForSeoClient).not.toHaveBeenCalled();
  expect(store.getState().domainError).toBeTruthy();
});

it.each([false, true])('ignores old-project success/failure (failure=%s)', async failure => {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const getDomainOverview = vi.fn(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainOverviewActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  const pending = actions.analyzeDomain('old.example');
  useProjectStore.setState({ activeProjectId: 'other' });
  store.setState({ domainError: null, domainOverview: null, isDomainLoading: false });
  if (failure) reject(new Error('old error')); else resolve(domainOverviewFixture('old.example'));
  await pending;
  expect(store.getState()).toMatchObject({ domainOverview: null, domainError: null, isDomainLoading: false });
  expect(localStorage.getItem('seomi_project_other_domain_overview_v1')).toBeNull();
});

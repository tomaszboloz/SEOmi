import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDomainSlice } from '@/stores/tools/domainSlice';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { domainOverviewFixture } from './fixtures/domainSlice';
const original = useSettingsStore.getState();
beforeEach(() => {
  localStorage.clear(); useProjectStore.setState({ activeProjectId: 'domain-async' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
});
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it.each([false, true])('ignores a superseded overview success/error (failure=%s)', async failure => {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const getDomainOverview = vi.fn().mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }))
    .mockResolvedValue(domainOverviewFixture('new.example'));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainSlice(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  const pending = actions.analyzeDomain('old.example');
  await actions.analyzeDomain('new.example');
  if (failure) reject(new Error('old error')); else resolve(domainOverviewFixture('old.example'));
  await pending;
  expect(store.getState()).toMatchObject({ domainOverview: domainOverviewFixture('new.example'), domainError: null });
});

it.each([false, true])('ignores comparison success/failure from another project (failure=%s)', async failure => {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const getDomainOverview = vi.fn(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainSlice(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  // The target and competitor share one pending provider response, so both
  // requests settle together without introducing an unresolved test promise.
  const response = new Promise((yes, no) => { resolve = yes; reject = no; });
  getDomainOverview.mockImplementation(() => response);
  const pending = actions.compareDomains(['example.com', 'other.example']);
  useProjectStore.setState({ activeProjectId: 'other-project' });
  store.setState({ domainComparison: null, domainComparisonError: null, isDomainComparisonLoading: false });
  if (failure) reject(new Error('old error')); else resolve(domainOverviewFixture());
  await pending;
  expect(store.getState()).toMatchObject({ domainComparison: null, domainComparisonError: null, isDomainComparisonLoading: false });
  expect(localStorage.getItem('seomi_project_other-project_domain_comparison_v1')).toBeNull();
});

it.each([false, true])('ignores superseded comparison success/failure (failure=%s)', async failure => {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const response = new Promise((yes, no) => { resolve = yes; reject = no; });
  const getDomainOverview = vi.fn().mockReturnValueOnce(response).mockReturnValueOnce(response)
    .mockResolvedValue(domainOverviewFixture('new.example'));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainSlice(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  const pending = actions.compareDomains(['example.com', 'old.example']);
  await actions.compareDomains(['example.com', 'new.example']);
  if (failure) reject(new Error('old error')); else resolve(domainOverviewFixture());
  await pending;
  expect(store.getState().domainComparisonTargets).toEqual(['example.com', 'new.example']);
  expect(store.getState().domainComparison?.rows[1].domain).toBe('new.example');
  expect(store.getState().domainComparisonError).toBeNull();
});

it('keeps successful metrics from a partially rejected comparison', async () => {
  const getDomainOverview = vi.fn().mockResolvedValueOnce({ ...domainOverviewFixture(), total_backlinks: 0, dofollow_ratio: 0 })
    .mockRejectedValueOnce(new Error('provider failed'));
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainSlice(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  await actions.compareDomains(['example.com', 'other.example']);
  expect(store.getState().domainComparison?.rows).toHaveLength(1);
  expect(store.getState().domainComparison?.rows[0]).toMatchObject({ total_backlinks: 0, dofollow_ratio: 0 });
  expect(store.getState().domainComparisonError).toBeTruthy();
});

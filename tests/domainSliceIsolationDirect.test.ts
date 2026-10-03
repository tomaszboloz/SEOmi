import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDomainSlice } from '@/stores/tools/domainSlice';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import i18n from '@/i18n';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { domainOverviewFixture } from './fixtures/domainSlice';

const original = useSettingsStore.getState();
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'domain-direct' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
});
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it('requires a selected project before issuing a paid domain overview request', async () => {
  useProjectStore.setState({ activeProjectId: null });
  const createDataForSeoClient = vi.fn().mockReturnValue({ getDomainOverview: vi.fn().mockResolvedValue(domainOverviewFixture()) });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainSlice(set, get, services), { createDataForSeoClient });
  await actions.analyzeDomain('example.com');
  expect(createDataForSeoClient).not.toHaveBeenCalled();
  expect(store.getState().domainError).toBe(i18n.t('runtimeErrors.tools.projectRequired'));
  expect(store.getState().isDomainLoading).toBe(false);
});

it('reports a fulfilled empty provider row as incomplete comparison evidence', async () => {
  const getDomainOverview = vi.fn().mockResolvedValueOnce(domainOverviewFixture()).mockResolvedValueOnce(null);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createDomainSlice(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getDomainOverview }) });
  await actions.compareDomains(['example.com', 'missing.example']);
  expect(store.getState().domainComparison?.rows).toHaveLength(1);
  expect(store.getState().domainComparisonError)
    .toBe(i18n.t('runtimeErrors.tools.comparisonPartial', { rows: 1, total: 2, failed: 1 }));
});

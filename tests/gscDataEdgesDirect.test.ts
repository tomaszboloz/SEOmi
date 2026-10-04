import { expect, it } from 'vitest';
import i18n from '@/i18n';
import { useProjectStore } from '@/stores/projectStore';
import { gscSliceFixture, deferred } from './fixtures/gscSliceDirect';
import { gscData } from './fixtures/gscTracker';

it('normalizes and stores project filters and clears owned evidence without global persistence', () => {
  const { actions, store } = gscSliceFixture();
  store.setState({ gscData: gscData(), gscDataFetchedAt: 'old', gscError: 'old', isGscLoading: true });
  actions.setGscFilters({ search_type: 'image', device: 'DESKTOP', country: ' USA-extra ' });
  expect(store.getState()).toMatchObject({ gscFilters: { search_type: 'image', device: 'DESKTOP', country: 'usa' }, gscData: null, gscDataFetchedAt: null, gscError: null, isGscLoading: false });
  expect(localStorage.getItem('seomi_gsc_filters_gsc-direct_v1')).toBe(JSON.stringify({ search_type: 'image', device: 'DESKTOP', country: 'usa' }));
  useProjectStore.setState({ activeProjectId: null });
  localStorage.clear();
  actions.setGscFilters({ country: '  ' });
  actions.setGscProperty('sc-domain:local.test');
  expect(store.getState()).toMatchObject({ gscFilters: {}, gscProperty: 'sc-domain:local.test', gscInspectionResult: null });
  expect(localStorage.length).toBe(0);
});

it.each(['project', 'connection', 'property'] as const)('guards data and inspection when %s is absent', async (missing) => {
  const { actions, store, invoke } = gscSliceFixture();
  if (missing === 'project') useProjectStore.setState({ activeProjectId: null });
  if (missing === 'connection') store.setState({ isGscConnected: false });
  if (missing === 'property') store.setState({ gscProperty: '' });
  await actions.refreshGscData();
  expect(store.getState().gscError).toBe(i18n.t('runtimeErrors.tools.gscNeedPropertyData'));
  await actions.inspectGscUrl('https://example.com');
  expect(store.getState().gscError).toBe(i18n.t('runtimeErrors.tools.gscNeedPropertyInspect'));
  expect(invoke).not.toHaveBeenCalled();
});

it('forwards explicit filter/date ownership and trims the inspected URL', async () => {
  const { actions, store, invoke } = gscSliceFixture();
  const filters = { search_type: 'image' as const, country: 'pol' };
  store.setState({ gscFilters: { device: 'MOBILE' } });
  invoke.mockResolvedValueOnce(gscData()).mockResolvedValueOnce({ owned: true });
  await actions.refreshGscData({ startDate: '2026-07-01', endDate: '2026-07-28' }, filters);
  expect(invoke).toHaveBeenNthCalledWith(1, 'search_console_performance', { projectId: 'gsc-direct', clientId: 'client', siteUrl: 'sc-domain:example.com', startDate: '2026-07-01', endDate: '2026-07-28', filters });
  expect(store.getState().gscData).toEqual(gscData());
  expect(store.getState().gscDataFetchedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  await actions.inspectGscUrl(' https://example.com/page ');
  expect(invoke).toHaveBeenNthCalledWith(2, 'inspect_search_console_url', { projectId: 'gsc-direct', clientId: 'client', siteUrl: 'sc-domain:example.com', inspectionUrl: 'https://example.com/page' });
  expect(store.getState()).toMatchObject({ gscInspectionResult: { owned: true }, isGscLoading: false, gscError: null });
});

it.each(['data', 'inspection'] as const)('%s reports current Error and fallback failures without synthetic results', async (kind) => {
  for (const error of [new Error('Current failure'), 'untrusted failure']) {
    const { actions, store, invoke } = gscSliceFixture();
    invoke.mockRejectedValue(error);
    if (kind === 'data') await actions.refreshGscData();
    else await actions.inspectGscUrl('https://example.com');
    expect(store.getState()).toMatchObject({ gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, isGscLoading: false, gscError: error instanceof Error ? error.message : i18n.t(`runtimeErrors.tools.${kind === 'data' ? 'gscDataFailed' : 'gscInspectFailed'}`) });
  }
});

it.each(['data', 'inspection'] as const)('%s does not apply success or failure from another project', async (kind) => {
  for (const fail of [false, true]) {
    const { actions, store, invoke } = gscSliceFixture();
    const response = deferred<unknown>();
    invoke.mockReturnValue(response.promise);
    const pending = kind === 'data' ? actions.refreshGscData() : actions.inspectGscUrl('https://example.com');
    useProjectStore.setState({ activeProjectId: 'other' });
    store.setState({ gscError: 'Owned error', isGscLoading: true });
    if (fail) response.reject(new Error('Stale error'));
    else response.resolve(kind === 'data' ? gscData() : { stale: true });
    await pending;
    expect(store.getState()).toMatchObject({ gscData: null, gscInspectionResult: null, gscError: 'Owned error', isGscLoading: true });
  }
});

it.each(['data', 'inspection'] as const)('%s ignores superseded success and failure including loading cleanup', async (kind) => {
  for (const fail of [false, true]) {
    const { actions, store, invoke } = gscSliceFixture();
    const old = deferred<unknown>();
    const current = deferred<unknown>();
    invoke.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const start = () => kind === 'data' ? actions.refreshGscData() : actions.inspectGscUrl('https://example.com');
    const pending = start();
    const latest = start();
    if (fail) old.reject(new Error('Stale error'));
    else old.resolve(kind === 'data' ? gscData({ total_clicks: 1 }) : { stale: true });
    await pending;
    expect(store.getState()).toMatchObject({ gscData: null, gscInspectionResult: null, isGscLoading: true, gscError: null });
    current.resolve(kind === 'data' ? gscData({ total_clicks: 99 }) : { fresh: true });
    await latest;
    expect(store.getState().isGscLoading).toBe(false);
    if (kind === 'data') expect(store.getState().gscData?.total_clicks).toBe(99);
    else expect(store.getState().gscInspectionResult).toEqual({ fresh: true });
  }
});

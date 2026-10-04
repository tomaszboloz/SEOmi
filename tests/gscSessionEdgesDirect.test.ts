import { expect, it } from 'vitest';
import i18n from '@/i18n';
import { useProjectStore } from '@/stores/projectStore';
import { gscSliceFixture, deferred } from './fixtures/gscSliceDirect';
import { gscData } from './fixtures/gscTracker';

it('guards session actions without a project or client without invoking native commands', async () => {
  const { actions, store, invoke } = gscSliceFixture();
  useProjectStore.setState({ activeProjectId: null });
  await actions.resumeGsc();
  await actions.disconnectGsc();
  await actions.connectGsc('client');
  expect(store.getState().gscError).toBe(i18n.t('runtimeErrors.tools.gscProject'));
  expect(invoke).not.toHaveBeenCalled();
  useProjectStore.setState({ activeProjectId: 'gsc-direct' });
  store.setState({ gscClientId: ' ' });
  await actions.resumeGsc();
  await actions.connectGsc(' ');
  expect(store.getState().gscError).toBe(i18n.t('runtimeErrors.tools.gscClientId'));
  expect(invoke).not.toHaveBeenCalled();
});

it.each(['resume', 'connect'] as const)('%s preserves an accessible selection, falls back to first property or returns empty evidence', async (kind) => {
  for (const properties of [
    [{ siteUrl: 'sc-domain:other.test', permissionLevel: 'siteOwner' }, { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteFullUser' }],
    [{ siteUrl: 'sc-domain:other.test', permissionLevel: 'siteOwner' }], [],
  ]) {
    const { actions, store, invoke } = gscSliceFixture();
    invoke.mockResolvedValue(properties);
    if (kind === 'resume') await actions.resumeGsc();
    else await actions.connectGsc(' client ');
    const expected = properties.length === 2 ? 'sc-domain:example.com' : properties[0]?.siteUrl || '';
    expect(store.getState()).toMatchObject({ isGscConnected: true, gscProperty: expected, gscProperties: properties, isGscLoading: false, gscError: null });
    expect(localStorage.getItem('seomi_gsc_property_gsc-direct')).toBe(expected || null);
    expect(invoke).toHaveBeenCalledWith(kind === 'resume' ? 'list_search_console_properties' : 'connect_search_console', { projectId: 'gsc-direct', clientId: 'client' });
  }
});

it('connect normalizes explicit and fallback secrets and clears existing inspection', async () => {
  for (const [input, stored, expected] of [[' explicit ', 'saved', 'explicit'], [' ', ' saved ', 'saved'], [undefined, '', '']] as const) {
    const { actions, store, invoke } = gscSliceFixture();
    store.setState({ gscClientSecret: stored, gscInspectionResult: { stale: true } });
    invoke.mockResolvedValue([]);
    await actions.connectGsc(' client ', input);
    expect(invoke).toHaveBeenCalledWith('connect_search_console', { projectId: 'gsc-direct', clientId: 'client', ...(expected ? { clientSecret: expected } : {}) });
    expect(store.getState()).toMatchObject({ gscClientId: 'client', gscClientSecret: expected, gscInspectionResult: null, isGscLoading: false });
    expect(localStorage.getItem('seomi_gsc_client_id_gsc-direct')).toBe('client');
  }
});

it.each(['resume', 'connect', 'disconnect'] as const)('%s reports current Error/string/fallback failures without invented data', async (kind) => {
  for (const error of [new Error('Current failure'), 'String failure', {}]) {
    const { actions, store, invoke } = gscSliceFixture();
    invoke.mockRejectedValue(error);
    if (kind === 'resume') await actions.resumeGsc();
    else if (kind === 'connect') await actions.connectGsc('client');
    else await actions.disconnectGsc();
    const fallback = kind === 'resume' ? 'gscResumeFailed' : kind === 'connect' ? 'gscConnectFailed' : 'gscDisconnectFailed';
    expect(store.getState()).toMatchObject({ isGscLoading: false, gscData: null, gscInspectionResult: null, gscError: error instanceof Error ? error.message : typeof error === 'string' ? error : i18n.t(`runtimeErrors.tools.${fallback}`) });
    if (kind !== 'disconnect') expect(store.getState().isGscConnected).toBe(false);
  }
});

it.each(['resume', 'connect', 'disconnect'] as const)('%s does not mutate another project after native success or failure', async (kind) => {
  for (const fail of [false, true]) {
    const { actions, store, invoke } = gscSliceFixture();
    const response = deferred<unknown>();
    invoke.mockReturnValue(response.promise);
    const pending = kind === 'resume' ? actions.resumeGsc() : kind === 'connect' ? actions.connectGsc('client') : actions.disconnectGsc();
    useProjectStore.setState({ activeProjectId: 'other-project' });
    store.setState({ gscProperty: 'other', gscError: 'Owned error', isGscLoading: true });
    if (fail) response.reject(new Error('Stale failure'));
    else response.resolve(kind === 'disconnect' ? 'Revoked' : [{ siteUrl: 'sc-domain:stale.test' }]);
    await pending;
    expect(store.getState()).toMatchObject({ gscProperty: 'other', gscError: 'Owned error', isGscLoading: true });
    expect(localStorage.getItem('seomi_gsc_property_other-project')).toBeNull();
  }
});

it.each(['resume', 'connect', 'disconnect'] as const)('%s ignores superseded session success and failure cleanup', async (kind) => {
  for (const fail of [false, true]) {
    const { actions, store, invoke } = gscSliceFixture();
    const old = deferred<unknown>();
    invoke.mockReturnValueOnce(old.promise).mockResolvedValueOnce([{ siteUrl: 'sc-domain:fresh.test', permissionLevel: 'siteOwner' }]);
    const pending = kind === 'resume' ? actions.resumeGsc() : kind === 'connect' ? actions.connectGsc('old-client') : actions.disconnectGsc();
    await actions.connectGsc('fresh-client');
    const fresh = { ...store.getState() };
    if (fail) old.reject(new Error('Stale'));
    else old.resolve(kind === 'disconnect' ? 'Revoked' : [{ siteUrl: 'sc-domain:stale.test' }]);
    await pending;
    expect(store.getState()).toEqual(fresh);
    expect(localStorage.getItem('seomi_gsc_property_gsc-direct')).toBe('sc-domain:fresh.test');
  }
});

it('disconnect clears owned evidence and retains partial token-removal notices', async () => {
  const prefix = i18n.t('runtimeErrors.tools.providerTokenRemovedPrefix');
  for (const status of ['Revoked', `${prefix} fixture notice`]) {
    const { actions, store, invoke } = gscSliceFixture();
    store.setState({ gscClientSecret: 'fixture', gscData: gscData(), gscDataFetchedAt: 'old-time', gscInspectionResult: { old: true } });
    invoke.mockResolvedValue(status);
    await actions.disconnectGsc();
    expect(store.getState()).toMatchObject({ isGscConnected: false, gscClientSecret: '', gscProperties: [], gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, isGscLoading: false, gscError: status.startsWith(prefix) ? status : null });
  }
});

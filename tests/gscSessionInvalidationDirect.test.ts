import { expect, it } from 'vitest';
import { gscSliceFixture, deferred } from './fixtures/gscSliceDirect';
import { gscData } from './fixtures/gscTracker';

it.each(['connect', 'disconnect'] as const)('%s invalidates pending performance and inspection before session replacement', async (session) => {
  const { actions, store, invoke } = gscSliceFixture();
  const performance = deferred<unknown>();
  const inspection = deferred<unknown>();
  invoke.mockImplementation((command: string) => {
    if (command === 'search_console_performance') return performance.promise;
    if (command === 'inspect_search_console_url') return inspection.promise;
    return Promise.resolve(session === 'connect' ? [{ siteUrl: 'sc-domain:new.test', permissionLevel: 'siteOwner' }] : 'Revoked');
  });
  const pendingPerformance = actions.refreshGscData();
  const pendingInspection = actions.inspectGscUrl('https://example.com/old');
  if (session === 'connect') await actions.connectGsc('new-client');
  else await actions.disconnectGsc();
  performance.resolve(gscData({ total_clicks: 123 }));
  inspection.resolve({ staleInspection: true });
  await Promise.all([pendingPerformance, pendingInspection]);
  expect(store.getState()).toMatchObject({ gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, isGscLoading: false, gscError: null });
  expect(store.getState().isGscConnected).toBe(session === 'connect');
});

it('resuming a different accessible property clears existing evidence and invalidates pending requests', async () => {
  const { actions, store, invoke } = gscSliceFixture();
  store.setState({ gscData: gscData(), gscDataFetchedAt: 'old-time', gscInspectionResult: { old: true } });
  const performance = deferred<unknown>();
  const inspection = deferred<unknown>();
  invoke.mockImplementation((command: string) => {
    if (command === 'search_console_performance') return performance.promise;
    if (command === 'inspect_search_console_url') return inspection.promise;
    return Promise.resolve([{ siteUrl: 'sc-domain:new.test', permissionLevel: 'siteOwner' }]);
  });
  const pending = [actions.refreshGscData(), actions.inspectGscUrl('https://example.com/old')];
  await actions.resumeGsc();
  expect(store.getState()).toMatchObject({ gscProperty: 'sc-domain:new.test', gscData: null, gscDataFetchedAt: null, gscInspectionResult: null });
  performance.resolve(gscData());
  inspection.resolve({ old: true });
  await Promise.all(pending);
  expect(store.getState()).toMatchObject({ gscData: null, gscInspectionResult: null, isGscLoading: false });
});

it('revocation completion invalidates requests started while native revocation was pending', async () => {
  const { actions, store, invoke } = gscSliceFixture();
  const revocation = deferred<string>();
  const performance = deferred<unknown>();
  invoke.mockImplementation((command: string) => command === 'disconnect_search_console' ? revocation.promise : performance.promise);
  const disconnect = actions.disconnectGsc();
  const pending = actions.refreshGscData();
  revocation.resolve('Revoked');
  await disconnect;
  performance.resolve(gscData());
  await pending;
  expect(store.getState()).toMatchObject({ isGscConnected: false, gscData: null, gscDataFetchedAt: null, isGscLoading: false });
});

it.each(['connect', 'disconnect'] as const)('%s discards old data and inspection failures after successful replacement', async (session) => {
  const { actions, store, invoke } = gscSliceFixture();
  const old = deferred<unknown>();
  invoke.mockImplementation((command: string) => command === 'search_console_performance' || command === 'inspect_search_console_url' ? old.promise : Promise.resolve(session === 'connect' ? [] : 'Revoked'));
  const pending = [actions.refreshGscData(), actions.inspectGscUrl('https://example.com/old')];
  if (session === 'connect') await actions.connectGsc('new-client');
  else await actions.disconnectGsc();
  old.reject(new Error('Stale error'));
  await Promise.all(pending);
  expect(store.getState()).toMatchObject({ gscError: null, gscData: null, gscInspectionResult: null, isGscLoading: false });
});

it('resume retains evidence when the same accessible property remains selected', async () => {
  const { actions, store, invoke } = gscSliceFixture();
  const data = gscData();
  store.setState({ gscData: data, gscDataFetchedAt: 'owned-time', gscInspectionResult: { owned: true } });
  invoke.mockResolvedValue([{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }]);
  await actions.resumeGsc();
  expect(store.getState()).toMatchObject({ gscData: data, gscDataFetchedAt: 'owned-time', gscInspectionResult: { owned: true }, isGscConnected: true, isGscLoading: false });
});

it.each(['resume', 'connect'] as const)('%s clears persisted selection when there are no accessible properties', async (session) => {
  const { actions, store, invoke } = gscSliceFixture();
  localStorage.setItem('seomi_gsc_property_gsc-direct', 'sc-domain:example.com');
  invoke.mockResolvedValue([]);
  if (session === 'resume') await actions.resumeGsc();
  else await actions.connectGsc('client');
  expect(store.getState().gscProperty).toBe('');
  expect(localStorage.getItem('seomi_gsc_property_gsc-direct')).toBeNull();
});

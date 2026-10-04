import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { createGscSlice } from '@/stores/tools/gscSlice';
import { gscClientIdKey, gscFiltersKey, gscPropertyKey } from '@/stores/tools/projectPreferences';
import type { ToolsServices } from '@/stores/tools/contracts';

const properties = [{ siteUrl: 'sc-domain:a.test' }, { siteUrl: 'https://b.test/' }];
const setup = (initial: Record<string, unknown> = {}) => {
  const state: Record<string, any> = { gscClientId: 'client', gscClientSecret: 'stored-secret', gscProperty: '', gscFilters: {}, isGscConnected: true, ...initial };
  const invoke = vi.fn();
  const slice = createGscSlice((patch: any) => Object.assign(state, typeof patch === 'function' ? patch(state) : patch), (() => state) as never, { invoke } as unknown as ToolsServices);
  return { state, invoke, slice };
};

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); localStorage.setItem('seomi_active_project_v1', 'p1'); });

describe('selection and filters', () => {
  it('stores the property per project and clears dependent results', () => {
    const { state, slice } = setup({ gscData: {}, gscError: 'x', gscInspectionResult: {} });
    slice.setGscProperty('sc-domain:a.test');
    expect(localStorage.getItem(gscPropertyKey('p1'))).toBe('sc-domain:a.test');
    expect(state).toMatchObject({ gscProperty: 'sc-domain:a.test', gscData: null, gscInspectionResult: null, gscError: null });
  });

  it('keeps only valid filters, trims and truncates the country and persists them', () => {
    const { state, slice } = setup();
    slice.setGscFilters({ search_type: 'web', device: 'MOBILE', country: '  POLSKA ' } as never);
    expect(state.gscFilters).toEqual({ search_type: 'web', device: 'MOBILE', country: 'pol' });
    slice.setGscFilters({ country: '   ' } as never);
    expect(state.gscFilters).toEqual({});
    expect(JSON.parse(localStorage.getItem(gscFiltersKey('p1'))!)).toEqual({});
  });
});

describe('connecting', () => {
  it('requires a project and a client ID before any request', async () => {
    const { state, invoke, slice } = setup();
    await slice.connectGsc('  ');
    expect(state.gscError).toBe(i18n.t('runtimeErrors.tools.gscClientId'));
    localStorage.removeItem('seomi_active_project_v1');
    await slice.connectGsc('id');
    expect(state.gscError).toBe(i18n.t('runtimeErrors.tools.gscProject'));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('connects with the new or stored secret and keeps the remembered property when it still exists', async () => {
    const { state, invoke, slice } = setup({ gscProperty: 'https://b.test/' });
    invoke.mockResolvedValueOnce(properties).mockResolvedValueOnce(properties);
    await slice.connectGsc(' id ', ' fresh ');
    expect(invoke).toHaveBeenCalledWith('connect_search_console', { projectId: 'p1', clientId: 'id', clientSecret: 'fresh' });
    expect(state).toMatchObject({ isGscConnected: true, gscClientId: 'id', gscClientSecret: 'fresh', gscProperty: 'https://b.test/', isGscLoading: false });
    await slice.connectGsc('id');
    expect(invoke).toHaveBeenLastCalledWith('connect_search_console', { projectId: 'p1', clientId: 'id', clientSecret: 'fresh' });
    expect(localStorage.getItem(gscClientIdKey('p1'))).toBe('id');
  });

  it('selects the first property when none is remembered and reports provider errors', async () => {
    const { state, invoke, slice } = setup();
    invoke.mockResolvedValueOnce(properties).mockRejectedValueOnce(new Error('denied')).mockRejectedValueOnce('x');
    await slice.connectGsc('id');
    expect(state.gscProperty).toBe('sc-domain:a.test');
    await slice.connectGsc('id');
    expect(state).toMatchObject({ isGscConnected: false, gscError: 'denied', isGscLoading: false });
    await slice.connectGsc('id');
    // The native transport rejects with plain strings; they are shown as written.
    expect(state.gscError).toBe('x');
  });

  it('ignores a response that arrives after the project changed', async () => {
    const { state, invoke, slice } = setup();
    invoke.mockImplementationOnce(async () => { localStorage.setItem('seomi_active_project_v1', 'p2'); return properties; });
    await slice.connectGsc('id');
    expect(state.isGscConnected).toBe(false);
    expect(state.gscProperties).toEqual([]);
  });
});

describe('resuming and disconnecting', () => {
  it('resumes only with a project and a client ID, and reports failures', async () => {
    const { state, invoke, slice } = setup({ gscClientId: '' });
    await slice.resumeGsc();
    expect(invoke).not.toHaveBeenCalled();
    state.gscClientId = 'client';
    invoke.mockResolvedValueOnce(properties).mockRejectedValueOnce(new Error('expired'));
    await slice.resumeGsc();
    expect(state).toMatchObject({ isGscConnected: true, gscProperty: 'sc-domain:a.test', isGscLoading: false });
    await slice.resumeGsc();
    expect(state).toMatchObject({ isGscConnected: false, gscProperties: [], gscError: 'expired' });
  });

  it('disconnects, clears the secret and results, and surfaces a provider notice or error', async () => {
    const { state, invoke, slice } = setup({ gscData: {}, gscProperties: properties });
    invoke.mockResolvedValueOnce('done').mockRejectedValueOnce(new Error('offline'));
    await slice.disconnectGsc();
    expect(state).toMatchObject({ isGscConnected: false, gscClientSecret: '', gscData: null, gscProperties: [], gscError: null });
    await slice.disconnectGsc();
    expect(state.gscError).toBe('offline');
    localStorage.removeItem('seomi_active_project_v1');
    await slice.disconnectGsc();
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});

describe('data and inspection', () => {
  it('needs a connection and a property for data and inspection', async () => {
    const { state, invoke, slice } = setup({ isGscConnected: false });
    await slice.refreshGscData();
    expect(state.gscError).toBe(i18n.t('runtimeErrors.tools.gscNeedPropertyData'));
    await slice.inspectGscUrl('https://a.test/');
    expect(state.gscError).toBe(i18n.t('runtimeErrors.tools.gscNeedPropertyInspect'));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('requests performance with the range and filters, and falls back to stored filters', async () => {
    const { state, invoke, slice } = setup({ gscProperty: 'sc-domain:a.test', gscFilters: { device: 'DESKTOP' } });
    invoke.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [1] });
    await slice.refreshGscData({ startDate: '2026-09-01', endDate: '2026-09-30' }, { country: 'pol' } as never);
    expect(invoke).toHaveBeenCalledWith('search_console_performance', expect.objectContaining({ startDate: '2026-09-01', endDate: '2026-09-30', filters: { country: 'pol' } }));
    expect(state.gscDataFetchedAt).toEqual(expect.any(String));
    await slice.refreshGscData();
    expect(invoke).toHaveBeenLastCalledWith('search_console_performance', expect.objectContaining({ startDate: null, endDate: null, filters: { device: 'DESKTOP' } }));
  });

  it('reports data and inspection failures and keeps a trimmed inspection URL', async () => {
    const { state, invoke, slice } = setup({ gscProperty: 'sc-domain:a.test' });
    invoke.mockRejectedValueOnce(new Error('quota')).mockRejectedValueOnce('x').mockResolvedValueOnce({ verdict: 'PASS' }).mockRejectedValueOnce(new Error('bad url'));
    await slice.refreshGscData();
    expect(state.gscError).toBe('quota');
    await slice.refreshGscData();
    expect(state.gscError).toBe(i18n.t('runtimeErrors.tools.gscDataFailed'));
    await slice.inspectGscUrl('  https://a.test/x  ');
    expect(invoke).toHaveBeenLastCalledWith('inspect_search_console_url', expect.objectContaining({ inspectionUrl: 'https://a.test/x' }));
    expect(state.gscInspectionResult).toEqual({ verdict: 'PASS' });
    await slice.inspectGscUrl('x');
    expect(state.gscError).toBe('bad url');
  });
});

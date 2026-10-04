import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { DataForSEOClient } from '@/services/dataforseo';
import { dataForSeoSerpKey, dataForSeoSummaryKey, dataForSeoTargetKey } from '@/stores/audit/auditConstants';

const summary = { target: 'Example.COM', backlinks: 5 } as never;
const audit = (url: string, finalUrl = '') => ({ url, final_url: finalUrl }) as never;

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  localStorage.setItem('seomi_active_project_v1', 'p1');
  useProjectStore.setState({ activeProjectId: 'p1' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'l', password: 'p' } });
  useAuditStore.setState({ currentAudit: null, dataforseoData: null, dataforseoSerp: [], dataforseoError: null, isDataForSEOLoading: false });
});
afterEach(() => vi.restoreAllMocks());

describe('fetchDataForSEO', () => {
  it('requires a project, a target and credentials before any request', async () => {
    const summarySpy = vi.spyOn(DataForSEOClient.prototype, 'getBacklinksSummary');
    localStorage.removeItem('seomi_active_project_v1');
    useProjectStore.setState({ activeProjectId: null });
    await useAuditStore.getState().fetchDataForSEO('example.com');
    expect(useAuditStore.getState().dataforseoError).toBe(i18n.t('runtimeErrors.tools.projectRequired'));
    useProjectStore.setState({ activeProjectId: 'p1' });
    await useAuditStore.getState().fetchDataForSEO('  ');
    expect(useAuditStore.getState().dataforseoError).toBe(i18n.t('runtimeErrors.audit.dataforseoDomain'));
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
    await useAuditStore.getState().fetchDataForSEO('example.com');
    expect(useAuditStore.getState().dataforseoError).toBe(i18n.t('runtimeErrors.audit.dataforseoConnection'));
    expect(summarySpy).not.toHaveBeenCalled();
  });

  it('takes the target from the current audit (final URL first) and stores the profile', async () => {
    useAuditStore.setState({ currentAudit: audit('https://old.test/a', 'https://www.example.com/page') });
    const spy = vi.spyOn(DataForSEOClient.prototype, 'getBacklinksSummary').mockResolvedValue(summary);
    await useAuditStore.getState().fetchDataForSEO();
    expect(spy).toHaveBeenCalledWith('www.example.com');
    expect(useAuditStore.getState()).toMatchObject({ dataforseoData: summary, isDataForSEOLoading: false, dataforseoError: null });
    expect(localStorage.getItem(dataForSeoTargetKey('p1'))).toBe('example.com');
    expect(JSON.parse(localStorage.getItem(dataForSeoSummaryKey('p1'))!)).toEqual(summary);
  });

  it('tolerates an unparseable audit URL and reports it as a missing domain', async () => {
    useAuditStore.setState({ currentAudit: audit('not a url') });
    await useAuditStore.getState().fetchDataForSEO();
    expect(useAuditStore.getState().dataforseoError).toBe(i18n.t('runtimeErrors.audit.dataforseoDomain'));
  });

  it('reports a missing profile and provider errors without keeping stale data', async () => {
    const spy = vi.spyOn(DataForSEOClient.prototype, 'getBacklinksSummary').mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('boom'));
    await useAuditStore.getState().fetchDataForSEO('example.com');
    expect(useAuditStore.getState()).toMatchObject({ dataforseoData: null, dataforseoError: i18n.t('runtimeErrors.tools.backlinkNoProfile'), isDataForSEOLoading: false });
    await useAuditStore.getState().fetchDataForSEO('example.com');
    expect(useAuditStore.getState().dataforseoError).toBe('boom');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('fetchDataForSEOSerp', () => {
  const rows = [{ url: 'https://a.test/', position: 1 }] as never;

  it('requires project and credentials, then stores SERP rows with the default market', async () => {
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
    await useAuditStore.getState().fetchDataForSEOSerp('seo');
    expect(useAuditStore.getState().dataforseoError).toBe(i18n.t('runtimeErrors.audit.dataforseoConnection'));
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'l', password: 'p' } });
    const spy = vi.spyOn(DataForSEOClient.prototype, 'getSerpCompetitors').mockResolvedValue(rows);
    await useAuditStore.getState().fetchDataForSEOSerp('seo');
    expect(spy).toHaveBeenCalledWith('seo', 2840, 'en');
    expect(useAuditStore.getState().dataforseoSerp).toEqual(rows);
    expect(JSON.parse(localStorage.getItem(dataForSeoSerpKey('p1'))!)).toEqual(rows);
  });

  it('uses the given market and reports failures', async () => {
    vi.spyOn(DataForSEOClient.prototype, 'getSerpCompetitors').mockRejectedValue('plain failure');
    await useAuditStore.getState().fetchDataForSEOSerp('seo', 2616, 'pl');
    expect(useAuditStore.getState().dataforseoError).toBe('plain failure');
    localStorage.removeItem('seomi_active_project_v1');
    useProjectStore.setState({ activeProjectId: null });
    await useAuditStore.getState().fetchDataForSEOSerp('seo');
    expect(useAuditStore.getState().dataforseoError).toBe(i18n.t('runtimeErrors.tools.projectRequired'));
  });
});

describe('setDataForSEOData', () => {
  it('persists a summary with a lower-cased target and clears it without persisting', () => {
    useAuditStore.getState().setDataForSEOData(summary);
    expect(localStorage.getItem(dataForSeoTargetKey('p1'))).toBe('example.com');
    expect(useAuditStore.getState().dataforseoData).toEqual(summary);
    localStorage.clear();
    useAuditStore.getState().setDataForSEOData(null);
    expect(useAuditStore.getState().dataforseoData).toBeNull();
    expect(localStorage.getItem(dataForSeoSummaryKey('p1'))).toBeNull();
  });
});

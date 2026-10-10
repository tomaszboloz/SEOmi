import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { DataForSEOClient } from '@/services/dataforseo';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { dataForSeoSerpKey, dataForSeoSummaryKey } from '@/stores/audit/auditConstants';
import type { DataForSEOSerpItem } from '@/types';

const summary = (target: string) => ({ target, total_backlinks: 4, referring_domains: 2, referring_main_domains: 2, rank: 20, dofollow_backlinks: 3, broken_backlinks: 0 });
const activate = (id: string) => { localStorage.setItem('seomi_active_project_v1', id); useProjectStore.setState({ activeProjectId: id }); };

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  activate('audit-seo-direct');
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'login', password: 'password' } });
  useAuditStore.setState({ currentAudit: null, dataforseoData: null, dataforseoSerp: [], dataforseoError: null, isDataForSEOLoading: false });
});
afterEach(() => vi.restoreAllMocks());

describe('audit SEO slice direct request contracts', () => {
  it('ignores a late summary response and late summary error from the same project', async () => {
    let resolveFirst!: (value: ReturnType<typeof summary>) => void;
    let rejectFirst!: (error: unknown) => void;
    let resolveSecond!: (value: ReturnType<typeof summary>) => void;
    const spy = vi.spyOn(DataForSEOClient.prototype, 'getBacklinksSummary')
      .mockImplementationOnce(() => new Promise((resolve, reject) => { resolveFirst = resolve; rejectFirst = reject; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const first = useAuditStore.getState().fetchDataForSEO('first.example');
    await Promise.resolve();
    const second = useAuditStore.getState().fetchDataForSEO('second.example');
    await Promise.resolve();
    rejectFirst('stale provider failure');
    resolveFirst(summary('first.example'));
    resolveSecond(summary('second.example'));
    await Promise.all([first, second]);
    expect(spy).toHaveBeenCalledWith('first.example');
    expect(useAuditStore.getState().dataforseoData).toEqual(summary('second.example'));
    expect(useAuditStore.getState().dataforseoError).toBeNull();
    expect(JSON.parse(localStorage.getItem(dataForSeoSummaryKey('audit-seo-direct'))!)).toEqual(summary('second.example'));
  });

  it('ignores an older successful summary when the newer request completes first', async () => {
    let resolveFirst!: (value: ReturnType<typeof summary>) => void;
    let resolveSecond!: (value: ReturnType<typeof summary>) => void;
    vi.spyOn(DataForSEOClient.prototype, 'getBacklinksSummary')
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const first = useAuditStore.getState().fetchDataForSEO('old.example');
    await Promise.resolve();
    const second = useAuditStore.getState().fetchDataForSEO('new.example');
    await Promise.resolve();
    resolveSecond(summary('new.example'));
    resolveFirst(summary('old.example'));
    await Promise.all([first, second]);
    expect(useAuditStore.getState().dataforseoData).toEqual(summary('new.example'));
    expect(JSON.parse(localStorage.getItem(dataForSeoSummaryKey('audit-seo-direct'))!)).toEqual(summary('new.example'));
  });

  it('does not publish a summary after the active project changes, including no-profile responses', async () => {
    let resolve!: (value: ReturnType<typeof summary> | null) => void;
    vi.spyOn(DataForSEOClient.prototype, 'getBacklinksSummary').mockImplementation(() => new Promise((done) => { resolve = done; }));
    const pending = useAuditStore.getState().fetchDataForSEO('example.test');
    await Promise.resolve();
    activate('other-project');
    resolve(null);
    await pending;
    expect(useAuditStore.getState().dataforseoData).toBeNull();
    expect(localStorage.getItem(dataForSeoSummaryKey('audit-seo-direct'))).toBeNull();

    activate('audit-seo-direct');
    const lateSummary = new Promise<ReturnType<typeof summary>>((done) => { resolve = done as (value: ReturnType<typeof summary> | null) => void; });
    (DataForSEOClient.prototype.getBacklinksSummary as ReturnType<typeof vi.fn>).mockImplementationOnce(() => lateSummary);
    const late = useAuditStore.getState().fetchDataForSEO('example.test');
    await Promise.resolve();
    activate('other-project');
    resolve(summary('example.test'));
    await late;
    expect(useAuditStore.getState().dataforseoData).toBeNull();
    expect(JSON.parse(localStorage.getItem(dataForSeoSummaryKey('audit-seo-direct'))!)).toEqual(summary('example.test'));
  });

  it('guards SERP publication across project changes and exposes both error shapes', async () => {
    let resolve!: (value: DataForSEOSerpItem[]) => void;
    const serp = vi.spyOn(DataForSEOClient.prototype, 'getSerpCompetitors').mockImplementation(() => new Promise((done) => { resolve = done; }));
    const pending = useAuditStore.getState().fetchDataForSEOSerp('seo', 2616, 'pl');
    await Promise.resolve();
    activate('other-project');
    resolve([{ type: 'organic', rank_group: 1, rank_absolute: 1, domain: 'result.test', title: 'Result', description: '', url: 'https://result.test' }]);
    await pending;
    expect(serp).toHaveBeenCalledWith('seo', 2616, 'pl');
    expect(useAuditStore.getState().dataforseoSerp).toEqual([]);
    expect(JSON.parse(localStorage.getItem(dataForSeoSerpKey('audit-seo-direct'))!)).toEqual([{ type: 'organic', rank_group: 1, rank_absolute: 1, domain: 'result.test', title: 'Result', description: '', url: 'https://result.test' }]);

    activate('audit-seo-direct');
    vi.spyOn(DataForSEOClient.prototype, 'getBacklinksSummary').mockRejectedValueOnce('plain summary failure');
    await useAuditStore.getState().fetchDataForSEO('example.test');
    expect(useAuditStore.getState().dataforseoError).toBe('plain summary failure');
    serp.mockRejectedValueOnce(new Error('serp failure'));
    await useAuditStore.getState().fetchDataForSEOSerp('seo');
    expect(useAuditStore.getState().dataforseoError).toBe('serp failure');
  });
});

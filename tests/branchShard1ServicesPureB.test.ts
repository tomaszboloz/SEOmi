import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertTrendingPayload, trendingSnapshot } from '@/services/trendingNow/contracts';
import { initializeSettingsTheme } from '@/stores/settings/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { DataForSEOClient } from '@/services/dataforseo';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { dataForSeoSerpKey } from '@/stores/audit/auditConstants';
import { loadRankTrackingDraft } from '@/stores/tools/keywordPersistence';
import { rankTrackingDraftKey } from '@/stores/tools/storageKeys';
import type { DataForSEOSerpItem } from '@/types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('trending now contract rejections', () => {
  it('rejects non-text payloads', () => {
    expect(() => assertTrendingPayload(42 as unknown as string)).toThrow('Trending Now payload must be text');
  });

  it('rejects missing, unknown and url-less RSS sources', () => {
    const snapshot = (source: unknown) => () => trendingSnapshot('p1', 'PL', source as Parameters<typeof trendingSnapshot>[2], []);
    expect(snapshot(null)).toThrow('Invalid Trending Now source');
    expect(snapshot({ kind: 'other', url: null })).toThrow('Invalid Trending Now source');
    expect(snapshot({ kind: 'google-trends-rss', url: null })).toThrow('Missing Trending Now RSS source');
  });
});

describe('settings theme without a document', () => {
  it('does nothing when no document is available', () => {
    vi.stubGlobal('document', undefined);
    const getState = vi.fn();
    initializeSettingsTheme({ getState } as unknown as Parameters<typeof initializeSettingsTheme>[0]);
    expect(getState).not.toHaveBeenCalled();
  });
});

describe('rank tracking draft with non-string fields', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({ activeProjectId: 'a', projects: [{ id: 'a', name: 'A', rootUrl: 'https://example.pl', createdAt: '2026-10-01', lastOpenedAt: '2026-10-01' }] });
  });

  it('falls back to the project market and a supported language for a resolved market', () => {
    localStorage.setItem(rankTrackingDraftKey('a'), JSON.stringify({ location: 5, language: 7 }));
    expect(loadRankTrackingDraft()).toMatchObject({ location: 'PL', language: 'pl' });
  });

  it('keeps an empty language for an unsupported market with a non-string language', () => {
    localStorage.setItem(rankTrackingDraftKey('a'), JSON.stringify({ location: 'unsupported', language: 7 }));
    expect(loadRankTrackingDraft()).toMatchObject({ location: 'unsupported', language: '' });
  });
});

describe('SERP fetch request ordering', () => {
  const item = { type: 'organic', rank_group: 1, rank_absolute: 1, domain: 'r.test', title: 'R', description: '', url: 'https://r.test' } as DataForSEOSerpItem;
  const activate = (id: string) => { localStorage.setItem('seomi_active_project_v1', id); useProjectStore.setState({ activeProjectId: id }); };

  beforeEach(() => {
    localStorage.clear();
    activate('shard1-serp');
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'l', password: 'p' } });
    useAuditStore.setState({ dataforseoSerp: [], dataforseoError: null, isDataForSEOLoading: false });
  });

  it('drops a superseded response from the same project', async () => {
    let resolveFirst!: (value: DataForSEOSerpItem[]) => void;
    vi.spyOn(DataForSEOClient.prototype, 'getSerpCompetitors')
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce([]);
    const first = useAuditStore.getState().fetchDataForSEOSerp('one');
    await Promise.resolve();
    await useAuditStore.getState().fetchDataForSEOSerp('two');
    resolveFirst([item]);
    await first;
    expect(useAuditStore.getState().dataforseoSerp).toEqual([]);
    expect(localStorage.getItem(dataForSeoSerpKey('shard1-serp'))).not.toContain('r.test');
  });

  it.each(['same-project', 'other-project'])('does not publish an error from a superseded request (%s)', async (scenario) => {
    let rejectFirst!: (error: unknown) => void;
    vi.spyOn(DataForSEOClient.prototype, 'getSerpCompetitors')
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockResolvedValueOnce([]);
    const pending = useAuditStore.getState().fetchDataForSEOSerp('one');
    await Promise.resolve();
    if (scenario === 'same-project') await useAuditStore.getState().fetchDataForSEOSerp('two');
    else activate('shard1-other');
    rejectFirst(new Error('late failure'));
    await pending;
    expect(useAuditStore.getState().dataforseoError).toBeNull();
  });
});

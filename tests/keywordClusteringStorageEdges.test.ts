import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSession } from '@/components/Keywords/keywordClustering/keywordClusteringStorage';
import { useToolsStore } from '@/stores/toolsStore';

beforeEach(() => {
  localStorage.clear();
  useToolsStore.setState({ keywordCountry: 'PL', keywordLanguage: 'pl' });
});

describe('keyword clustering storage boundaries', () => {
  it('returns the current tool defaults without a project', () => {
    useToolsStore.setState({ keywordCountry: 'US', keywordLanguage: 'en' });
    expect(loadSession(null)).toMatchObject({ input: '', country: 'US', language: 'en', minSharedUrls: 3, result: null });
  });

  it('keeps saved input but rejects malformed result and an obsolete market', () => {
    localStorage.setItem('seomi_keyword_clustering_p1', JSON.stringify({ input: 'one\ntwo', country: 'obsolete-market', language: 'xx', minSharedUrls: -2, result: { clusters: 'invalid' } }));
    const session = loadSession('p1');
    expect(session.input).toBe('one\ntwo');
    expect(session.country).toBe('');
    expect(session.language).toBe('');
    expect(session.minSharedUrls).toBe(3);
    expect(session.result).toBeNull();
  });

  it('uses the shared project market and safely falls back for invalid JSON', () => {
    localStorage.setItem('seomi_project_p1_dataforseo_market_v1', '2840');
    localStorage.setItem('seomi_keyword_clustering_p1', JSON.stringify({ input: 'one', country: 'PL', language: 'pl', minSharedUrls: 4 }));
    expect(loadSession('p1')).toMatchObject({ input: 'one', country: 'US', minSharedUrls: 4, result: null });
    localStorage.setItem('seomi_keyword_clustering_p2', '{not-json');
    expect(loadSession('p2')).toMatchObject({ input: '', country: 'PL', language: 'pl', minSharedUrls: 3, result: null });
  });

  it('falls back to defaults if saved record is falsy or storage throws', async () => {
    const contracts = await import('@/services/storageContracts');
    const spy = vi.spyOn(contracts, 'readJsonRecord').mockReturnValueOnce(null as any);
    expect(loadSession('p1')).toMatchObject({ input: '', country: 'PL', language: 'pl', minSharedUrls: 3, result: null });
    spy.mockRestore();

    const storageSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('fail');
    });
    expect(loadSession('p1')).toMatchObject({ input: '', country: 'PL', language: 'pl', minSharedUrls: 3, result: null });
    storageSpy.mockRestore();
  });
});

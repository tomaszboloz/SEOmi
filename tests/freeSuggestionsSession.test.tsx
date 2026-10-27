import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFreeSuggestionsSession } from '@/components/KeywordResearch/freeSuggestions/useFreeSuggestionsSession';
import type { GoogleSuggestionsResult } from '@/services/freeSuggestions';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/services/freeSuggestions', async () => ({
  ...(await vi.importActual<typeof import('@/services/freeSuggestions')>('@/services/freeSuggestions')),
  fetchFreeSuggestions: mocks.fetch,
}));

const result: GoogleSuggestionsResult = {
  feed: 'google-suggestions', query: 'seo', suggestions: ['seo audit', 'seo tools'], fetchedAt: '2026-10-06T10:00:00Z',
  sourceUrl: 'https://suggestqueries.google.com/complete/search?client=firefox&hl=pl&gl=pl&q=seo',
  source: { kind: 'google-suggest-unofficial', provider: 'Google Suggest', sourceUrl: 'https://suggestqueries.google.com/complete/search?client=firefox&hl=pl&gl=pl&q=seo', requestedGeo: 'PL', requestedLanguage: 'pl', availability: 'best-effort', reason: 'best effort' },
};
const success = { status: 'ok' as const, response: { status: 'ok' as const, sourceUrl: result.sourceUrl, fetchedAt: result.fetchedAt, body: '[]', httpStatus: 200, error: null }, result };
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (value: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };

describe('useFreeSuggestionsSession', () => {
  beforeEach(() => mocks.fetch.mockReset());

  it('fetches scoped suggestions and saves each result once', async () => {
    mocks.fetch.mockResolvedValue(success);
    const onSave = vi.fn();
    const { result: current } = renderHook(() => useFreeSuggestionsSession({ projectId: 'p1', query: 'seo', geo: 'PL', language: 'pl', savedKeywords: [], onSave }));
    await act(async () => { await current.current.fetchSuggestions(); });
    expect(current.current.result).toEqual(result);
    act(() => current.current.saveSuggestion('seo audit'));
    expect(onSave).toHaveBeenCalledWith('seo audit', expect.objectContaining({ retrievedAt: result.fetchedAt, requestedGeo: 'PL' }));
    expect(current.current.isSaved('SEO AUDIT')).toBe(false);
  });

  it('ignores a delayed response after the query owner changes', async () => {
    const request = deferred<typeof success>();
    mocks.fetch.mockReturnValue(request.promise);
    const props = { projectId: 'p1', query: 'seo', geo: 'PL', language: 'pl', savedKeywords: [], onSave: vi.fn() };
    const { result: current, rerender } = renderHook((value) => useFreeSuggestionsSession(value), { initialProps: props });
    act(() => { void current.current.fetchSuggestions(); });
    rerender({ ...props, query: 'different' });
    act(() => request.resolve(success));
    await waitFor(() => expect(current.current.result).toBeNull());
    expect(current.current.fetching).toBe(false);
  });

  it('does not call native transport for an oversized Unicode query', async () => {
    const { result: current } = renderHook(() => useFreeSuggestionsSession({ projectId: 'p1', query: 'ą'.repeat(251), geo: 'PL', language: 'pl', savedKeywords: [], onSave: vi.fn() }));
    await act(async () => { await current.current.fetchSuggestions(); });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(current.current.error?.message).toMatch(/too long/);
  });

  it('reports blocked native responses without creating a result', async () => {
    mocks.fetch.mockResolvedValue({ status: 'blocked', result: null, response: { error: 'HTTP 429' } });
    const { result: current } = renderHook(() => useFreeSuggestionsSession({ projectId: 'p1', query: 'seo', geo: 'PL', language: 'pl', savedKeywords: [], onSave: vi.fn() }));
    await act(async () => { await current.current.fetchSuggestions(); });
    expect(current.current.error).toEqual({ status: 'blocked', message: 'HTTP 429' });
    expect(current.current.result).toBeNull();
  });
});

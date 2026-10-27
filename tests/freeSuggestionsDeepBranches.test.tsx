import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFreeSuggestionsSession } from '@/components/KeywordResearch/freeSuggestions/useFreeSuggestionsSession';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/services/freeSuggestions', async () => ({
  ...(await vi.importActual<typeof import('@/services/freeSuggestions')>('@/services/freeSuggestions')),
  fetchFreeSuggestions: mocks.fetch,
}));

describe('freeSuggestions deep branches', () => {
  beforeEach(() => mocks.fetch.mockReset());

  it('handles blank query and missing project id gracefully', async () => {
    const { result } = renderHook(() => useFreeSuggestionsSession({
      projectId: null, query: '', geo: 'PL', language: 'pl', savedKeywords: [], onSave: vi.fn()
    }));
    await act(async () => { await result.current.fetchSuggestions(); });
    expect(mocks.fetch).not.toHaveBeenCalled();

    const { result: r2 } = renderHook(() => useFreeSuggestionsSession({
      projectId: 'p1', query: '   ', geo: 'PL', language: 'pl', savedKeywords: [], onSave: vi.fn()
    }));
    await act(async () => { await r2.current.fetchSuggestions(); });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('handles error status and cancellation correctly', async () => {
    mocks.fetch.mockResolvedValue({ status: 'error', result: null, response: { error: 'Suggestions unavailable' } });
    const { result } = renderHook(() => useFreeSuggestionsSession({
      projectId: 'p1', query: 'seo', geo: 'PL', language: 'pl', savedKeywords: [], onSave: vi.fn()
    }));
    await act(async () => {
      await result.current.fetchSuggestions();
    });
    expect(result.current.error?.message).toBe('Suggestions unavailable');
    expect(result.current.fetching).toBe(false);

    act(() => result.current.cancel());
    expect(result.current.fetching).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

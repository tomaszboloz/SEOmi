import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFreeSerpSession } from '@/components/Keywords/embeddingClustering/useFreeSerpSession';

describe('useFreeSerpSession direct assertions', () => {
  it('initializes in non-fetching state without error', () => {
    const onImport = vi.fn();
    const { result } = renderHook(() =>
      useFreeSerpSession({
        projectId: 'proj-1',
        keyword: 'seo tools',
        country: 'PL',
        language: 'pl',
        importedAt: null,
        onImport,
      }),
    );

    expect(result.current.fetching).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.fetchBing).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
  });

  it('cancel resets fetching and error state', () => {
    const onImport = vi.fn();
    const { result } = renderHook(() =>
      useFreeSerpSession({
        projectId: 'proj-1',
        keyword: 'seo tools',
        country: 'PL',
        language: 'pl',
        importedAt: null,
        onImport,
      }),
    );

    act(() => {
      result.current.cancel();
    });

    expect(result.current.fetching).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

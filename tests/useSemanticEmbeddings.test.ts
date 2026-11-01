import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSemanticEmbeddings } from '@/hooks/useSemanticEmbeddings';
import { DEFAULT_SEMANTIC_SETTINGS, saveSemanticSettings, type SemanticLoad } from '@/services/semanticSource';
import * as source from '@/services/semanticSource';

const pages = [{ url: 'https://a.pl/', title: 'A' }];
const set = { providerId: 'ollama', model: 'm', dimensions: 2 };
const enable = () => saveSemanticSettings({ ...DEFAULT_SEMANTIC_SETTINGS, enabled: true });

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('useSemanticEmbeddings', () => {
  it('stays off when disabled, without a project or without pages', () => {
    const spy = vi.spyOn(source, 'loadSemanticSet');
    const { result, rerender } = renderHook(({ id, list }) => useSemanticEmbeddings(id, list), { initialProps: { id: 'p1' as string | null, list: pages } });
    expect(result.current).toEqual({ set: undefined, status: 'off', failure: null });
    rerender({ id: null, list: pages });
    act(() => { enable(); });
    rerender({ id: 'p1', list: [] });
    expect(spy).not.toHaveBeenCalled();
    expect(result.current.status).toBe('off');
  });

  it('loads a set, then reloads when settings change', async () => {
    enable();
    const spy = vi.spyOn(source, 'loadSemanticSet').mockResolvedValue({ status: 'ready', set, rejected: 0, skipped: 0 } as SemanticLoad);
    const { result } = renderHook(() => useSemanticEmbeddings('p1', pages));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.set).toBe(set);
    await act(async () => { saveSemanticSettings({ ...DEFAULT_SEMANTIC_SETTINGS, enabled: true, model: 'other' }); });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it('reports the failure code on fallback and null code without an error', async () => {
    enable();
    const spy = vi.spyOn(source, 'loadSemanticSet').mockResolvedValue({ status: 'fallback', error: { code: 'offline', message: '' } });
    const { result, rerender } = renderHook(({ list }) => useSemanticEmbeddings('p1', list), { initialProps: { list: pages } });
    await waitFor(() => expect(result.current).toEqual({ set: undefined, status: 'fallback', failure: 'offline' }));
    spy.mockResolvedValue({ status: 'fallback', error: null });
    rerender({ list: [...pages] });
    await waitFor(() => expect(result.current.failure).toBeNull());
    expect(result.current.status).toBe('fallback');
  });

  it('maps an off result to off', async () => {
    enable();
    vi.spyOn(source, 'loadSemanticSet').mockResolvedValue({ status: 'off' });
    const { result } = renderHook(() => useSemanticEmbeddings('p1', pages));
    await waitFor(() => expect(result.current.status).toBe('off'));
  });

  it('ignores a result that arrives after unmount', async () => {
    enable();
    let release: (value: SemanticLoad) => void = () => undefined;
    vi.spyOn(source, 'loadSemanticSet').mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const { result, unmount } = renderHook(() => useSemanticEmbeddings('p1', pages));
    expect(result.current.status).toBe('loading');
    unmount();
    await act(async () => { release({ status: 'ready', set, rejected: 0, skipped: 0 }); });
    expect(result.current.status).toBe('loading');
  });
});

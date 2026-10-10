import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useImportedSerp } from '@/components/Keywords/embeddingClustering/useImportedSerp';
import * as storage from '@/components/Keywords/embeddingClustering/importedSerpStorage';

const payload = 'keyword,rank,url\nseo,1,https://example.test/';
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('imported SERP hook edge contracts', () => {
  it('preserves non-Error throws and reports save persistence failures', () => {
    const save = vi.spyOn(storage, 'saveImportedSerp');
    save.mockImplementationOnce(() => { throw 'quota text'; });
    const { result } = renderHook(() => useImportedSerp('p1'));
    act(() => result.current.apply(payload, 'csv'));
    expect(result.current.error).toBe('quota text');
    save.mockImplementationOnce(() => { throw new Error('storage failed'); });
    act(() => result.current.apply(payload, 'csv'));
    expect(result.current.error).toBe('storage failed');
    expect(result.current.imported).toBeNull();
  });

  it('ignores callbacks from a previous project, handles no scope and reports failed removal', () => {
    const clear = vi.spyOn(storage, 'clearImportedSerp').mockReturnValue(false);
    const { result, rerender } = renderHook(({ id }) => useImportedSerp(id), { initialProps: { id: 'p1' as string | null } });
    const staleApply = result.current.apply; const staleClear = result.current.clear;
    rerender({ id: 'p2' });
    act(() => { staleApply(payload, 'csv'); staleClear(); });
    expect(clear).not.toHaveBeenCalled(); expect(result.current.imported).toBeNull();
    act(() => result.current.clear());
    expect(clear).toHaveBeenCalledWith('p2');
    expect(result.current.error).toBe('SERP import storage is unavailable');
    rerender({ id: null });
    act(() => { result.current.apply(payload, 'csv'); result.current.clear(); });
    expect(result.current.error).toBeNull(); expect(result.current.imported).toBeNull();
  });
});

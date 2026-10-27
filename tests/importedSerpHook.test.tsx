import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useImportedSerp } from '@/components/Keywords/embeddingClustering/useImportedSerp';

const payload = 'keyword,rank,url\nrower,1,https://example.com/';
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

it('imports, clears and isolates projects and stale callbacks', () => {
  const { result, rerender } = renderHook(({ id }) => useImportedSerp(id), { initialProps: { id: 'p1' as string | null } });
  act(() => result.current.apply(payload, 'csv'));
  expect(result.current.imported?.result.snapshots[0].keyword).toBe('rower');
  const previousApply = result.current.apply;
  const previousClear = result.current.clear;
  rerender({ id: 'p2' });
  act(() => { previousApply(payload, 'csv'); previousClear(); });
  expect(result.current.imported).toBeNull();
  rerender({ id: 'p1' });
  expect(result.current.imported?.result.snapshots).toHaveLength(1);
  act(() => result.current.clear());
  expect(result.current.imported).toBeNull();
  rerender({ id: null });
  act(() => { result.current.apply(payload, 'csv'); result.current.clear(); });
  expect(result.current.error).toBeNull();
});

it('reports parse and persistence errors, without pretending successful removal', () => {
  const { result } = renderHook(() => useImportedSerp('p1'));
  act(() => result.current.apply('{', 'json'));
  expect(result.current.error).toContain('JSON');
  act(() => result.current.apply(payload, 'csv'));
  expect(result.current.error).toBeNull();
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  act(() => result.current.clear());
  expect(result.current.imported).not.toBeNull();
  expect(result.current.error).toContain('storage');
});

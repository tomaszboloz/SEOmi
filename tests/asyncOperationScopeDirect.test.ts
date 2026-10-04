import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';

it('owns independent latest operations across owner changes and unmount', () => {
  const f = renderHook(({ owner }) => useAsyncOperationScope(owner), { initialProps: { owner: 'draft-one' } });
  const begin = f.result.current;
  let old!: () => boolean; let latest!: () => boolean; let other!: () => boolean;
  act(() => { old = f.result.current('save'); other = f.result.current('test'); latest = f.result.current('save'); });
  expect(old()).toBe(false); expect(latest()).toBe(true); expect(other()).toBe(true);
  f.rerender({ owner: 'draft-two' });
  expect(f.result.current).toBe(begin);
  expect(latest()).toBe(false); expect(other()).toBe(false);
  let mounted!: () => boolean;
  act(() => { mounted = f.result.current('save'); });
  expect(mounted()).toBe(true);
  f.unmount();
  expect(mounted()).toBe(false);
});

import { afterEach, expect, it, vi } from 'vitest';
import { reserveBudget } from '@/services/dataforseo/dataforseoBudgetGuard';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

it('releases safely when the reservation map has no current value', () => {
  const originalGet = Map.prototype.get;
  vi.spyOn(Map.prototype, 'get').mockImplementation(function (this: Map<unknown, unknown>, key: unknown) {
    if (key === 'missing-reservation') return undefined;
    return originalGet.call(this, key);
  });
  expect(() => reserveBudget('missing-reservation', '/v3/paid-endpoint')()).not.toThrow();
});

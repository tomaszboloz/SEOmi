import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useDomainOverviewSession } from '@/components/Domain/domainOverview/useDomainOverviewSession';

// A frozen state object: the fallback `|| []` returns a fresh array per call, which a live zustand store would re-render on forever.
const frozen = vi.hoisted(() => ({
  domainQuery: '', domainCountry: 'US', domainLanguage: 'en', domainOverview: null, isDomainLoading: false, domainError: null,
  domainComparison: null, domainComparisonTargets: [] as string[], isDomainComparisonLoading: false, domainComparisonError: null,
  domainComparisonHistory: undefined as unknown,
}));
vi.mock('@/stores/toolsStore', () => ({ useToolsStore: <T,>(selector: (state: typeof frozen) => T) => selector(frozen) }));

it('exposes an empty comparison history when the store has none', () => {
  const { result } = renderHook(() => useDomainOverviewSession());
  expect(result.current.domainComparisonHistory).toEqual([]);
});

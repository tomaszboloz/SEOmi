import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useSearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';

// A selector that fabricates a fresh object per call cannot run against a real
// zustand store (it would re-render forever), so the store is replaced by a
// plain selector runner over a state without gscFilters.
vi.mock('@/stores/toolsStore', () => ({
  useToolsStore: (selector: (state: Record<string, unknown>) => unknown) => selector({ gscProperty: '', gscData: null }),
}));

it('falls back to an empty filter object when the store has none', () => {
  const { result } = renderHook(() => useSearchConsoleSession());
  expect(result.current.gscFilters).toEqual({});
});

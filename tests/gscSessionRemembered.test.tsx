import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { SearchConsoleHeader } from '@/components/AgentWorkflows/searchConsole/Header';
import { useSearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { gscData } from './fixtures/gscTracker';

const PROPERTY = 'sc-domain:example.com';
let refresh: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  refresh = vi.fn(async () => undefined);
  useProjectStore.setState({ activeProjectId: 'p1' });
  useToolsStore.setState({
    gscHydratedProjectId: 'p1', isGscConnected: true, gscClientId: 'client', gscProperty: PROPERTY, gscFilters: {},
    gscData: null, gscDataFetchedAt: null, isGscLoading: false, gscError: null, refreshGscData: refresh as never, resumeGsc: vi.fn() as never,
  });
});
afterEach(cleanup);

it('fetches once on the first connected visit with nothing remembered', () => {
  const { rerender } = renderHook(() => useSearchConsoleSession());
  expect(refresh).toHaveBeenCalledTimes(1);
  rerender();
  act(() => useToolsStore.setState({ isGscLoading: true }));
  act(() => useToolsStore.setState({ isGscLoading: false }));
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('shows a remembered report without fetching and says when it was fetched', () => {
  useToolsStore.setState({ gscData: gscData(), gscDataFetchedAt: '2026-10-28T08:00:00.000Z' });
  const { result } = renderHook(() => useSearchConsoleSession());
  expect(refresh).not.toHaveBeenCalled();
  render(<SearchConsoleHeader session={result.current} />);
  expect(screen.getByTestId('gsc-last-fetched').textContent).toMatch(/^Showing the last report \(2026-07-01 – 2026-07-28\), fetched .+\. Refresh to get newer data\.$/);
});

it('does not fetch while disconnected or after an error', () => {
  useToolsStore.setState({ isGscConnected: false });
  renderHook(() => useSearchConsoleSession());
  useToolsStore.setState({ isGscConnected: true, gscError: 'quota' });
  renderHook(() => useSearchConsoleSession());
  expect(refresh).not.toHaveBeenCalled();
});

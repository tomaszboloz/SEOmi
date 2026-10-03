import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { SearchConsoleHub } from '@/components/AgentWorkflows/SearchConsoleHub';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { gscData } from './fixtures/gscTracker';

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'live-joint-report' });
  const row = (query: string, page: string) => ({ query, page, clicks: 1, impressions: 50, ctr: 2, position: 8 });
  const pairs = Array.from({ length: 249 }, (_, i) => row(`single ${i}`, `https://example.com/${i}`));
  pairs.push(row('target query', 'https://example.com/a'), row('target query', 'https://example.com/b'));
  useToolsStore.setState({ gscProperty: 'sc-domain:example.com', gscClientId: '', gscClientSecret: '',
    isGscConnected: true, isGscLoading: false, gscData: gscData({ query_pages: pairs }),
    gscProperties: [], gscError: null, gscInspectionResult: null, gscFilters: {} });
});
afterEach(cleanup);

it('analyzes full live observations beyond the 250-row history cap', () => {
  render(<SearchConsoleHub />);
  expect(screen.getByRole('heading', { level: 3, name: 'target query' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'https://example.com/a' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'https://example.com/b' })).toBeDefined();
  expect(screen.getAllByText(/50.0%/)).toHaveLength(2);
  const panel = screen.getByRole('heading', { level: 3, name: 'target query' }).closest('section')!;
  expect(within(panel).queryByRole('note')).toBeNull();
});

it('hides stale joint observations after switching the selected property', () => {
  render(<SearchConsoleHub />);
  expect(screen.getByRole('heading', { level: 3, name: 'target query' })).toBeDefined();
  act(() => useToolsStore.setState({ gscProperty: 'sc-domain:other.com' }));
  expect(screen.queryByRole('heading', { level: 3, name: 'target query' })).toBeNull();
});

it('retains the provider truncation notice for full live data', () => {
  useToolsStore.setState({ gscData: gscData({ ...useToolsStore.getState().gscData!, query_pages_may_be_truncated: true }) });
  render(<SearchConsoleHub />);
  expect(screen.getByRole('heading', { level: 3, name: 'target query' })).toBeDefined();
  const panel = screen.getByRole('heading', { level: 3, name: 'target query' }).closest('section')!;
  expect(within(panel).getByRole('note').textContent).toContain('truncated');
});

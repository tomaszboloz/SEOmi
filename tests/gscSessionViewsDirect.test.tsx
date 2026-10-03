import i18n from '@/i18n';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { SearchConsoleHeader } from '@/components/AgentWorkflows/searchConsole/Header';
import { SearchConsoleConnection } from '@/components/AgentWorkflows/searchConsole/Connection';
import { SearchConsoleControls } from '@/components/AgentWorkflows/searchConsole/Controls';
import { SearchConsoleMetrics } from '@/components/AgentWorkflows/searchConsole/Metrics';
import { SearchConsoleComparison } from '@/components/AgentWorkflows/searchConsole/Comparison';
import { SearchConsoleInspection } from '@/components/AgentWorkflows/searchConsole/Inspection';
import { SearchConsoleTables } from '@/components/AgentWorkflows/searchConsole/Tables';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { gscData } from './fixtures/gscTracker';
beforeEach(() => {
  localStorage.clear(); useProjectStore.setState({ activeProjectId: 'gsc-views' });
  useToolsStore.setState({ gscProperty: 'sc-domain:example.com', gscClientId: '', gscClientSecret: '',
    isGscConnected: true, isGscLoading: false, gscData: gscData(), gscProperties: [], gscError: null,
    gscInspectionResult: null, gscFilters: {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('exposes a live session and saves evidence only for the selected property', () => {
  const { result } = renderHook(() => useSearchConsoleSession());
  expect(result.current.currentSnapshot?.site_url).toBe('sc-domain:example.com');
  act(() => result.current.handleSaveSnapshot());
  expect(result.current.snapshots).toHaveLength(1);
  expect(result.current.trackerMessage).toContain('2026-07-01');
  act(() => useToolsStore.setState({ gscProperty: 'sc-domain:other.com' }));
  expect(result.current.currentSnapshot).toBeNull();
  expect(result.current.snapshots).toEqual([]);
  act(() => result.current.handleSaveSnapshot());
  expect(result.current.snapshots).toEqual([]);
  act(() => useProjectStore.setState({ activeProjectId: 'other-project' }));
  expect(result.current.inspectUrl).toBe('');
  expect(result.current.trackerMessage).toBe('');
});
it('directly renders every extracted view with actual session state', () => {
  const { result } = renderHook(() => useSearchConsoleSession());
  render(<>
    <SearchConsoleHeader session={result.current} />
    <SearchConsoleConnection session={result.current} />
    <SearchConsoleControls session={result.current} />
    <SearchConsoleMetrics session={result.current} />
    <SearchConsoleComparison session={result.current} />
    <SearchConsoleInspection session={result.current} />
    <SearchConsoleTables session={result.current} />
  </>);
  expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  expect(screen.getByRole('combobox', { name: 'GSC search type' })).toBeDefined();
  expect(screen.getByRole('button', { name: i18n.t('searchConsole.saveSnapshot') })).toBeDefined();
  expect(screen.getAllByText('query')).toHaveLength(1);
  expect(screen.getByText('https://example.com')).toBeDefined();
});

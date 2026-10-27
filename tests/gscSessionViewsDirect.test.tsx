import i18n from '@/i18n';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
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

it('SearchConsoleConnection handles input changes, submission, loading and error states', () => {
  const setInputClientId = vi.fn();
  const setInputClientSecret = vi.fn();
  const handleConnect = vi.fn((e) => e.preventDefault());
  const session = {
    t: (k: string) => k,
    isGscLoading: false,
    gscError: 'Failed to connect',
    handleConnect,
    inputClientId: 'test-id',
    setInputClientId,
    inputClientSecret: 'test-secret',
    setInputClientSecret,
  } as any;

  const { rerender } = render(<SearchConsoleConnection session={session} />);
  expect(screen.getByText('Failed to connect')).toBeDefined();

  const idInput = screen.getByPlaceholderText('searchConsole.clientIdPlaceholder');
  fireEvent.change(idInput, { target: { value: 'my-client-id' } });
  expect(setInputClientId).toHaveBeenCalledWith('my-client-id');

  const secretInput = screen.getByPlaceholderText('searchConsole.clientSecretPlaceholder');
  const help = screen.getByText('searchConsole.clientSecretHelp');
  expect(secretInput.getAttribute('aria-describedby')).toBe(help.id);
  expect(secretInput.hasAttribute('required')).toBe(false); // A saved project secret can be reused.
  fireEvent.change(secretInput, { target: { value: 'my-secret' } });
  expect(setInputClientSecret).toHaveBeenCalledWith('my-secret');

  fireEvent.submit(idInput.closest('form')!);
  expect(handleConnect).toHaveBeenCalledOnce();

  rerender(<SearchConsoleConnection session={{ ...session, isGscLoading: true, gscError: null }} />);
  expect(screen.getByText('searchConsole.connecting')).toBeDefined();
});

it('SearchConsoleHeader handles refresh, disconnect and loading spinner', () => {
  const disconnectGsc = vi.fn();
  const handleRefresh = vi.fn();
  const session = {
    t: (k: string) => k,
    isGscConnected: true,
    gscProperty: 'sc-domain:example.com',
    isGscLoading: false,
    disconnectGsc,
    dateRangeError: null,
    handleRefresh,
  } as any;

  render(<SearchConsoleHeader session={session} />);
  expect(screen.getByText('searchConsole.refresh')).toBeDefined();
  const disconnectBtn = screen.getByText('searchConsole.disconnect');
  fireEvent.click(disconnectBtn);
  expect(disconnectGsc).toHaveBeenCalled();
});


it('SearchConsoleInspection handles input changes, inspection results, and errors', () => {
  const setInspectUrl = vi.fn();
  const handleInspect = vi.fn((e) => e.preventDefault());
  const session = {
    t: (k: string) => k,
    gscProperty: 'sc-domain:example.com',
    gscInspectionResult: { verdict: 'PASS' },
    isGscLoading: false,
    gscError: 'Inspection failed',
    handleInspect,
    inspectUrl: 'https://example.com/page',
    setInspectUrl,
  } as any;

  render(<SearchConsoleInspection session={session} />);
  const input = screen.getByLabelText('searchConsole.inspectionAria');
  fireEvent.change(input, { target: { value: 'https://example.com/new' } });
  expect(setInspectUrl).toHaveBeenCalledWith('https://example.com/new');

  fireEvent.submit(input.closest('form')!);
  expect(handleInspect).toHaveBeenCalled();

  expect(screen.getByText(/PASS/)).toBeDefined();
  expect(screen.getByRole('alert').textContent).toBe('Inspection failed');
});

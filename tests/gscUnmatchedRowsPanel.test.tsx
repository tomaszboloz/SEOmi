import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { SearchConsoleUnmatchedRows } from '@/components/AgentWorkflows/searchConsole/UnmatchedRows';
import { SearchConsoleComparison } from '@/components/AgentWorkflows/searchConsole/Comparison';
import { useSearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { saveGscSnapshot } from '@/services/gscPerformanceTracker';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { gscData } from './fixtures/gscTracker';
import i18n from '@/i18n';

const empty = { baselineQueries: [], currentQueries: [], baselinePages: [], currentPages: [] };
beforeEach(() => {
  localStorage.clear(); useProjectStore.setState({ activeProjectId: 'comparable-windows' });
  useToolsStore.setState({ gscProperty: 'sc-domain:example.com', gscClientId: '', gscClientSecret: '',
    isGscConnected: true, isGscLoading: false, gscData: gscData({ start_date: '2026-08-01', end_date: '2026-08-28' }),
    gscProperties: [], gscError: null, gscInspectionResult: null, gscFilters: {} });
});
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });

it('renders nothing for legacy or fully matched comparison rows', () => {
  const { container, rerender } = render(<SearchConsoleUnmatchedRows rows={undefined} />);
  expect(container.textContent).toBe('');
  rerender(<SearchConsoleUnmatchedRows rows={empty} />);
  expect(container.textContent).toBe('');
});

it('shows all one-sided source identities as text, with counts and explicit uncertainty', () => {
  const { rerender } = render(<SearchConsoleUnmatchedRows rows={{ baselineQueries: ['<script>q</script>'],
    currentQueries: ['new'], baselinePages: ['https://example.com/old'], currentPages: ['https://example.com/new'] }} />);
  expect(screen.getByRole('note').textContent).toContain('does not mean zero traffic');
  expect(screen.getByText('<script>q</script>')).toBeDefined();
  expect(document.querySelector('script')).toBeNull();
  expect(screen.getByText('Queries observed only in baseline: 1')).toBeDefined();
  expect(screen.getByText('Queries observed only in current period: 1')).toBeDefined();
  expect(screen.getByText('URLs observed only in baseline: 1')).toBeDefined();
  expect(screen.getByText('URLs observed only in current period: 1')).toBeDefined();
  expect(document.querySelectorAll('li')).toHaveLength(4);
  rerender(<SearchConsoleUnmatchedRows rows={{ ...empty, baselineQueries: Array.from({ length: 250 }, (_, i) => `q${i}`) }} />);
  expect(document.querySelectorAll('li')).toHaveLength(250);
  expect(screen.getByText('q249')).toBeDefined();
});

it('integrates source-only rows and unequal-window errors with a real GSC session', async () => {
  await i18n.changeLanguage('pl');
  const baseline = gscData(); baseline.queries.push({ ...baseline.queries[0], query: 'baseline only' });
  saveGscSnapshot('comparable-windows', baseline);
  const { result } = renderHook(() => useSearchConsoleSession());
  const { rerender } = render(<SearchConsoleComparison session={result.current} />);
  expect(screen.getByText('Frazy widoczne tylko w okresie bazowym: 1')).toBeDefined();
  expect(screen.getByText(/Brak w pobranych danych nie oznacza zerowego ruchu/)).toBeDefined();
  act(() => useToolsStore.setState({ gscData: gscData({ start_date: '2026-08-01', end_date: '2026-08-07' }) }));
  rerender(<SearchConsoleComparison session={result.current} />);
  expect(screen.getByText('Wybierz okresy o tej samej liczbie dni, aby porównać ruch.')).toBeDefined();
  expect(screen.queryByText('baseline only')).toBeNull();
});

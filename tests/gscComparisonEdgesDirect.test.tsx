import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchConsoleComparison } from '@/components/AgentWorkflows/searchConsole/Comparison';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { gscData } from './fixtures/gscTracker';

const t = (key: string) => key;
const comparison = {
  compatible: true,
  uncertainBecauseTruncated: true,
  queryChanges: [
    { key: 'missing clicks', potentialDecline: true, clicksDeltaPercent: null },
    { key: 'declining query', potentialDecline: true, clicksDeltaPercent: -12.34 },
    { key: 'stable query', potentialDecline: false, clicksDeltaPercent: 0 },
  ],
  pageChanges: [],
  unmatchedRows: undefined,
};

const session = (patch: Record<string, unknown> = {}): SearchConsoleSession => ({
  t, gscData: gscData(), currentSnapshot: { id: 'current' }, comparison,
  strikingDistance: [], snapshotScopeLabel: () => ' · web',
  snapshots: [{ id: 'current' }, { id: 'baseline', start_date: '2026-08-01', end_date: '2026-08-28', filters: { search_type: 'web' } }],
  baselineId: 'baseline', setBaselineId: vi.fn(), ...patch,
} as unknown as SearchConsoleSession);

describe('Search Console comparison direct edges', () => {
  it('renders nullable and numeric decline deltas, truncation, and empty opportunities', () => {
    const state = session();
    render(<SearchConsoleComparison session={state} />);
    expect(screen.getByText('missing clicks')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('-12.3% searchConsole.clicksDelta')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('searchConsole.truncatedWarning');
    expect(screen.getByText('searchConsole.noStrikingDistance')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'baseline' } });
    expect(state.setBaselineId).toHaveBeenCalledWith('baseline');
  });

  it('reports an explicit reason and the generic unavailable state', () => {
    const view = render(<SearchConsoleComparison session={session({ comparison: { ...comparison, compatible: false, reason: 'window mismatch' } })} />);
    expect(screen.getByText('window mismatch')).toBeTruthy();
    view.rerender(<SearchConsoleComparison session={session({ comparison: { ...comparison, compatible: false, reason: undefined } })} />);
    expect(screen.getByText('searchConsole.comparisonUnavailable')).toBeTruthy();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchConsoleControls } from '@/components/AgentWorkflows/searchConsole/Controls';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';

const session = (): SearchConsoleSession => ({
  t: (key: string) => key, activeProjectId: 'p', gscProperties: [], gscProperty: 'sc-domain:site.test',
  gscFilters: {}, gscData: null, setGscProperty: vi.fn(), dateRangeError: null,
  updateFilter: vi.fn(), handleSaveSnapshot: vi.fn(), dateRange: { startDate: '2026-09-01', endDate: '2026-09-30' },
  setDateRange: vi.fn(), trackerMessage: '',
} as unknown as SearchConsoleSession);

describe('deferred Search Console date edits', () => {
  it.each([['searchConsole.startDateAria', 'startDate'], ['searchConsole.endDateAria', 'endDate']] as const)('retains the entered %s after the event dispatch completes', (label, field) => {
      const state = session();
      render(<SearchConsoleControls session={state} />);
      fireEvent.change(screen.getByLabelText(label), { target: { value: '2026-09-15' } });
      const updater = vi.mocked(state.setDateRange).mock.calls[0][0];
      expect(typeof updater).toBe('function');
      if (typeof updater === 'function') expect(updater(state.dateRange)).toEqual({ ...state.dateRange, [field]: '2026-09-15' });
    });
});

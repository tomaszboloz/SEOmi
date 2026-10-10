import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchConsoleControls } from '@/components/AgentWorkflows/searchConsole/Controls';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { gscData } from './fixtures/gscTracker';

const t = (key: string) => key;
const base = (patch: Record<string, unknown> = {}): SearchConsoleSession => ({
  t, activeProjectId: 'project', gscProperties: [{ siteUrl: 'sc-domain:site.test', permissionLevel: 'siteFullUser' }],
  gscProperty: 'sc-domain:site.test', gscFilters: { search_type: 'web', device: 'DESKTOP', country: 'pl' },
  gscData: gscData({ site_url: 'sc-domain:site.test' }), setGscProperty: vi.fn(), dateRangeError: 'invalid range',
  updateFilter: vi.fn(), handleSaveSnapshot: vi.fn(), dateRange: { startDate: '2026-09-01', endDate: '2026-09-30' },
  setDateRange: vi.fn(), trackerMessage: 'saved', ...patch,
} as unknown as SearchConsoleSession);

describe('Search Console controls direct edges', () => {
  it('normalizes filter edits, exposes the selected property, and saves an eligible snapshot', () => {
    const state = base();
    render(<SearchConsoleControls session={state} />);
    const searchType = screen.getByLabelText('searchConsole.searchTypeAria');
    fireEvent.change(searchType, { target: { value: '' } });
    fireEvent.change(searchType, { target: { value: 'image' } });
    const device = screen.getByLabelText('searchConsole.deviceAria');
    fireEvent.change(device, { target: { value: '' } });
    fireEvent.change(device, { target: { value: 'TABLET' } });
    const country = screen.getByLabelText('searchConsole.countryAria');
    fireEvent.change(country, { target: { value: 'a!2zZ' } });
    fireEvent.change(country, { target: { value: '---' } });
    expect(vi.mocked(state.updateFilter).mock.calls).toEqual([
      [{ search_type: undefined }], [{ search_type: 'image' }], [{ device: undefined }], [{ device: 'TABLET' }],
      [{ country: 'azz' }], [{ country: undefined }],
    ]);
    fireEvent.change(screen.getByLabelText('searchConsole.selectedPropertyAria'), { target: { value: 'sc-domain:site.test' } });
    expect(state.setGscProperty).toHaveBeenCalledWith('sc-domain:site.test');
    const save = screen.getByRole('button', { name: 'searchConsole.saveSnapshot' });
    expect(save).toHaveProperty('disabled', false);
    fireEvent.click(save);
    expect(state.handleSaveSnapshot).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert').textContent).toBe('invalid range');
    expect(screen.getByRole('status').textContent).toBe('saved');
  });

  it('disables saving when project, data, or selected property is unavailable', () => {
    const { rerender } = render(<SearchConsoleControls session={base({ gscData: null })} />);
    expect(screen.getByRole('button', { name: 'searchConsole.saveSnapshot' })).toHaveProperty('disabled', true);
    rerender(<SearchConsoleControls session={base({ activeProjectId: '' })} />);
    expect(screen.getByRole('button', { name: 'searchConsole.saveSnapshot' })).toHaveProperty('disabled', true);
    rerender(<SearchConsoleControls session={base({ gscData: gscData({ site_url: 'sc-domain:other.test' }) })} />);
    expect(screen.getByRole('button', { name: 'searchConsole.saveSnapshot' })).toHaveProperty('disabled', true);
  });
});

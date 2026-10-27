import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SearchConsoleHub } from '@/components/AgentWorkflows/SearchConsoleHub';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';

describe('SearchConsoleHub daily performance charts', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({ activeProjectId: 'gsc-chart-project' });
    useToolsStore.setState({
      isGscConnected: true, gscHydratedProjectId: 'gsc-chart-project',
      gscClientId: '',
      gscProperties: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }],
      gscProperty: 'sc-domain:example.com',
      gscData: {
        site_url: 'sc-domain:example.com', start_date: '2026-08-01', end_date: '2026-08-03',
        total_clicks: 11, total_impressions: 200, avg_ctr: 5.5, avg_position: 8.2,
        queries: [], pages: [],
        daily: [
          { date: '2026-08-01', clicks: 2, impressions: 50, ctr: 4, position: 9 },
          { date: '2026-08-02', clicks: 4, impressions: 70, ctr: 5.7, position: 8 },
          { date: '2026-08-03', clicks: 5, impressions: 80, ctr: 6.25, position: 7.8 },
        ],
        queries_may_be_truncated: false, pages_may_be_truncated: false, daily_may_be_truncated: false, max_rows_per_dimension: 25000,
      },
    });
  });

  it('renders four accessible series from the returned GSC date dimension', () => {
    render(<SearchConsoleHub />);
    expect(screen.getByRole('heading', { name: 'Daily trend' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Daily trend: Clicks' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Daily trend: Impressions' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Daily trend: CTR (%)' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Daily trend: Average position' })).toBeTruthy();
    expect(screen.getAllByText('2026-08-01')).toHaveLength(4);
    expect(screen.getAllByText('2026-08-03')).toHaveLength(4);
  });

  it('exposes API scope filters without leaving the current project', () => {
    useToolsStore.setState({ gscFilters: {} });
    render(<SearchConsoleHub />);
    fireEvent.change(screen.getByRole('combobox', { name: 'GSC search type' }), { target: { value: 'web' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'GSC device' }), { target: { value: 'MOBILE' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'GSC country' }), { target: { value: 'POL' } });
    expect(useToolsStore.getState().gscFilters).toEqual({ search_type: 'web', device: 'MOBILE', country: 'pol' });
  });
});

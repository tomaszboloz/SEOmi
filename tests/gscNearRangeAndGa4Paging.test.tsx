import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n';
import { GscOpportunities } from '@/components/AgentWorkflows/GscOpportunities';
import { readNearRange } from '@/components/AgentWorkflows/GscNearRangeFields';
import { Ga4ReportTable } from '@/components/AgentWorkflows/searchConsole/ga4/ReportTable';
import { snapshotGscPerformance } from '@/services/gscPerformanceTracker';
import { findNearTopTenQueries, sanitizePositionRange } from '@/services/gscTracker/opportunities';
import type { Ga4JoinedRow } from '@/types/ga4';
import { gscData } from './fixtures/gscTracker';

const query = (name: string, position: number) => ({ query: name, position, clicks: 1, impressions: 200, ctr: 0.5 });
const QUERIES = [query('ten', 10), query('p11', 11), query('p13', 13.5), query('p14', 14), query('p15', 15), query('p20', 20)];
const snapshot = () => snapshotGscPerformance(gscData({ queries: QUERIES }));
const tGa4 = (key: string) => i18n.t(key);

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('near-top-10 position window', () => {
  it('keeps the 10-20 default and filters above min up to max', () => {
    expect(findNearTopTenQueries(snapshot()).map((row) => row.query)).toEqual(['p11', 'p13', 'p14', 'p15', 'p20']);
    expect(findNearTopTenQueries(snapshot(), { min: 10, max: 14 }).map((row) => row.query)).toEqual(['p11', 'p13', 'p14']);
  });

  it('falls back to 10-20 for unusable windows', () => {
    for (const bad of [null, { min: 14, max: 10 }, { min: 5, max: 5 }, { min: -1, max: 10 }, { min: 1, max: 101 }, { min: 'x', max: 5 }]) {
      expect(sanitizePositionRange(bad)).toEqual({ min: 10, max: 20 });
    }
    expect(sanitizePositionRange({ min: 3.5, max: 8 })).toEqual({ min: 3.5, max: 8 });
  });

  it('lets the user set min and max, saves them per project and rejects an inverted window', () => {
    render(<GscOpportunities snapshot={snapshot()} projectId="p1" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Queries 10–20 (5)' }));
    fireEvent.change(screen.getByLabelText('Position up to'), { target: { value: '14' } });
    expect(screen.getByRole('tab', { name: 'Queries 10–14 (3)' })).toBeTruthy();
    expect(screen.queryByText('p15')).toBeNull();
    expect(readNearRange('p1')).toEqual({ min: 10, max: 14 });
    expect(readNearRange('p2')).toEqual({ min: 10, max: 20 });
    fireEvent.change(screen.getByLabelText('Position above'), { target: { value: '16' } });
    expect(screen.getByRole('alert').textContent).toBe('Enter positions from 0 to 100 with the first lower than the second.');
    expect(screen.getByRole('tab', { name: 'Queries 10–14 (3)' })).toBeTruthy();
    cleanup();
    render(<GscOpportunities snapshot={snapshot()} projectId="p1" />);
    expect(screen.getByRole('tab', { name: 'Queries 10–14 (3)' })).toBeTruthy();
  });
});

describe('GA4 landing pages table', () => {
  const rows: Ga4JoinedRow[] = Array.from({ length: 30 }, (_, i) => ({
    landing_page: `/page-${String(i).padStart(2, '0')}`, host_name: 'example.com', sessions: i === 29 ? undefined : i, engaged_sessions: 1, key_events: 0, crawl_issue_count: 0,
  }) as Ga4JoinedRow);

  it('shows 25 rows per page sorted by sessions, with next page and page size', () => {
    render(<Ga4ReportTable rows={rows} t={tGa4} />);
    const body = () => screen.getAllByRole('row').slice(1);
    expect(body()).toHaveLength(25);
    expect(within(body()[0]).getByText('/page-28')).toBeTruthy();
    expect(screen.getByText('Showing 1–25 of 30')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('searchConsole.pageNext') }));
    expect(body()).toHaveLength(5);
    expect(within(body()[4]).getByText('/page-29')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '50' } });
    expect(body()).toHaveLength(30);
  });

  it('keeps the empty state', () => {
    render(<Ga4ReportTable rows={[]} t={tGa4} />);
    expect(screen.getByText(i18n.t('ga4.noRows'))).toBeTruthy();
  });
});

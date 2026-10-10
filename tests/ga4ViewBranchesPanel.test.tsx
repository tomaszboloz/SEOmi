import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Ga4Panel } from '@/components/AgentWorkflows/searchConsole/ga4/Ga4Panel';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import type { Ga4Discovery, Ga4JoinResult, Ga4Property, Ga4Report } from '@/types/ga4';
import type { Ga4SessionState } from '@/components/AgentWorkflows/searchConsole/ga4/types';

const useSession = vi.hoisted(() => vi.fn());
vi.mock('@/components/AgentWorkflows/searchConsole/ga4/useGa4Session', () => ({ useGa4Session: useSession }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const property: Ga4Property = { name: 'properties/1', display_name: 'Site', stream_urls: ['https://site.test/'] };
const discovery: Ga4Discovery = { status: 'complete', property, account_pages: 1, stream_pages: 1, candidates_checked: 1, may_be_truncated: false };
const report: Ga4Report = { property: 'properties/1', start_date: '2026-09-01', end_date: '2026-09-30', rows: [], row_count: null, may_be_truncated: true, status: 'partial' };
const joined: Ga4JoinResult = { rows: [], matched_gsc_rows: 0, matched_crawl_rows: 0, gsc_period_matches: true, warnings: [] };
const session = (activeProjectId: string | null = 'p1', gscClientId = 'client'): SearchConsoleSession => ({ activeProjectId, gscClientId, gscData: null, dateRange: { startDate: '2026-09-01', endDate: '2026-09-30' } } as SearchConsoleSession);
const state = (patch: Partial<Ga4SessionState> = {}): Ga4SessionState => ({ analyticsConnected: false, discovery: null, matchedProperties: [], selectedProperty: null, report: null, joined: null, loading: 'idle', error: null, dateRange: { startDate: '2026-09-01', endDate: '2026-09-30' }, connectAnalytics: vi.fn(async () => undefined), refreshProperties: vi.fn(async () => undefined), loadReport: vi.fn(async () => undefined), ...patch });

describe('GA4 panel branch coverage', () => {
  it('renders project, empty-client and error states with no property', () => {
    useSession.mockReturnValue(state());
    const view = render(<Ga4Panel session={session(null, '')} />);
    expect(screen.getByText('ga4.projectRequired')).toBeTruthy();
    useSession.mockReturnValue(state({ analyticsConnected: true, discovery: { ...discovery, property: null, may_be_truncated: true }, error: 'Analytics failed' }));
    view.rerender(<Ga4Panel session={session('p1', '')} projectRootUrl="https://site.test/" />);
    expect(screen.getByText('ga4.connectFirst')).toBeTruthy();
    expect(screen.getByText('ga4.noProperty')).toBeTruthy();
    expect(screen.getByText('ga4.truncated')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Analytics failed');
  });

  it('renders partial dates, warnings, loading, refresh and report actions', () => {
    const connect = vi.fn(async () => undefined);
    const refresh = vi.fn(async () => undefined);
    const load = vi.fn(async () => undefined);
    const warnings = ['Google Search Console and Google Analytics periods differ.', 'crawl warning'];
    const busy = state({ analyticsConnected: true, discovery: { ...discovery, may_be_truncated: true }, selectedProperty: property, report, joined: { ...joined, warnings }, loading: 'reporting', connectAnalytics: connect, refreshProperties: refresh, loadReport: load });
    useSession.mockReturnValue(busy);
    const view = render(<Ga4Panel session={session()} projectRootUrl="https://site.test/" />);
    expect(screen.getAllByRole('button', { name: 'ga4.loading' })).toHaveLength(2);
    expect(screen.getAllByText('ga4.truncated')).toHaveLength(2);
    expect(screen.getByText('ga4.noRows')).toBeTruthy();
    expect(screen.getByText('ga4.periodsDiffer')).toBeTruthy();
    expect(screen.getByText('crawl warning')).toBeTruthy();
    expect(screen.getByText('2026-09-01 — 2026-09-30')).toBeTruthy();
    const ready = state({ analyticsConnected: true, discovery, selectedProperty: property, report, joined: { ...joined, warnings }, connectAnalytics: connect, refreshProperties: refresh, loadReport: load });
    useSession.mockReturnValue(ready);
    view.rerender(<Ga4Panel session={session()} projectRootUrl="https://site.test/" />);
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'ga4.reconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'ga4.refresh' }));
    fireEvent.click(screen.getByRole('button', { name: 'ga4.loadReport' }));
    expect(connect).toHaveBeenCalledWith('secret');
    expect(refresh).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledOnce();
    useSession.mockReturnValue(state({ analyticsConnected: true, discovery, selectedProperty: property }));
    view.rerender(<Ga4Panel session={session()} projectRootUrl="https://site.test/" />);
    expect(screen.getByRole('status').textContent).toContain('ga4.unavailable');
    useSession.mockReturnValue(state({ analyticsConnected: true, discovery, selectedProperty: property, report, joined: null }));
    view.rerender(<Ga4Panel session={session()} projectRootUrl="https://site.test/" />);
    expect(screen.queryByText('ga4.noRows')).toBeNull();
  });
});

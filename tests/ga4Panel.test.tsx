import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Ga4Panel } from '@/components/AgentWorkflows/searchConsole/ga4/Ga4Panel';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: invoke }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const session = (activeProjectId = 'p1', startDate = '2026-09-01', endDate = '2026-09-30'): SearchConsoleSession => ({ activeProjectId, gscClientId: 'client', gscData: null, dateRange: { startDate, endDate } } as SearchConsoleSession);
const discovery = { status: 'complete', property: { name: 'properties/123', display_name: 'Site', stream_urls: ['https://site.test/'] }, account_pages: 1, stream_pages: 1, candidates_checked: 1, may_be_truncated: false };
const snapshot = { status: 'complete', start_date: '2026-09-01', end_date: '2026-09-30', discovery, report: { status: 'complete', property: 'properties/123', host_name: 'site.test', start_date: '2026-09-01', end_date: '2026-09-30', rows: [{ host_name: 'site.test', landing_page: '/home', sessions: 2, engaged_sessions: 1, key_events: 0 }], row_count: 1, pages: 1, may_be_truncated: false } };

describe('GA4 panel', () => {
  beforeEach(() => { invoke.mockReset().mockImplementation(async (command: string) => command === 'connect_google_analytics' ? [] : command === 'list_google_analytics_properties' ? discovery : snapshot); });

  it('keeps Analytics authorization explicit and then loads the matched report', async () => {
    render(<Ga4Panel session={session()} projectRootUrl="https://site.test/" />);
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'ga4.authorize' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('connect_google_analytics', { projectId: 'p1', clientId: 'client' }));
    await waitFor(() => expect(screen.getByText('Site')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'ga4.loadReport' }));
    await waitFor(() => expect(screen.getByText('/home')).toBeTruthy());
    expect(invoke).toHaveBeenCalledWith('google_analytics_performance', expect.objectContaining({ siteUrl: 'https://site.test/' }));
  });

  it('does not let a late authorization response populate another project', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    invoke.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const view = render(<Ga4Panel session={session('p1')} projectRootUrl="https://site.test/" />);
    fireEvent.click(screen.getByRole('button', { name: 'ga4.authorize' }));
    view.rerender(<Ga4Panel session={session('p2')} projectRootUrl="https://site.test/" />);
    resolve([]);
    await waitFor(() => expect(screen.queryByText('Site')).toBeNull());
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale authorization rejection and clears the secret on project change', async () => {
    let reject: (error: Error) => void = () => undefined;
    invoke.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    const view = render(<Ga4Panel session={session('p1')} projectRootUrl="https://site.test/" />);
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'ga4.authorize' }));
    view.rerender(<Ga4Panel session={session('p2')} projectRootUrl="https://site.test/" />);
    expect(screen.getByPlaceholderText('••••••••')).toHaveProperty('value', '');
    reject(new Error('late authorization failure'));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('does not render a report that resolves after the selected date range changes', async () => {
    let resolveReport: (value: unknown) => void = () => undefined;
    invoke.mockImplementation((command: string) => command === 'connect_google_analytics' ? [] : command === 'list_google_analytics_properties' ? discovery : new Promise((resolve) => { resolveReport = resolve; }));
    const view = render(<Ga4Panel session={session()} projectRootUrl="https://site.test/" />);
    fireEvent.click(screen.getByRole('button', { name: 'ga4.authorize' }));
    await waitFor(() => expect(screen.getByText('Site')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'ga4.loadReport' }));
    view.rerender(<Ga4Panel session={session('p1', '2026-10-01', '2026-10-30')} projectRootUrl="https://site.test/" />);
    resolveReport(snapshot);
    await waitFor(() => expect(screen.queryByText('/home')).toBeNull());
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Ga4ConnectionCard } from '@/components/AgentWorkflows/searchConsole/ga4/ConnectionCard';
import { Ga4PropertyCard } from '@/components/AgentWorkflows/searchConsole/ga4/PropertyCard';
import { Ga4ReportTable } from '@/components/AgentWorkflows/searchConsole/ga4/ReportTable';
import type { Ga4Rows } from '@/components/AgentWorkflows/searchConsole/ga4/viewTypes';
import type { Ga4Property } from '@/types/ga4';

const t = (key: string): string => key;
const property: Ga4Property = { name: 'properties/1', display_name: '', stream_urls: ['https://site.test/'] };

describe('GA4 view branch coverage: cards and table', () => {
  it('renders empty client, loading, reconnect and refresh connection states', () => {
    const setSecret = vi.fn();
    const connect = vi.fn();
    const refresh = vi.fn();
    const view = render(<Ga4ConnectionCard connected={false} loading={false} hasClientId={false} clientSecret="" setClientSecret={setSecret} onConnect={connect} onRefresh={refresh} t={t} />);
    expect(screen.getByText('ga4.connectFirst')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ga4.authorize' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    expect(setSecret).toHaveBeenCalledWith('secret');
    view.rerender(<Ga4ConnectionCard connected={true} loading={false} hasClientId clientSecret="secret" setClientSecret={setSecret} onConnect={connect} onRefresh={refresh} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'ga4.reconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'ga4.refresh' }));
    expect(connect).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    view.rerender(<Ga4ConnectionCard connected={true} loading hasClientId clientSecret="secret" setClientSecret={setSecret} onConnect={connect} onRefresh={refresh} t={t} />);
    expect(screen.getByRole('button', { name: 'ga4.loading' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'ga4.refresh' })).toHaveProperty('disabled', true);
  });

  it('renders missing and truncated Analytics property states', () => {
    const load = vi.fn();
    const view = render(<Ga4PropertyCard property={null} truncated={false} onLoad={load} loading={false} t={t} />);
    expect(screen.getByText('ga4.noProperty')).toBeTruthy();
    view.rerender(<Ga4PropertyCard property={property} truncated loading={false} onLoad={load} t={t} />);
    expect(screen.getByText('properties/1')).toBeTruthy();
    expect(screen.getByText('ga4.truncated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ga4.loadReport' }));
    expect(load).toHaveBeenCalledOnce();
    view.rerender(<Ga4PropertyCard property={property} truncated={false} onLoad={load} loading t={t} />);
    expect(screen.getByRole('button', { name: 'ga4.loading' })).toHaveProperty('disabled', true);
  });

  it('shows no rows and unknown or present joined metrics', () => {
    const row = { host_name: 'site.test', landing_page: '/home', sessions: 2, engaged_sessions: 1, key_events: 0, gsc: { clicks: 3, impressions: 4, ctr: 0.5, position: 2 }, crawl_issue_count: 1 };
    const partial = { ...row, gsc: undefined, crawl_issue_count: undefined };
    const view = render(<Ga4ReportTable rows={[]} t={t} />);
    expect(screen.getByText('ga4.noRows')).toBeTruthy();
    view.rerender(<Ga4ReportTable rows={[row, partial] as Ga4Rows} t={t} />);
    expect(screen.getAllByText('/home')).toHaveLength(2);
    expect(screen.getAllByText('ga4.unknown').length).toBe(3);
    expect(screen.getByText('3')).toBeTruthy();
  });
});
